import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.content.storage_adapter import storage_adapter


@pytest.mark.asyncio
async def test_healthz_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "storage_driver" in data


@pytest.mark.asyncio
async def test_api_v1_status():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert data["api_version"] == "v1"


def test_storage_adapter_local_read_write(tmp_path):
    # Temporarily point local root to tmp_path
    original_root = storage_adapter.local_root
    try:
        storage_adapter.local_root = tmp_path
        test_bucket = "course-packages"
        test_key = "tests/sample.enc"
        test_payload = b"test encrypted payload bytes"

        storage_adapter.upload_encrypted_package(test_bucket, test_key, test_payload)
        read_payload = storage_adapter.read_package(test_bucket, test_key)

        assert read_payload == test_payload
    finally:
        storage_adapter.local_root = original_root
