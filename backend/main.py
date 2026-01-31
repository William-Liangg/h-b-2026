"""Atlas — FastAPI backend."""

import json
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth import get_current_user, router as auth_router
from config import CLONE_DIR
from database import User, init_db
from embeddings import query_chunks, store_chunks
from llm import generate_answer
from parser import chunk_file, clone_repo, extract_edges, repo_id_from_url, walk_files

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

class GraphNode(BaseModel):
    id: str
    label: str
    extension: str

class GraphEdge(BaseModel):
    source: str
    target: str

class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# --- Endpoints ---

@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest, _user: User = Depends(get_current_user)):
    """Clone a repo, chunk files, embed, and store."""
    try:
        repo_id, local_path = clone_repo(req.url)
    except Exception as e:
        raise HTTPException(400, f"Failed to clone repo: {e}")

    files = walk_files(local_path)
    all_chunks = []
    for f in files:
        all_chunks.extend(chunk_file(local_path, f))

    try:
        store_chunks(repo_id, all_chunks)
    except Exception as e:
        raise HTTPException(500, f"Embedding/storage failed: {e}")

    # Cache graph data to disk (survives reloads)
    edges = extract_edges(local_path, files)
    _save_graph(repo_id, {"files": files, "edges": edges, "root": local_path})

    return IngestResponse(repo_id=repo_id, files=len(files), chunks=len(all_chunks))


@app.get("/graph/{repo_id}", response_model=GraphResponse)
def graph(repo_id: str, _user: User = Depends(get_current_user)):
    """Return file nodes + import edges for the repo."""
    data = _load_graph(repo_id)
    if not data:
        # Try to rebuild from the cloned repo on disk
        repo_path = os.path.join(CLONE_DIR, repo_id)
        if os.path.isdir(repo_path):
            files = walk_files(repo_path)
            edges = extract_edges(repo_path, files)
            data = {"files": files, "edges": edges, "root": repo_path}
            _save_graph(repo_id, data)
        else:
            raise HTTPException(404, "Repo not found. Ingest it first.")

    nodes = []
    for f in data["files"]:
        ext = os.path.splitext(f)[1]
        nodes.append(GraphNode(id=f, label=os.path.basename(f), extension=ext))

    edges = [GraphEdge(source=e["source"], target=e["target"]) for e in data["edges"]]
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

    return QueryResponse(
        answer=result["answer"],
        citations=[Citation(**c) for c in result["citations"]],
        chunks=result["chunks"],
    )


@app.get("/github/repos")
def github_repos(user: User = Depends(get_current_user)):
    """Fetch the authenticated user's GitHub repositories."""
    if not user.github_access_token:
        raise HTTPException(400, "No GitHub token. Please log in with GitHub.")
    resp = httpx.get(
        "https://api.github.com/user/repos",
        headers={"Authorization": f"Bearer {user.github_access_token}", "Accept": "application/vnd.github+json"},
        params={"sort": "updated", "per_page": 50, "affiliation": "owner,collaborator,organization_member"},
    )
    if resp.status_code != 200:
        raise HTTPException(502, "Failed to fetch repos from GitHub")
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
