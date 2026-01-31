"""Atlas — FastAPI backend."""

import json
import os
from contextlib import asynccontextmanager
from typing import Generator

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import get_current_user, router as auth_router
from config import CLONE_DIR, IMPORTANCE_THRESHOLD
from database import User, init_db
from embeddings import collection_has_data, query_chunks, store_chunks
from llm import analyze_repo_files, generate_answer, generate_onboarding_path
from parser import chunk_file, clone_repo, extract_edges, repo_id_from_url, walk_files
from validation import hash_output, validate_deterministic

# Disk-backed graph cache: repo_id -> {files, edges, root}
_GRAPH_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".graph_cache")
_graph_cache: dict[str, dict] = {}


def _save_graph(repo_id: str, data: dict):
    os.makedirs(_GRAPH_CACHE_DIR, exist_ok=True)
    with open(os.path.join(_GRAPH_CACHE_DIR, f"{repo_id}.json"), "w") as f:
        json.dump(data, f)
    _graph_cache[repo_id] = data


def _load_graph(repo_id: str) -> dict | None:
    if repo_id in _graph_cache:
        return _graph_cache[repo_id]
    path = os.path.join(_GRAPH_CACHE_DIR, f"{repo_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
        _graph_cache[repo_id] = data
        return data
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(CLONE_DIR, exist_ok=True)
    os.makedirs(_GRAPH_CACHE_DIR, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Atlas", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)


# --- Models ---

class IngestRequest(BaseModel):
    url: str
    force: bool = False

class IngestResponse(BaseModel):
    repo_id: str
    files: int
    chunks: int

class QueryRequest(BaseModel):
    repo_id: str
    question: str

class Citation(BaseModel):
    file: str
    start_line: int
    end_line: int

class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    chunks: list[dict]
    output_hash: str | None = None  # SHA256 hash for deterministic validation

class GraphNode(BaseModel):
    id: str
    label: str
    extension: str
    summary: str = ""
    importance_score: int = 0
    onboarding_reason: str = ""

class GraphEdge(BaseModel):
    source: str
    target: str

class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# --- Endpoints ---

def _sse(event: str, data: dict) -> str:
    """Format a server-sent event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/ingest")
def ingest(req: IngestRequest, _user: User = Depends(get_current_user)):
    """Clone a repo, chunk files, embed, AI-analyze — streamed via SSE."""

    def generate() -> Generator[str, None, None]:
        # Check cache: skip full pipeline if already ingested
        rid = repo_id_from_url(req.url)
        cached = _load_graph(rid)
        if not req.force and cached and cached.get("file_analyses") and collection_has_data(rid):
            yield _sse("progress", {"step": "pathing", "message": "Using cached analysis"})
            yield _sse("done", {
                "repo_id": rid,
                "files": len(cached.get("files", [])),
                "chunks": 0,
                "cached": True,
            })
            return

        # Step 1: Clone
        yield _sse("progress", {"step": "cloning", "message": "Cloning repository..."})
        try:
            repo_id, local_path = clone_repo(req.url)
        except Exception as e:
            yield _sse("error", {"message": f"Failed to clone repo: {e}"})
            return

        # Step 2: Scan files
        yield _sse("progress", {"step": "scanning", "message": "Scanning files..."})
        files = walk_files(local_path)
        all_chunks = []
        for f in files:
            all_chunks.extend(chunk_file(local_path, f))
        yield _sse("progress", {"step": "scanning", "message": f"Found {len(files)} files, {len(all_chunks)} chunks"})

        # Step 3: Embed
        yield _sse("progress", {"step": "embedding", "message": "Generating embeddings..."})
        try:
            store_chunks(repo_id, all_chunks)
        except Exception as e:
            yield _sse("error", {"message": f"Embedding failed: {e}"})
            return

        # Step 4: Dependency graph
        yield _sse("progress", {"step": "graphing", "message": "Mapping dependencies..."})
        edges = extract_edges(local_path, files)

        # Step 5: AI analysis
        yield _sse("progress", {"step": "analyzing", "message": "AI is analyzing files... this takes 30–60 seconds"})
        try:
            file_analyses = analyze_repo_files(files, local_path)
        except Exception:
            file_analyses = {}

        # Step 6: Onboarding path
        yield _sse("progress", {"step": "pathing", "message": "Generating onboarding path..."})
        try:
            onboarding_path = generate_onboarding_path(file_analyses, edges)
        except Exception:
            onboarding_path = []

        _save_graph(repo_id, {
            "files": files,
            "edges": edges,
            "root": local_path,
            "file_analyses": file_analyses,
            "onboarding_path": onboarding_path,
        })

        # Final result
        yield _sse("done", {"repo_id": repo_id, "files": len(files), "chunks": len(all_chunks)})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/graph/{repo_id}", response_model=GraphResponse)
def graph(repo_id: str, important_only: bool = True, _user: User = Depends(get_current_user)):
    """Return file nodes + import edges for the repo."""
    data = _load_graph(repo_id)
    if not data:
        repo_path = os.path.join(CLONE_DIR, repo_id)
        if os.path.isdir(repo_path):
            files = walk_files(repo_path)
            edges = extract_edges(repo_path, files)
            data = {"files": files, "edges": edges, "root": repo_path}
            _save_graph(repo_id, data)
        else:
            raise HTTPException(404, "Repo not found. Ingest it first.")

    analyses = data.get("file_analyses", {})
    file_list = data["files"]

    # Filter to important files if analyses exist and flag is set
    if important_only and analyses:
        file_list = [f for f in file_list if analyses.get(f, {}).get("importance_score", 0) >= IMPORTANCE_THRESHOLD]
        if not file_list:
            # Fallback: show top 15 by score
            scored = sorted(data["files"], key=lambda f: analyses.get(f, {}).get("importance_score", 0), reverse=True)
            file_list = scored[:15]

    file_set = set(file_list)
    nodes = []
    for f in file_list:
        ext = os.path.splitext(f)[1]
        a = analyses.get(f, {})
        nodes.append(GraphNode(
            id=f,
            label=os.path.basename(f),
            extension=ext,
            summary=a.get("summary", ""),
            importance_score=a.get("importance_score", 0),
            onboarding_reason=a.get("onboarding_reason", ""),
        ))

    edges = [
        GraphEdge(source=e["source"], target=e["target"])
        for e in data["edges"]
        if e["source"] in file_set and e["target"] in file_set
    ]
    return GraphResponse(nodes=nodes, edges=edges)


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest, _user: User = Depends(get_current_user)):
    """RAG: retrieve relevant chunks → generate answer with citations."""
    try:
        chunks = query_chunks(req.repo_id, req.question)
    except Exception as e:
        raise HTTPException(500, f"Retrieval failed: {e}")

    if not chunks:
        return QueryResponse(answer="No relevant code found for your question.", citations=[], chunks=[])

    try:
        result = generate_answer(req.question, chunks)
    except Exception as e:
        raise HTTPException(500, f"LLM generation failed: {e}")

    # Generate deterministic hash for validation
    output_hash = hash_output(result)

    return QueryResponse(
        answer=result["answer"],
        citations=[Citation(**c) for c in result["citations"]],
        chunks=result["chunks"],
        output_hash=output_hash,
    )


@app.get("/onboarding/{repo_id}")
def onboarding(repo_id: str, _user: User = Depends(get_current_user)):
    """Return the guided onboarding walkthrough path."""
    data = _load_graph(repo_id)
    if not data:
        raise HTTPException(404, "Repo not found. Ingest it first.")
    return {"steps": data.get("onboarding_path", [])}


@app.get("/github/repos")
def github_repos(user: User = Depends(get_current_user)):
    """Fetch the authenticated user's GitHub repositories."""
    if not user.github_access_token:
        raise HTTPException(400, "No GitHub token. Please log in with GitHub.")
    try:
        resp = httpx.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"Bearer {user.github_access_token}", "Accept": "application/vnd.github+json"},
            params={"sort": "updated", "per_page": 50, "affiliation": "owner,collaborator,organization_member"},
            timeout=10.0,  # 10 second timeout to prevent hanging
        )
    except httpx.TimeoutException:
        raise HTTPException(504, "GitHub API request timed out. Please try again.")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Failed to connect to GitHub: {e}")
    
    if resp.status_code != 200:
        raise HTTPException(502, f"Failed to fetch repos from GitHub: {resp.status_code}")
    repos = resp.json()
    return [
        {
            "full_name": r["full_name"],
            "name": r["name"],
            "description": r.get("description") or "",
            "html_url": r["html_url"],
            "clone_url": r["clone_url"],
            "updated_at": r["updated_at"],
            "language": r.get("language") or "",
            "private": r["private"],
        }
        for r in repos
    ]


