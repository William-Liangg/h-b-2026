# Atlas — Developer Onboarding Tool

## Product Vision

Atlas is an **onboarding tool for new developers** joining a codebase. Instead of reading every file or relying on stale documentation, a new team member ingests a GitHub repo and receives an AI-powered guided walkthrough of the most important parts — entry points, core logic, config, and key modules — presented in a logical reading order through an interactive dependency graph.

## Core Features

### 1. Importance Scoring & Filtering

Not every file matters for onboarding. Atlas uses Claude to analyze each file and assign an **importance score (0–10)**:

| Score | Category | Examples |
|-------|----------|---------|
| 9–10 | Entry points | `main.py`, `index.ts`, `app.py`, `server.py` |
| 7–8 | Core logic | API routes, state management, key models |
| 5–6 | Shared utilities | Middleware, helpers used across many files |
| 3–4 | Isolated features | Individual components, secondary helpers |
| 1–2 | Low priority | Tests, type declarations, minor configs |
| 0 | Skip | Empty files, lockfiles, auto-generated code |

The graph view filters to files scoring **≥ 6** by default (configurable via `IMPORTANCE_THRESHOLD`). Higher-scored nodes appear larger and bolder.

### 2. AI-Generated File Summaries

During ingest, Claude analyzes each file (first 150 lines) and produces:

- **Summary**: 1–2 sentence description of what the file does
- **Responsibilities**: 2–4 key things the file handles
- **Key exports**: Important functions, classes, or modules
- **Onboarding reason**: Why a new developer should (or shouldn't) read this file

Summaries appear as **hover tooltips** on graph nodes and in the walkthrough panel.

### 3. Guided Onboarding Walkthrough

After ingest, Atlas presents a **linked-list reading path** through the codebase:

1. Start at the entry point (e.g., `main.py`)
2. Follow to core dependencies (routers, models, config)
3. End at utilities and helpers

The walkthrough panel includes:
- Current file name, AI summary, and why it matters
- Key responsibilities and exports
- Previous/Next navigation with step dots
- Progress bar showing walkthrough completion
- Each step highlights the corresponding node in the graph

### 4. Semantic Dependency Graph

The graph view shows only important files with:
- Color-coded nodes by file extension
- Import/dependency edges filtered to visible nodes
- Node size and weight scaled by importance score
- Hover tooltips with AI summaries and scores
- Click-to-view full source code

### 5. RAG-Powered Q&A (Ask Atlas)

Users can ask natural-language questions about the codebase:
- Semantic search over embedded code chunks
- Claude generates grounded answers with `[file:start-end]` citations
- Clicking citations opens the source viewer and highlights graph nodes

## Architecture

```
frontend (React + Vite :5173)  →  proxy  →  backend (FastAPI :8000)
                                                ├── GitPython (clone)
                                                ├── OpenAI (embeddings)
                                                ├── ChromaDB (vector store)
                                                └── Anthropic Claude (answers + analysis)
```

## Technical Approach

### Ingest Pipeline

```
POST /ingest
  └─ clone_repo()                  # Shallow clone via GitPython
  └─ walk_files()                  # Filter by extensions, skip build dirs
  └─ chunk_file()                  # 80-line chunks, 10-line overlap
  └─ store_chunks()                # OpenAI embeddings → ChromaDB
  └─ extract_edges()               # Regex-based import parsing
  └─ analyze_repo_files()          # Claude: importance scores + summaries
  └─ generate_onboarding_path()    # Claude: ordered reading path
  └─ _save_graph()                 # Persist all data to disk cache
```

### How Files Are Scored

`analyze_repo_files()` in `backend/llm.py`:
- Reads first 150 lines of each file (token-efficient)
- Batches 12 files per Claude API call
- System prompt enforces structured JSON output with scoring criteria
- Fallback: assigns score 3 and "Analysis unavailable" if a batch fails

### How the Onboarding Path Is Determined

`generate_onboarding_path()` in `backend/llm.py`:
- Filters to files with importance score ≥ threshold
- Provides Claude with file summaries + dependency edge list
- Claude returns an ordered reading path with reasons for each position
- Fallback: sorts by importance descending if Claude call fails

### How Summaries Are Generated

Each file analysis includes structured data returned as JSON from Claude:
```json
{
  "importance_score": 9,
  "summary": "FastAPI application entry point that defines all API endpoints.",
  "responsibilities": ["Request routing", "Middleware setup", "Endpoint definitions"],
  "key_exports": ["app", "ingest", "query"],
  "onboarding_reason": "Start here — this is where the app boots and all routes are defined."
}
```

### Storage

All analysis data persists in `.graph_cache/{repo_id}.json` alongside existing graph data — no additional database tables required.

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /ingest` | Clone, chunk, embed, analyze, generate path |
| `GET /graph/{repo_id}?important_only=true` | Filtered graph with summaries |
| `GET /onboarding/{repo_id}` | Ordered walkthrough steps |
| `POST /query` | RAG Q&A with citations |
| `GET /source/{repo_id}?file=&start=&end=` | Source code viewer |
| `GET /github/repos` | User's GitHub repositories |

### Frontend Layout (Post-Ingest)

```
┌───────────────────────────────────────────────────────────┐
│ ATLAS │ [URL input] [Analyze]               │ user│Logout │
├────────────┬──────────────────────┬───────────────────────┤
│ Walkthrough │    Graph Panel       │     Chat Panel        │
│ (w-72)      │    (flex-1)          │     (w-400)           │
│             │                      │                       │
│ Step 3/12   │  [important nodes    │  Ask Atlas...         │
│ main.py     │   with hover         │                       │
│ Summary...  │   tooltips]          │                       │
│ Reason...   │                      │                       │
│             │                      ├───────────────────────┤
│ [Prev][Next]│                      │  Source Panel          │
└─────────────┴──────────────────────┴───────────────────────┘
```

## Running

```bash
# Backend
cd backend && pip install -r requirements.txt
# Set env vars in .env.local: OPENAI_API_KEY, ANTHROPIC_API_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
python run.py

# Frontend
cd frontend && npm install && npm run dev
```

## Key Design Decisions

- **Importance filtering** — graph shows ~30-50% of files, not the full tree
- **Claude for analysis** — semantic understanding, not just file tree heuristics
- **Batch processing** — 12 files per Claude call balances throughput vs token limits
- **First 150 lines** — captures imports, class definitions, and module-level code without excessive tokens
- **Graph cache storage** — no new DB tables; JSON file per repo is simple and works
- **Guided path** — Claude understands dependency flow better than a simple sort
- **Hover tooltips** — summaries visible without leaving the graph view
- **Shallow clone** (`depth=1`) — minimizes clone time and disk usage
- **Line-based chunking** — enables precise file:line citations
- **Cosine similarity** — ChromaDB semantic search for Q&A
