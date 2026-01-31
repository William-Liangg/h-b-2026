// Mock data for frontend development - bypass slow API calls

export const MOCK_REPO_ID = 'mock-repo-123'

export const mockGraphData = {
  nodes: [
    { id: 'main.py', label: 'main.py', extension: '.py', summary: 'FastAPI application entry point. Defines all API routes and middleware.', importance_score: 10, onboarding_reason: 'Start here - this is the central hub of the application' },
    { id: 'config.py', label: 'config.py', extension: '.py', summary: 'Configuration and environment variables. Loads settings from .env file.', importance_score: 8, onboarding_reason: 'Understand app configuration before diving into features' },
    { id: 'auth.py', label: 'auth.py', extension: '.py', summary: 'Authentication routes and JWT handling. Includes GitHub OAuth flow.', importance_score: 9, onboarding_reason: 'Core security layer - handles all user authentication' },
    { id: 'database.py', label: 'database.py', extension: '.py', summary: 'SQLAlchemy models and database session management.', importance_score: 8, onboarding_reason: 'Data layer - defines User model and DB connections' },
    { id: 'parser.py', label: 'parser.py', extension: '.py', summary: 'Repository cloning, file walking, and code chunking logic.', importance_score: 7, onboarding_reason: 'Handles repo ingestion pipeline' },
    { id: 'embeddings.py', label: 'embeddings.py', extension: '.py', summary: 'OpenAI embeddings and ChromaDB vector storage.', importance_score: 7, onboarding_reason: 'Vector search infrastructure' },
    { id: 'llm.py', label: 'llm.py', extension: '.py', summary: 'Claude API integration for RAG answers and file analysis.', importance_score: 8, onboarding_reason: 'AI brain - generates answers and analyzes code' },
    { id: 'frontend/src/App.jsx', label: 'App.jsx', extension: '.jsx', summary: 'Main React component. Orchestrates routing and state.', importance_score: 9, onboarding_reason: 'Frontend entry point' },
    { id: 'frontend/src/components/GraphPanel.jsx', label: 'GraphPanel.jsx', extension: '.jsx', summary: 'React Flow visualization of file dependencies.', importance_score: 7, onboarding_reason: 'Interactive graph component' },
    { id: 'frontend/src/components/ChatPanel.jsx', label: 'ChatPanel.jsx', extension: '.jsx', summary: 'Chat interface for asking questions about the codebase.', importance_score: 7, onboarding_reason: 'User interaction point' },
    { id: 'frontend/src/auth.jsx', label: 'auth.jsx', extension: '.jsx', summary: 'Auth context and token management for frontend.', importance_score: 6, onboarding_reason: 'Frontend auth utilities' },
    { id: 'utils/helpers.py', label: 'helpers.py', extension: '.py', summary: 'Utility functions used across the codebase.', importance_score: 4, onboarding_reason: '' },
  ],
  edges: [
    { source: 'main.py', target: 'config.py' },
    { source: 'main.py', target: 'auth.py' },
    { source: 'main.py', target: 'database.py' },
    { source: 'main.py', target: 'parser.py' },
    { source: 'main.py', target: 'embeddings.py' },
    { source: 'main.py', target: 'llm.py' },
    { source: 'auth.py', target: 'config.py' },
    { source: 'auth.py', target: 'database.py' },
    { source: 'database.py', target: 'config.py' },
    { source: 'embeddings.py', target: 'config.py' },
    { source: 'llm.py', target: 'config.py' },
    { source: 'parser.py', target: 'config.py' },
    { source: 'frontend/src/App.jsx', target: 'frontend/src/auth.jsx' },
    { source: 'frontend/src/App.jsx', target: 'frontend/src/components/GraphPanel.jsx' },
    { source: 'frontend/src/App.jsx', target: 'frontend/src/components/ChatPanel.jsx' },
  ],
}

