from fastapi import APIRouter

router = APIRouter()

last_sync_result: dict = {"disabled": True}


@router.get("/status")
def sync_status():
    return last_sync_result
