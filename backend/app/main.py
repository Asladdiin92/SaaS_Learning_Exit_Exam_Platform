from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from backend.app.core.config import settings
from backend.app.api.v1.router import api_v1_router
from backend.app.content.storage_adapter import storage_adapter

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", status_code=status.HTTP_200_OK, tags=["Health"])
async def healthz():
    """Health check endpoint for container orchestrators and readiness probes."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENVIRONMENT,
        "storage_driver": settings.STORAGE_DRIVER,
    }


# Local dev storage download route (ADR-009)
@app.get("/api/v1/dev-storage/{bucket}/{object_key:path}", tags=["Dev Storage"])
async def get_dev_storage_file(bucket: str, object_key: str):
    """Serves raw bytes in local development mode without requiring cloud storage."""
    if settings.STORAGE_DRIVER != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dev storage endpoint is only available when STORAGE_DRIVER=local",
        )

    data = storage_adapter.read_package(bucket, object_key)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{object_key}' not found in bucket '{bucket}'",
        )

    return Response(content=data, media_type="application/octet-stream")


# Mount API V1
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
