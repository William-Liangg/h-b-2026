import os
from dotenv import load_dotenv

load_dotenv(".env.local")

CLONE_DIR = os.path.join(os.path.dirname(__file__), ".repos")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), ".chroma")

SKIP_DIRS = {"node_modules", ".git", "build", "dist", "__pycache__", ".venv", "venv", ".next", ".nuxt", "vendor", "target"}

CODE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".rb",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
    ".vue", ".svelte", ".html", ".css", ".scss", ".sql", ".sh",
    ".yaml", ".yml", ".toml", ".json", ".md", ".txt",
}

CHUNK_SIZE = 80  # lines per chunk
CHUNK_OVERLAP = 10
EMBEDDING_BATCH_SIZE = 100
EMBEDDING_MODEL = "text-embedding-3-small"
CLAUDE_MODEL = "claude-sonnet-4-20250514"
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.0"))  # 0.0 for deterministic outputs

# Onboarding / importance scoring
IMPORTANCE_THRESHOLD = 6          # files scoring >= this are "important"
ANALYSIS_BATCH_SIZE = 12          # files per Claude call for analysis
ANALYSIS_MAX_LINES = 150          # max lines to read per file for analysis

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atlas.db")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
