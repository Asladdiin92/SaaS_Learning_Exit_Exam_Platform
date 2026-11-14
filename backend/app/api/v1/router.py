from fastapi import APIRouter
from backend.app.identity.router import auth_router
from backend.app.tenants.router import tenants_router
from backend.app.curriculum.router import curriculum_router
from backend.app.content.router import content_router
from backend.app.assessments.router import assessments_router
from backend.app.entitlements.router import entitlements_router
from backend.app.mobile_sync.router import mobile_sync_router

api_v1_router = APIRouter()

# Mount Domain Routers
api_v1_router.include_router(auth_router)
api_v1_router.include_router(tenants_router)
api_v1_router.include_router(curriculum_router)
api_v1_router.include_router(content_router)
api_v1_router.include_router(assessments_router)
api_v1_router.include_router(entitlements_router)
api_v1_router.include_router(mobile_sync_router)


@api_v1_router.get("/status", tags=["System"])
async def api_status():
    return {
        "status": "online",
        "api_version": "v1",
        "platform": "SaaS Learning & Exit Exam Platform",
    }