@app.get("/source/{repo_id}")
def get_source(repo_id: str, file: str, start: int = 1, end: int = -1, _user: User = Depends(get_current_user)):
    """Return source lines for a file in the repo."""
    data = _load_graph(repo_id)
    repo_path = data["root"] if data else os.path.join(CLONE_DIR, repo_id)
    if not os.path.isdir(repo_path):
        raise HTTPException(404, "Repo not found.")
    full = os.path.join(repo_path, file)
    if not os.path.isfile(full):
        raise HTTPException(404, "File not found.")
    with open(full, "r", errors="replace") as f:
        lines = f.readlines()
    if end == -1:
        end = len(lines)
    return {"file": file, "start": start, "end": end, "lines": lines[start - 1 : end]}


class DeterminismTestRequest(BaseModel):
    repo_id: str
    question: str
    num_runs: int = 3  # Number of times to run the query


@app.post("/query/test-determinism")
def test_determinism(req: DeterminismTestRequest, user: User = Depends(get_current_user)):
    """Test that RAG outputs are deterministic by running the same query multiple times."""
    outputs = []
    hashes = []
    chunk_hashes = []  # Track if chunks are the same
    
    for i in range(req.num_runs):
        try:
            chunks = query_chunks(req.repo_id, req.question)
            if not chunks:
                return {"deterministic": False, "error": "No chunks found", "runs": []}
            
            # Hash the chunks to verify retrieval is deterministic
            import hashlib
            import json
            # Sort chunks deterministically before hashing
            chunk_ids = sorted([(c["file"], c["start_line"], c["end_line"]) for c in chunks])
            chunk_data = json.dumps(chunk_ids, sort_keys=True)
            chunk_hashes.append(hashlib.sha256(chunk_data.encode()).hexdigest())
            
            result = generate_answer(req.question, chunks)
            output_hash = hash_output(result)
            outputs.append(result)
            hashes.append(output_hash)
        except Exception as e:
            return {"deterministic": False, "error": str(e), "runs": []}
    
    is_deterministic, error_msg = validate_deterministic(outputs)
    
    # Check if chunks are the same across runs
    unique_chunk_hashes = len(set(chunk_hashes))
    chunks_deterministic = unique_chunk_hashes == 1
    
    # Get the chunks from the first run (they should all be the same)
    sample_chunks = outputs[0]["chunks"] if outputs else []
    
    return {
        "deterministic": is_deterministic,
        "error": error_msg,
        "num_runs": req.num_runs,
        "unique_hashes": len(set(hashes)),
        "hashes": hashes,
        "chunks_deterministic": chunks_deterministic,
        "unique_chunk_hashes": unique_chunk_hashes,
        "chunk_hashes": chunk_hashes,
        "answers": [out["answer"] for out in outputs],  # Show actual answers for debugging
        "chunks": sample_chunks,  # Show retrieved chunks (should be same across all runs)
        "sample_output": outputs[0] if outputs else None,
    }
