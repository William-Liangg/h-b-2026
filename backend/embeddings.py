"""Embedding + ChromaDB storage layer."""

import chromadb
from chromadb.config import Settings
from openai import OpenAI

from config import CHROMA_DIR, EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL, OPENAI_API_KEY

_openai = OpenAI(api_key=OPENAI_API_KEY)
_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))


def get_collection(repo_id: str):
    return _client.get_or_create_collection(name=f"repo_{repo_id}", metadata={"hnsw:space": "cosine"})


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
    """Retrieve top-k chunks relevant to a query."""
    coll = get_collection(repo_id)
    q_emb = embed_texts([query])[0]
    results = coll.query(query_embeddings=[q_emb], n_results=n_results, include=["documents", "metadatas"])
    out = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        out.append({"text": doc, "file": meta["file"], "start_line": meta["start_line"], "end_line": meta["end_line"]})
    return out
