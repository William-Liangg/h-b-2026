"""Launch uvicorn with .repos/.chroma/.graph_cache excluded from file watching."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_excludes=[".repos/**", ".chroma/**", ".graph_cache/**"],
    )
