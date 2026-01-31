"""Claude-powered answer generation with citations."""

import json
import logging
import os
import re

from anthropic import Anthropic

from config import (
    ANALYSIS_BATCH_SIZE,
    ANALYSIS_MAX_LINES,
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    IMPORTANCE_THRESHOLD,
)

log = logging.getLogger(__name__)

_anthropic = Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """You are Atlas, an expert code analyst. Answer the user's question about a codebase using ONLY the provided code context. Be concise and precise.

Rules:
- Ground every claim in the provided chunks.
- Cite sources as [file:start_line-end_line] inline.
- If the context doesn't contain enough information, say so.
- Use technical language appropriate for developers."""


def generate_answer(question: str, chunks: list[dict]) -> dict:
    """Generate a grounded answer from retrieved chunks."""
    context_parts = []
    for i, c in enumerate(chunks):
        context_parts.append(f"--- Chunk {i+1}: {c['file']} (lines {c['start_line']}-{c['end_line']}) ---\n{c['text']}")
    context = "\n\n".join(context_parts)

    msg = _anthropic.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Code context:\n{context}\n\nQuestion: {question}"},
        ],
    )
    answer_text = msg.content[0].text

    # Extract citations from answer
    import re
    citations = []
    for m in re.finditer(r"\[([^:\]]+):(\d+)-(\d+)\]", answer_text):
        citations.append({"file": m.group(1), "start_line": int(m.group(2)), "end_line": int(m.group(3))})

    return {"answer": answer_text, "citations": citations, "chunks": chunks}


# ---------------------------------------------------------------------------
# Onboarding: file importance scoring + AI summaries
# ---------------------------------------------------------------------------

_ANALYSIS_SYSTEM = """You are an expert code analyst helping new developers onboard to a codebase.
You will receive a batch of source files. For EACH file, return a JSON object with:
- "importance_score": integer 0-10 (10 = critical entry point, 0 = trivial/generated)
- "summary": 1-2 sentence description of what the file does
- "responsibilities": list of 2-4 key responsibilities
- "key_exports": list of important functions, classes, or exports
- "onboarding_reason": 1 sentence explaining why a new developer should (or shouldn't) read this

Scoring guidelines:
- 9-10: Entry points (main.py, index.ts, app.py, server.py), top-level routers/apps
- 7-8: Core business logic, primary API routes, central state management, key models
- 5-6: Important utilities, middleware, shared helpers used across many files
- 3-4: Individual components, isolated features, secondary helpers
- 1-2: Tests, generated files, type declarations, minor configs
- 0: Empty files, lockfiles, auto-generated code

Return ONLY a JSON object where keys are the file paths and values are the analysis objects. No markdown fences."""


def analyze_repo_files(files: list[str], root_path: str) -> dict:
    """Analyze all repo files for importance and generate summaries.

    Returns dict keyed by relative file path with analysis data.
    """
    results: dict = {}

    # Build batches of (path, content) tuples
    file_contents: list[tuple[str, str]] = []
    for rel in files:
        full = os.path.join(root_path, rel)
        try:
            with open(full, "r", errors="replace") as f:
                lines = f.readlines()[:ANALYSIS_MAX_LINES]
            text = "".join(lines)
            if text.strip():
                file_contents.append((rel, text))
        except Exception:
            continue

    # Process in batches
    for i in range(0, len(file_contents), ANALYSIS_BATCH_SIZE):
        batch = file_contents[i : i + ANALYSIS_BATCH_SIZE]
        prompt_parts = []
        for rel, text in batch:
            prompt_parts.append(f"=== FILE: {rel} ===\n{text}\n")
        prompt = "\n".join(prompt_parts)

        try:
            msg = _anthropic.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4096,
                system=_ANALYSIS_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text
            # Strip markdown fences if present
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
            raw = re.sub(r"\s*```$", "", raw.strip())
            parsed = json.loads(raw)
            results.update(parsed)
        except Exception as e:
            log.warning("File analysis batch failed: %s", e)
            # Assign defaults for this batch
            for rel, _ in batch:
                results[rel] = {
                    "importance_score": 3,
                    "summary": "Analysis unavailable.",
                    "responsibilities": [],
                    "key_exports": [],
                    "onboarding_reason": "",
                }

    return results


_ONBOARDING_SYSTEM = """You are an expert code analyst creating an onboarding reading path for a new developer.
Given a set of important files with their summaries and the dependency edges between files,
produce an ordered reading path (a linked list) that a new developer should follow.

Rules:
- Start from the main entry point(s)
- Follow logical dependency order: entry points → core modules → utilities
- Each step should build on knowledge from previous steps
- Include a "reason" explaining why this file comes at this position

Return ONLY a JSON array of objects, each with:
- "file": the file path
- "reason": why to read this file at this point in the onboarding

No markdown fences."""


def generate_onboarding_path(file_analyses: dict, edges: list[dict]) -> list[dict]:
    """Generate a suggested reading order for onboarding.

    Returns list of {"file", "summary", "reason", "importance_score", ...} dicts.
    """
    # Filter to important files
    important = {
        f: a for f, a in file_analyses.items()
        if a.get("importance_score", 0) >= IMPORTANCE_THRESHOLD
    }

    if not important:
        # Fallback: take top 10 by score
        sorted_files = sorted(file_analyses.items(), key=lambda x: x[1].get("importance_score", 0), reverse=True)
        important = dict(sorted_files[:10])

    # Build prompt
    file_summaries = "\n".join(
        f"- {f} (score {a['importance_score']}): {a['summary']}"
        for f, a in important.items()
    )
    relevant_edges = [e for e in edges if e["source"] in important and e["target"] in important]
    edge_text = "\n".join(f"  {e['source']} → {e['target']}" for e in relevant_edges) or "  (no edges)"

    prompt = f"Files:\n{file_summaries}\n\nDependency edges:\n{edge_text}"

    try:
        msg = _anthropic.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            system=_ONBOARDING_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw.strip())
        path = json.loads(raw)
    except Exception as e:
        log.warning("Onboarding path generation failed: %s", e)
        # Fallback: sort by importance descending
        path = [{"file": f, "reason": "Sorted by importance score"} for f, _ in
                sorted(important.items(), key=lambda x: x[1].get("importance_score", 0), reverse=True)]

    # Enrich each step with the full analysis data
    enriched = []
    for step in path:
        f = step.get("file", "")
        analysis = file_analyses.get(f, {})
        enriched.append({
            "file": f,
            "summary": analysis.get("summary", ""),
            "reason": step.get("reason", ""),
            "importance_score": analysis.get("importance_score", 0),
            "responsibilities": analysis.get("responsibilities", []),
            "key_exports": analysis.get("key_exports", []),
        })

    return enriched
