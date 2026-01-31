"""Repo cloning, file walking, chunking, and import-dependency extraction."""

import hashlib
import os
import re
import shutil
from pathlib import Path

from git import Repo

from config import CHUNK_OVERLAP, CHUNK_SIZE, CLONE_DIR, CODE_EXTENSIONS, SKIP_DIRS


def repo_id_from_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:12]


def clone_repo(url: str) -> tuple[str, str]:
    """Clone a GitHub repo; return (repo_id, local_path)."""
    rid = repo_id_from_url(url)
    dest = os.path.join(CLONE_DIR, rid)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)
    Repo.clone_from(url, dest, depth=1)
    return rid, dest


def walk_files(root: str) -> list[str]:
    """Return relative paths of code files, skipping ignored dirs."""
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            if Path(f).suffix in CODE_EXTENSIONS:
                full = os.path.join(dirpath, f)
                results.append(os.path.relpath(full, root))
    return sorted(results)


def chunk_file(root: str, rel_path: str) -> list[dict]:
    """Split a file into overlapping line-based chunks with metadata."""
    full = os.path.join(root, rel_path)
    try:
        with open(full, "r", errors="replace") as f:
            lines = f.readlines()
    except Exception:
        return []

    chunks = []
    start = 0
    while start < len(lines):
        end = min(start + CHUNK_SIZE, len(lines))
        text = "".join(lines[start:end])
        if text.strip():
            chunks.append({
                "file": rel_path,
                "start_line": start + 1,
                "end_line": end,
                "text": text,
            })
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


# --- Import / dependency extraction ---

_IMPORT_PATTERNS = {
    ".py": [
        re.compile(r"^\s*import\s+([\w.]+)", re.MULTILINE),
        re.compile(r"^\s*from\s+([\w.]+)\s+import", re.MULTILINE),
    ],
    ".js": [re.compile(r"""(?:import\s.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]""")],
    ".jsx": [re.compile(r"""(?:import\s.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]""")],
    ".ts": [re.compile(r"""(?:import\s.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]""")],
    ".tsx": [re.compile(r"""(?:import\s.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]""")],
    ".go": [re.compile(r'"([^"]+)"')],
    ".rs": [re.compile(r"(?:use|mod)\s+([\w:]+)")],
    ".java": [re.compile(r"import\s+([\w.]+);")],
    ".rb": [re.compile(r"require\s+['\"]([^'\"]+)['\"]")],
}


def _resolve_relative_import(source_file: str, target: str, all_files: set[str]) -> str | None:
    """Try to resolve a relative import path to an actual file in the repo."""
    source_dir = os.path.dirname(source_file)
    # Strip leading ./
    target = target.lstrip("./")
    candidates = [
        os.path.normpath(os.path.join(source_dir, target)),
        os.path.normpath(os.path.join(source_dir, target + ".py")),
        os.path.normpath(os.path.join(source_dir, target + ".ts")),
        os.path.normpath(os.path.join(source_dir, target + ".tsx")),
        os.path.normpath(os.path.join(source_dir, target + ".js")),
        os.path.normpath(os.path.join(source_dir, target + ".jsx")),
        os.path.normpath(os.path.join(source_dir, target, "index.ts")),
        os.path.normpath(os.path.join(source_dir, target, "index.tsx")),
        os.path.normpath(os.path.join(source_dir, target, "index.js")),
        os.path.normpath(os.path.join(source_dir, target, "__init__.py")),
    ]
    for c in candidates:
        if c in all_files:
            return c
    # Python dotted imports: foo.bar -> foo/bar.py or foo/bar/__init__.py
    dotted = target.replace(".", "/")
    for suffix in ["", ".py", "/__init__.py"]:
        c = os.path.normpath(dotted + suffix)
        if c in all_files:
            return c
    return None


def extract_edges(root: str, files: list[str]) -> list[dict]:
    """Return list of {source, target} edges based on import statements."""
    file_set = set(files)
    edges = []
    seen = set()
    for rel in files:
        ext = Path(rel).suffix
        patterns = _IMPORT_PATTERNS.get(ext, [])
        if not patterns:
            continue
        full = os.path.join(root, rel)
        try:
            with open(full, "r", errors="replace") as f:
                content = f.read()
        except Exception:
            continue
        for pat in patterns:
            for match in pat.finditer(content):
                target_raw = match.group(1)
                resolved = _resolve_relative_import(rel, target_raw, file_set)
                if resolved and resolved != rel:
                    key = (rel, resolved)
                    if key not in seen:
                        seen.add(key)
                        edges.append({"source": rel, "target": resolved})
    return edges
