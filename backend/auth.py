"""Authentication routes and utilities."""

from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from config import (
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRY_HOURS,
    JWT_SECRET,
)
from database import User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),  # Convert to string for JWT compatibility
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Dependency that extracts and validates the JWT from the Authorization header."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid token")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    # Convert sub back to integer for database query
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")
    return user


# --- Request / Response models ---

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    email: str


# --- Routes ---

@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(409, "Email already registered")
    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_token(user.id, user.email), email=user.email)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return AuthResponse(token=create_token(user.id, user.email), email=user.email)


@router.get("/github")
def github_redirect():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(500, "GitHub OAuth not configured")
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&scope=user:email,repo"
    )
    return RedirectResponse(url)


@router.get("/github/callback")
def github_callback(code: str, db: Session = Depends(get_db)):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(500, "GitHub OAuth not configured")

    # Exchange code for access token
    try:
        token_resp = httpx.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=10.0,  # 10 second timeout
        )
    except httpx.TimeoutException:
        raise HTTPException(504, "GitHub OAuth request timed out. Please try again.")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Failed to connect to GitHub OAuth: {e}")
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        error = token_data.get("error_description", token_data.get("error", "unknown"))
        raise HTTPException(400, f"GitHub OAuth failed: {error}")

    # Fetch user info
    try:
        gh_user_resp = httpx.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        gh_user = gh_user_resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "GitHub API request timed out. Please try again.")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Failed to connect to GitHub: {e}")
    github_id = str(gh_user.get("id", ""))
    if not github_id:
        raise HTTPException(400, "Could not retrieve GitHub user info")

    # Fetch primary email
    try:
        emails_resp = httpx.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        emails = emails_resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "GitHub API request timed out. Please try again.")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Failed to connect to GitHub: {e}")
    primary_email = next((e["email"] for e in emails if e.get("primary")), None)
    if not primary_email:
        primary_email = gh_user.get("email") or f"{github_id}@github.oauth"

    # Find or create user
    user = db.query(User).filter(User.github_id == github_id).first()
    if not user:
        # Check if email already exists (link accounts)
        user = db.query(User).filter(User.email == primary_email).first()
        if user:
            user.github_id = github_id
        else:
            user = User(email=primary_email, github_id=github_id)
            db.add(user)
    # Always update the access token so API calls use a fresh token
    user.github_access_token = access_token
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.email)
    from urllib.parse import urlencode
    return RedirectResponse(f"http://localhost:5173?{urlencode({'token': token, 'email': user.email})}")