export const mockOnboardingSteps = [
  {
    file: 'main.py',
    summary: 'FastAPI application entry point. Defines all API routes including /ingest, /graph, /query, and /onboarding endpoints.',
    reason: 'Start here to understand the overall API structure and how requests flow through the system.',
    responsibilities: [
      'Initialize FastAPI app with CORS middleware',
      'Define request/response models',
      'Implement core API endpoints',
      'Handle authentication via dependency injection',
    ],
    key_exports: ['app', 'IngestRequest', 'QueryRequest', 'GraphResponse'],
    dependencies: ['config.py', 'auth.py', 'database.py', 'parser.py', 'embeddings.py', 'llm.py'],
    subNodes: [
      { label: '/ingest endpoint', type: 'API Route' },
      { label: '/graph endpoint', type: 'API Route' },
      { label: '/query endpoint', type: 'API Route' },
      { label: 'CORS Middleware', type: 'Concept' },
      { label: 'Dependency Injection', type: 'Pattern' },
    ],
  },
  {
    file: 'config.py',
    summary: 'Central configuration module. Loads environment variables and defines constants used throughout the app.',
    reason: 'Understanding configuration helps you know what external services are used and how they connect.',
    responsibilities: [
      'Load environment variables from .env',
      'Define file paths (CLONE_DIR, CHROMA_DIR)',
      'Set chunking parameters',
      'Configure API keys and model names',
    ],
    key_exports: ['CLONE_DIR', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CHUNK_SIZE'],
    dependencies: [],
    subNodes: [
      { label: 'Environment Variables', type: 'Concept' },
      { label: 'dotenv Loading', type: 'Pattern' },
      { label: 'API Keys', type: 'Secret' },
    ],
  },
  {
    file: 'auth.py',
    summary: 'Authentication and authorization. Handles user signup, login, JWT tokens, and GitHub OAuth flow.',
    reason: 'Security is critical - understand how users are authenticated before accessing protected endpoints.',
    responsibilities: [
      'Hash and verify passwords with bcrypt',
      'Create and validate JWT tokens',
      'Implement GitHub OAuth callback',
      'Provide get_current_user dependency',
    ],
    key_exports: ['router', 'get_current_user', 'create_token', 'verify_password'],
    dependencies: ['config.py', 'database.py'],
    subNodes: [
      { label: 'JWT Tokens', type: 'Concept' },
      { label: 'bcrypt Hashing', type: 'Library' },
      { label: 'GitHub OAuth', type: 'Integration' },
      { label: 'Password Flow', type: 'Flow' },
    ],
  },
  {
    file: 'database.py',
    summary: 'Database models and session management using SQLAlchemy with SQLite.',
    reason: 'The User model is central to auth - see how user data is structured and persisted.',
    responsibilities: [
      'Define SQLAlchemy engine and session',
      'Declare User model with fields',
      'Provide database migration helper',
      'Yield database sessions for requests',
    ],
    key_exports: ['User', 'get_db', 'init_db', 'SessionLocal'],
    dependencies: ['config.py'],
    subNodes: [
      { label: 'User Model', type: 'Model' },
      { label: 'SQLAlchemy ORM', type: 'Library' },
      { label: 'Session Management', type: 'Pattern' },
    ],
  },
  {
    file: 'parser.py',
    summary: 'Repository processing pipeline. Clones repos, walks files, chunks code, and extracts import dependencies.',
    reason: 'Core ingestion logic - this is how repos get processed before embedding.',
    responsibilities: [
      'Clone GitHub repos with GitPython',
      'Walk directory tree filtering by extensions',
      'Split files into overlapping chunks',
      'Parse imports to build dependency graph',
    ],
    key_exports: ['clone_repo', 'walk_files', 'chunk_file', 'extract_edges'],
    dependencies: ['config.py'],
    subNodes: [
      { label: 'GitPython Clone', type: 'Library' },
      { label: 'Chunking Strategy', type: 'Algorithm' },
      { label: 'Import Parsing', type: 'Algorithm' },
      { label: 'File Filtering', type: 'Logic' },
    ],
  },
  {
    file: 'embeddings.py',
    summary: 'Vector embeddings and semantic search. Uses OpenAI for embeddings and ChromaDB for storage.',
    reason: 'RAG foundation - embeddings enable semantic code search for answering questions.',
    responsibilities: [
      'Generate embeddings via OpenAI API',
      'Store chunks in ChromaDB collections',
      'Query similar chunks by cosine similarity',
      'Batch processing for rate limits',
    ],
    key_exports: ['store_chunks', 'query_chunks', 'collection_has_data'],
    dependencies: ['config.py'],
    subNodes: [
      { label: 'OpenAI Embeddings', type: 'API' },
      { label: 'ChromaDB Storage', type: 'Database' },
      { label: 'Cosine Similarity', type: 'Algorithm' },
      { label: 'Batch Processing', type: 'Pattern' },
    ],
  },
  {
    file: 'llm.py',
    summary: 'LLM integration with Claude. Generates grounded answers with citations and analyzes files.',
    reason: 'The AI brain - see how prompts are structured and responses parsed.',
    responsibilities: [
      'Format context chunks for Claude',
      'Generate answers with file:line citations',
      'Analyze files for importance scoring',
      'Create onboarding path from analyses',
    ],
    key_exports: ['generate_answer', 'analyze_repo_files', 'generate_onboarding_path'],
    dependencies: ['config.py'],
    subNodes: [
      { label: 'Claude API', type: 'API' },
      { label: 'Prompt Engineering', type: 'Pattern' },
      { label: 'Citation Parsing', type: 'Algorithm' },
      { label: 'Importance Scoring', type: 'Feature' },
    ],
  },
]

export const mockRepos = [
  { full_name: 'user/atlas', name: 'atlas', description: 'RAG-powered GitHub repository analyzer', html_url: 'https://github.com/user/atlas', clone_url: 'https://github.com/user/atlas.git', updated_at: new Date().toISOString(), language: 'Python', private: false },
  { full_name: 'user/react-app', name: 'react-app', description: 'A sample React application', html_url: 'https://github.com/user/react-app', clone_url: 'https://github.com/user/react-app.git', updated_at: new Date(Date.now() - 86400000).toISOString(), language: 'JavaScript', private: false },
  { full_name: 'user/api-server', name: 'api-server', description: 'REST API backend with Express', html_url: 'https://github.com/user/api-server', clone_url: 'https://github.com/user/api-server.git', updated_at: new Date(Date.now() - 172800000).toISOString(), language: 'TypeScript', private: true },
  { full_name: 'user/ml-pipeline', name: 'ml-pipeline', description: 'Machine learning data pipeline', html_url: 'https://github.com/user/ml-pipeline', clone_url: 'https://github.com/user/ml-pipeline.git', updated_at: new Date(Date.now() - 604800000).toISOString(), language: 'Python', private: false },
]

export const mockSourceView = {
  file: 'main.py',
  start: 1,
  end: 25,
  lines: [
    '"""Atlas — FastAPI backend."""\n',
    '\n',
    'import json\n',
    'import os\n',
    'from contextlib import asynccontextmanager\n',
    'from typing import Generator\n',
    '\n',
    'import httpx\n',
    'from fastapi import Depends, FastAPI, HTTPException, Request\n',
    'from fastapi.middleware.cors import CORSMiddleware\n',
    'from fastapi.responses import StreamingResponse\n',
    'from pydantic import BaseModel\n',
    '\n',
    'from auth import get_current_user, router as auth_router\n',
    'from config import CLONE_DIR, IMPORTANCE_THRESHOLD\n',
    'from database import User, init_db\n',
    'from embeddings import query_chunks, store_chunks\n',
    'from llm import analyze_repo_files, generate_answer\n',
    'from parser import chunk_file, clone_repo, extract_edges\n',
    '\n',
    '# Disk-backed graph cache\n',
    '_GRAPH_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".graph_cache")\n',
    '_graph_cache: dict[str, dict] = {}\n',
    '\n',
    '\n',
  ],
}

export const mockQueryResponse = {
  answer: 'The authentication system uses JWT tokens for session management. When a user logs in via `auth.py`, the `create_token` function generates a JWT containing the user ID and email [auth.py:35-42]. This token is then validated on each request using the `get_current_user` dependency [auth.py:44-59].\n\nFor GitHub OAuth, the flow starts at `/auth/github` which redirects to GitHub, and the callback at `/auth/github/callback` exchanges the code for an access token [auth.py:101-169].',
  citations: [
    { file: 'auth.py', start_line: 35, end_line: 42 },
    { file: 'auth.py', start_line: 44, end_line: 59 },
    { file: 'auth.py', start_line: 101, end_line: 169 },
  ],
  chunks: [
    {
      file: 'auth.py',
      start_line: 35,
      end_line: 42,
      text: 'def create_token(user_id: int, email: str) -> str:\n    """Create a JWT token for a user."""\n    payload = {\n        "sub": str(user_id),\n        "email": email,\n        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),\n    }\n    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)'
    },
    {
      file: 'auth.py',
      start_line: 44,
      end_line: 59,
      text: 'def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:\n    """Validate JWT and return current user."""\n    try:\n        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])\n        user_id = int(payload["sub"])\n        user = db.query(User).filter(User.id == user_id).first()\n        if not user:\n            raise HTTPException(401, "User not found")\n        return user\n    except jwt.InvalidTokenError:\n        raise HTTPException(401, "Invalid token")'
    },
    {
      file: 'auth.py',
      start_line: 101,
      end_line: 169,
      text: '@router.get("/github")\ndef github_oauth():\n    """Redirect to GitHub OAuth."""\n    return RedirectResponse(\n        f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=read:user user:email"\n    )\n\n@router.get("/github/callback")\nasync def github_callback(code: str, db: Session = Depends(get_db)):\n    """Handle GitHub OAuth callback."""\n    async with httpx.AsyncClient() as client:\n        # Exchange code for access token\n        token_resp = await client.post(\n            "https://github.com/login/oauth/access_token",\n            data={\n                "client_id": GITHUB_CLIENT_ID,\n                "client_secret": GITHUB_CLIENT_SECRET,\n                "code": code,\n            },\n            headers={"Accept": "application/json"},\n            timeout=10.0,\n        )\n        token_data = token_resp.json()\n        access_token = token_data.get("access_token")\n        \n        # Get user info\n        user_resp = await client.get(\n            "https://api.github.com/user",\n            headers={"Authorization": f"Bearer {access_token}"},\n            timeout=10.0,\n        )\n        user_data = user_resp.json()\n        \n        # Create or update user\n        user = db.query(User).filter(User.email == user_data["email"]).first()\n        if not user:\n            user = User(email=user_data["email"], github_username=user_data["login"])\n            db.add(user)\n            db.commit()\n        \n        token = create_token(user.id, user.email)\n        return {"access_token": token, "token_type": "bearer"}'
    },
    {
      file: 'auth.py',
      start_line: 20,
      end_line: 30,
      text: 'from fastapi import Depends, HTTPException\nfrom fastapi.security import OAuth2PasswordBearer\nfrom sqlalchemy.orm import Session\nimport jwt\nfrom datetime import datetime, timedelta\n\nfrom config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS\nfrom database import User, get_db'
    },
  ],
}
