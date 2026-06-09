from fastapi import APIRouter, Depends

from app.core.deps import get_admin_user
from app.models.user import User
from app.services.sync_matches import sync_results, sync_standings

router = APIRouter()

last_sync_result: dict = {}


@router.post("/run")
async def run_sync(user: User = Depends(get_admin_user)):
    global last_sync_result
    result = await sync_results()
    last_sync_result = result
    return result


@router.post("/standings")
async def run_standings_sync(user: User = Depends(get_admin_user)):
    global last_sync_result
    result = await sync_standings()
    last_sync_result = result
    return result


@router.get("/status")
def sync_status():
    return last_sync_result
