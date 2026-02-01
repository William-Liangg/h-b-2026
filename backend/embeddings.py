"""Embedding + ChromaDB storage layer."""

import chromadb
from chromadb.config import Settings
from openai import OpenAI

from config import CHROMA_DIR, EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL, OPENAI_API_KEY

_openai = OpenAI(api_key=OPENAI_API_KEY)
_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))


def get_collection(repo_id: str):
    return _client.get_or_create_collection(name=f"repo_{repo_id}", metadata={"hnsw:space": "cosine"})


def collection_has_data(repo_id: str) -> bool:
    """Check if a Chroma collection exists and has documents."""
    try:
        coll = _client.get_collection(name=f"repo_{repo_id}")
        return coll.count() > 0
    except Exception:
        return False


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embed texts respecting rate limits."""
    all_embeddings = []
    for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[i : i + EMBEDDING_BATCH_SIZE]
        resp = _openai.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        all_embeddings.extend([d.embedding for d in resp.data])
    return all_embeddings


def store_chunks(repo_id: str, chunks: list[dict]):
    """Embed and store chunks in ChromaDB."""
    if not chunks:
        return
    coll = get_collection(repo_id)
    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)
    ids = [f"{repo_id}_{i}" for i in range(len(chunks))]
    metadatas = [{"file": c["file"], "start_line": c["start_line"], "end_line": c["end_line"]} for c in chunks]
    # Upsert in batches (Chroma limit ~5461)
    batch = 5000
    for i in range(0, len(ids), batch):
        coll.upsert(
            ids=ids[i : i + batch],
            documents=texts[i : i + batch],
            embeddings=embeddings[i : i + batch],
            metadatas=metadatas[i : i + batch],
        )


def query_chunks(repo_id: str, query: str, n_results: int = 8) -> list[dict]:
    """Retrieve top-k chunks relevant to a query.
    
    Returns chunks sorted deterministically by (file, start_line, end_line).
    This ensures consistent ordering for deterministic RAG outputs.
    """
    coll = get_collection(repo_id)
    q_emb = embed_texts([query])[0]
    results = coll.query(query_embeddings=[q_emb], n_results=n_results, include=["documents", "metadatas", "distances"])
    out = []
    for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
        out.append({
            "text": doc,
            "file": meta["file"],
            "start_line": meta["start_line"],
            "end_line": meta["end_line"],
            "distance": float(dist),  # Include distance for tie-breaking
        })
    
    # Sort deterministically: by distance (best match first), then by file path, then by line numbers
    # Round distances to avoid floating-point precision issues that could cause non-deterministic ordering
    # This ensures consistent ordering even when multiple chunks have the same similarity score
    for chunk in out:
        chunk["distance"] = round(chunk["distance"], 6)  # Round to 6 decimal places
    
    out.sort(key=lambda c: (c["distance"], c["file"], c["start_line"], c["end_line"]))
    
    # Remove distance from output (internal use only)
    for chunk in out:
        chunk.pop("distance", None)
    
    return out
