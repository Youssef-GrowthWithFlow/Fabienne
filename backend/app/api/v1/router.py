from fastapi import APIRouter, Depends

from app.api.v1.actions import router as actions_router
from app.api.v1.agents import router as agents_router
from app.api.v1.auth import router as auth_router
from app.api.v1.comments import router as comments_router
from app.api.v1.entreprises import router as entreprises_router
from app.api.v1.prospects import router as prospects_router
from app.api.v1.segments import router as segments_router
from app.api.v1.sourcer import router as sourcer_router
from app.api.v1.users import router as users_router
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health():
    return {"status": "ok"}


# Auth endpoints are public (login, forgot/reset password). Everything else
# requires a valid Bearer token — enforced once at the include level.
router.include_router(auth_router)

PROTECTED = [Depends(get_current_user)]
router.include_router(segments_router, dependencies=PROTECTED)
router.include_router(entreprises_router, dependencies=PROTECTED)
router.include_router(prospects_router, dependencies=PROTECTED)
router.include_router(comments_router, dependencies=PROTECTED)
router.include_router(actions_router, dependencies=PROTECTED)
router.include_router(agents_router, dependencies=PROTECTED)
router.include_router(sourcer_router, dependencies=PROTECTED)
# users_router déclare déjà require_admin sur chaque route (qui couvre
# get_current_user) — pas besoin d'ajouter PROTECTED.
router.include_router(users_router)
