# Atlas — RAG-Powered GitHub Repository Analyzer

## What It Does
User pastes a GitHub URL → backend clones and processes the repo → frontend displays an interactive file/dependency graph (React Flow) + chat interface where users ask "Hey Atlas, how does X work?" → returns grounded answers with file:line citations that highlight nodes in the graph.

## Architecture

```
frontend (React + Vite :5173)  →  proxy  →  backend (FastAPI :8000)
                                                ├── GitPython (clone)
                                                ├── OpenAI (embeddings)
                                                ├── ChromaDB (vector store)
                                                └── Anthropic Claude (answers)
```

## Backend (`backend/`)

### `config.py`
All constants: paths, skip dirs, code extensions, chunk params, model names, API keys from env.
- `CLONE_DIR`: `.repos/` — where cloned repos live
- `CHROMA_DIR`: `.chroma/` — persistent ChromaDB storage
- `SKIP_DIRS`: node_modules, .git, build, dist, __pycache__, etc.
- `CODE_EXTENSIONS`: .py, .js, .ts, .tsx, .go, .rs, .java, etc.
- Chunking: 80 lines per chunk, 10-line overlap
- Embedding batch size: 100 (rate limit safety)

### `parser.py`
- `repo_id_from_url(url)` — SHA256 hash truncated to 12 chars
- `clone_repo(url)` — shallow clone via GitPython, returns (repo_id, path)
- `walk_files(root)` — os.walk filtered by SKIP_DIRS and CODE_EXTENSIONS
- `chunk_file(root, rel_path)` — splits file into overlapping line-based chunks with metadata (file, start_line, end_line, text)
- `extract_edges(root, files)` — regex-based import parsing for Python, JS/TS, Go, Rust, Java, Ruby. Resolves relative imports against actual file set. Returns `[{source, target}]` edge list.
- Import resolution tries: direct path, with extensions (.py/.ts/.tsx/.js/.jsx), index files, Python dotted paths

### `embeddings.py`
- Uses OpenAI `text-embedding-3-small`
- ChromaDB persistent client with cosine similarity
- `store_chunks(repo_id, chunks)` — embeds all chunks in batches of 100, upserts to Chroma in batches of 5000
- `query_chunks(repo_id, query, n_results=8)` — embeds query, retrieves top-k chunks with metadata

### `llm.py`
- Uses Anthropic Claude Sonnet (`claude-sonnet-4-20250514`)
- System prompt instructs Atlas to ground answers in provided chunks and cite as `[file:start-end]`
- `generate_answer(question, chunks)` — formats chunks as numbered context, calls Claude, extracts citations via regex from response

### `main.py` — FastAPI App
Four endpoints:
1. **`POST /ingest`** — `{url}` → clone, walk, chunk, embed, store, cache graph → `{repo_id, files, chunks}`
2. **`GET /graph/{repo_id}`** — returns `{nodes: [{id, label, extension}], edges: [{source, target}]}`
3. **`POST /query`** — `{repo_id, question}` → RAG retrieve → Claude answer → `{answer, citations, chunks}`
4. **`GET /source/{repo_id}?file=...&start=...&end=...`** — returns source lines for the viewer

Graph data cached in-memory dict `_graph_cache[repo_id]`.
CORS fully open for dev. Vite proxy handles routing in dev mode.

## Frontend (`frontend/`)

### Tech: React + Vite + Tailwind CSS v4 + @xyflow/react

### `App.jsx` — Main Orchestrator
State: `repoId`, `graphData`, `highlightedFiles`, `sourceView`
- `handleIngested(id)` — after ingest, fetches graph data
- `handleCitations(citations)` — highlights cited files in graph
- `handleNodeClick(fileId)` — fetches full file source for viewer
- `handleCitationClick(citation)` — fetches cited line range + highlights node

Layout: full-height flex column
- Top: IngestBar
- Below: 50/50 split — left: GraphPanel, right: ChatPanel + SourcePanel

### `components/IngestBar.jsx`
URL input + "Analyze" button. Shows loading state and result summary (X files, Y chunks).

### `components/GraphPanel.jsx`
- Converts API nodes to React Flow nodes with grid layout grouped by directory
- Color-coded by file extension (Python=blue, JS=yellow, TS=blue, Go=cyan, Rust=orange, etc.)
- Highlighted files get cyan glow + scale(1.1) via boxShadow
- Click node → triggers source viewer

### `components/ChatPanel.jsx`
- Message list with user/assistant roles
- Parses `[file:start-end]` citations in answers into clickable buttons
- Clicking citation → opens source viewer + highlights graph node
- Loading state with "Atlas is thinking..." pulse animation

### `components/SourcePanel.jsx`
- Shows file path + line range in header
- Renders source lines with line numbers
- Close button to dismiss

## Running

```bash
# Backend
cd backend && pip install -r requirements.txt
export OPENAI_API_KEY=... ANTHROPIC_API_KEY=...
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Key Design Decisions
- **Shallow clone** (`depth=1`) to minimize clone time and disk usage
- **Line-based chunking** (not token-based) for precise file:line citations
- **Overlap of 10 lines** ensures functions split across chunk boundaries still have context
- **Cosine similarity** in ChromaDB for semantic search
- **8 chunks retrieved** per query — enough context without overwhelming Claude's prompt
- **Regex-based import parsing** — no AST needed, works across languages, fast
- **In-memory graph cache** — graph data is lightweight, avoids re-parsing on every request
- **Vite dev proxy** — no CORS config needed in development
- **Citation format `[file:start-end]`** — parseable by both frontend and humans
