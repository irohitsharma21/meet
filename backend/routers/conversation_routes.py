"""
Conversation routes:
  GET  /conversations/              – list conversations for current user
  GET  /conversations/{meeting_id}  – get full conversation by meeting ID
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from core.security import get_current_user
from db.mongodb import get_conversations_collection
from models.meeting_model import ConversationResponse, ConversationListItem

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/", response_model=List[ConversationListItem])
async def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List conversations the current user participated in or created."""
    col = get_conversations_collection()

    # Filter: return conversations where user is creator OR participant
    query: dict = {}
    if current_user["role"] != "admin":
        query["$or"] = [
            {"created_by": current_user["username"]},
            {"participants": current_user["username"]},
        ]

    cursor = col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    items = []
    async for d in cursor:
        items.append(
            ConversationListItem(
                meeting_id=d.get("meeting_id"),
                title=d.get("title"),
                created_by=d.get("created_by"),
                timestamp=d.get("timestamp"),
            )
        )
    return items


@router.get("/{meeting_id}", response_model=ConversationResponse)
async def get_conversation(
    meeting_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a full conversation (transcript + metadata) for a specific meeting."""
    col = get_conversations_collection()
    doc = await col.find_one({"meeting_id": meeting_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Access control: only creator, participant, or admin can read
    if current_user["role"] != "admin":
        participants = doc.get("participants", [])
        created_by = doc.get("created_by")
        if current_user["username"] not in participants and current_user["username"] != created_by:
            raise HTTPException(status_code=403, detail="Access denied")

    return ConversationResponse(
        meeting_id=doc.get("meeting_id"),
        title=doc.get("title"),
        created_by=doc.get("created_by"),
        participants=doc.get("participants", []),
        transcript=doc.get("transcript", []),
        timestamp=doc.get("timestamp"),
    )
