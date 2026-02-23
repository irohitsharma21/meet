"""
MongoDB async connection management using Motor.
Auto-falls back to mongomock_motor (in-memory) when no real MongoDB is reachable.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import motor.motor_asyncio
from pymongo import ASCENDING, TEXT, IndexModel
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from core.config import settings


class MongoDB:
    client = None
    db = None
    is_mock: bool = False


mongodb = MongoDB()


async def connect_db() -> None:
    """Initialize Motor client, falling back to mongomock if needed."""

    # ── Try real MongoDB first ────────────────────────────────────────
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=3000,
            maxPoolSize=50,
            minPoolSize=5,
        )
        # Ping to confirm connection
        await client.admin.command("ping")
        mongodb.client = client
        mongodb.db = client[settings.MONGODB_DB_NAME]
        mongodb.is_mock = False
        print(f"✅ Connected to MongoDB: {settings.MONGODB_DB_NAME}")

    except (ServerSelectionTimeoutError, Exception) as e:
        # ── Fall back to in-memory mongomock ──────────────────────────
        print(f"⚠️  Real MongoDB unavailable ({e.__class__.__name__}). "
              f"Using in-memory mongomock — data will NOT persist across restarts.")
        try:
            import mongomock_motor
            mongodb.client = mongomock_motor.AsyncMongoMockClient()
            mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
            mongodb.is_mock = True
            print("✅ mongomock_motor in-memory database ready")
        except ImportError:
            raise RuntimeError(
                "MongoDB is not reachable and mongomock_motor is not installed. "
                "Run: pip install mongomock-motor  OR  start MongoDB."
            )

    # Create indexes (best-effort — mongomock supports most)
    await _ensure_indexes()


async def close_db() -> None:
    """Gracefully close the Motor client."""
    if mongodb.client and not mongodb.is_mock:
        mongodb.client.close()
        print("🔌 MongoDB connection closed")


async def _ensure_indexes() -> None:
    """Create required indexes if they do not already exist."""
    try:
        meetings = mongodb.db["meetings"]
        await meetings.create_indexes([
            IndexModel([("meeting_id", ASCENDING)], unique=True, name="idx_meeting_id"),
            IndexModel([("timestamp", ASCENDING)], name="idx_timestamp"),
            IndexModel([("participants", ASCENDING)], name="idx_participants"),
            IndexModel([("status", ASCENDING)], name="idx_status"),
            IndexModel([("created_by", ASCENDING)], name="idx_created_by"),
        ])

        # Text index — mongomock may not support it, so wrap separately
        try:
            await meetings.create_indexes([
                IndexModel(
                    [("transcript.text", TEXT), ("transcript.speaker", TEXT)],
                    name="idx_transcript_text",
                    default_language="english",
                ),
            ])
        except Exception:
            pass  # Text indexes unsupported in mongomock — skip silently

        users = mongodb.db["users"]
        await users.create_indexes([
            IndexModel([("username", ASCENDING)], unique=True, name="idx_username"),
            IndexModel([("email", ASCENDING)], unique=True, name="idx_email"),
        ])

        cal_tokens = mongodb.db["calendar_tokens"]
        await cal_tokens.create_indexes([
            IndexModel([("username", ASCENDING)], unique=True, name="idx_cal_username")
        ])

        print("📑 MongoDB indexes ensured")
    except (OperationFailure, Exception) as e:
        print(f"⚠️  Index creation warning: {e}")


# ── Dependency-injectable accessors ──────────────────────────────────────────
def get_db() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    return mongodb.db


def get_meetings_collection():
    return mongodb.db["meetings"]


def get_users_collection():
    return mongodb.db["users"]


def get_calendar_tokens_collection():
    return mongodb.db["calendar_tokens"]


# ── FastAPI lifespan ──────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app) -> AsyncGenerator:
    await connect_db()
    yield
    await close_db()
