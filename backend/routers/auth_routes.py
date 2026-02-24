"""
Auth routes:
  POST /auth/register      – register new user (stored in MongoDB)
  POST /auth/login         – login (OAuth2 password form) → JWT tokens
  POST /auth/refresh       – refresh access + refresh token pair
  GET  /auth/me            – get current user profile
  PUT  /auth/me            – update display_name / email
  GET  /auth/users         – list all users (admin only)
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
    require_role,
)
from core.config import settings
from db.mongodb import get_users_collection
from models.meeting_model import TokenResponse, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Additional request schemas ────────────────────────────────────────────────
class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Helper: serialize MongoDB user doc → UserResponse ─────────────────────────
def _user_to_response(u: dict) -> UserResponse:
    return UserResponse(
        username=u["username"],
        email=u["email"],
        display_name=u.get("display_name"),
        role=u.get("role", "participant"),
        created_at=u["created_at"],
        last_login=u.get("last_login"),
        is_active=u.get("is_active", True),
    )


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(payload: UserCreate):
    """Register a new user and persist to MongoDB."""
    col = get_users_collection()

    # Check uniqueness
    if await col.find_one({"$or": [{"username": payload.username}, {"email": payload.email}]}):
        raise HTTPException(status_code=409, detail="Username or email already exists")

    now = datetime.utcnow()
    user_doc = {
        "username": payload.username,
        "email": payload.email,
        "display_name": payload.display_name or payload.username,
        "hashed_password": hash_password(payload.password),
        "role": payload.role,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "is_active": True,
    }
    await col.insert_one(user_doc)
    return _user_to_response(user_doc)


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return JWT access + refresh tokens."""
    col = get_users_collection()
    user = await col.find_one({"username": form_data.username})

    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    access = create_access_token(subject=user["username"], role=user.get("role", "participant"))
    refresh = create_refresh_token(subject=user["username"])

    # Persist last_login timestamp
    await col.update_one(
        {"username": user["username"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ── Refresh token ─────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token type")

    col = get_users_collection()
    user = await col.find_one({"username": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access = create_access_token(subject=user["username"], role=user.get("role", "participant"))
    new_refresh = create_refresh_token(subject=user["username"])

    return TokenResponse(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ── Get current user profile ──────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's full profile from MongoDB."""
    col = get_users_collection()
    user = await col.find_one({"username": current_user["username"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_response(user)


# ── Update profile ────────────────────────────────────────────────────────────
@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's display_name or email."""
    col = get_users_collection()

    updates: dict = {"updated_at": datetime.utcnow()}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name
    if payload.email is not None:
        # Ensure email not taken by another user
        conflict = await col.find_one({
            "email": payload.email,
            "username": {"$ne": current_user["username"]}
        })
        if conflict:
            raise HTTPException(status_code=409, detail="Email already in use")
        updates["email"] = payload.email

    await col.update_one({"username": current_user["username"]}, {"$set": updates})

    user = await col.find_one({"username": current_user["username"]})
    return _user_to_response(user)


# ── List users (admin only) ───────────────────────────────────────────────────
@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only: list all registered users (hashed_password excluded)."""
    col = get_users_collection()
    users = []
    async for u in col.find({}, {"hashed_password": 0}).sort("created_at", -1):
        users.append(_user_to_response(u))
    return users
