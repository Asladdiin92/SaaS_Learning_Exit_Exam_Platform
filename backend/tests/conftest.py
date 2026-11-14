import pytest
from backend.app.database.session import async_engine


@pytest.fixture(autouse=True)
async def cleanup_db_engine():
    yield
    await async_engine.dispose()
