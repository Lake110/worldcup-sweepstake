import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.services.ai_scores import apply_scores_to_db, extract_scores_from_image, fetch_scores_via_web_search

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/fetch-web")
async def fetch_web_scores(
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, detail="ANTHROPIC_API_KEY not configured on server")

    scores = await fetch_scores_via_web_search()

    if not scores:
        return {
            "message": "No completed World Cup results found",
            "updated": [],
            "skipped": [],
            "not_found": [],
            "total_extracted": 0,
        }

    return apply_scores_to_db(db, scores)


@router.post("/fetch-image")
async def fetch_image_scores(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, detail="ANTHROPIC_API_KEY not configured on server")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(422, detail="Must be a jpg, png, webp, or gif image")

    image_data = await file.read()
    if len(image_data) > MAX_IMAGE_BYTES:
        raise HTTPException(422, detail="Image too large — max 5MB")

    scores = await extract_scores_from_image(image_data, file.content_type)

    if not scores:
        return {
            "message": "No scores could be read from the image",
            "updated": [],
            "skipped": [],
            "not_found": [],
            "total_extracted": 0,
        }

    return apply_scores_to_db(db, scores)
