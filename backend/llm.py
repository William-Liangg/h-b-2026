"""Claude-powered answer generation with citations."""

from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL

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
