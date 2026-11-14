from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
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
async def get_dev_storage_file(
    bucket: str,
    object_key: str,
    request: Request,
    expires: int = Query(..., gt=0),
    signature: str = Query(..., min_length=64, max_length=64),
):
    """Serves raw bytes in local development mode without requiring cloud storage."""
    if settings.STORAGE_DRIVER != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dev storage endpoint is only available when STORAGE_DRIVER=local",
        )

    if not storage_adapter.verify_local_download_signature(
        bucket, object_key, expires, signature
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Download URL signature is invalid or expired.",
        )

    package_path = storage_adapter.get_local_package_path(bucket, object_key)
    if package_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{object_key}' not found in bucket '{bucket}'",
        )

    file_size = package_path.stat().st_size
    range_header = request.headers.get("range")
    if range_header:
        if not range_header.startswith("bytes=") or "," in range_header:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Only one byte range is supported.",
                headers={"Content-Range": f"bytes */{file_size}"},
            )
        range_spec = range_header[6:]
        try:
            start_text, end_text = range_spec.split("-", 1)
            if not start_text:
                suffix_length = int(end_text)
                if suffix_length <= 0:
                    raise ValueError
                start = max(file_size - suffix_length, 0)
                end = file_size - 1
            else:
                start = int(start_text)
                end = int(end_text) if end_text else file_size - 1
            if start < 0 or end < start or start >= file_size:
                raise ValueError
            content, total_size = storage_adapter.read_local_package_range(
                bucket, object_key, start, end
            )
        except (ValueError, OverflowError):
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Requested byte range is not satisfiable.",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        actual_end = start + len(content) - 1
        return Response(
            content=content,
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type="application/octet-stream",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes {start}-{actual_end}/{total_size}",
                "Content-Length": str(len(content)),
            },
        )

    return FileResponse(
        package_path,
        media_type="application/octet-stream",
        headers={"Accept-Ranges": "bytes"},
    )


# Mount API V1
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
