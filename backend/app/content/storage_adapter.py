import os
from pathlib import Path
from typing import Optional
from backend.app.core.config import settings


class StorageAdapter:
    """
    Resolves (storage_bucket, storage_object_key) from course_resources
    to a local dev URL during offline/LAN development or a signed
    Supabase Storage URL in cloud production with zero DB changes (ADR-009).
    """

    def __init__(self) -> None:
        self.driver = settings.STORAGE_DRIVER  # 'local' or 'supabase'
        self.local_root = Path(settings.LOCAL_STORAGE_PATH)
        self._supabase_client = None

    @property
    def supabase(self):
        if self._supabase_client is None and self.driver == "supabase":
            from supabase import create_client, Client

            if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured when STORAGE_DRIVER=supabase"
                )
            self._supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )
        return self._supabase_client

    def create_signed_download_url(
        self, bucket: str, object_key: str, expires_in: int = 900
    ) -> str:
        """Generates a signed download URL valid for `expires_in` seconds."""
        if self.driver == "supabase":
            res = self.supabase.storage.from_(bucket).create_signed_url(
                object_key, expires_in
            )
            # Depending on supabase-py version, res can be a dict or string
            if isinstance(res, dict) and "signedURL" in res:
                return res["signedURL"]
            elif isinstance(res, dict) and "signedUrl" in res:
                return res["signedUrl"]
            return str(res)

        # Local dev fallback (e.g. 10.0.2.2 for Android emulator or LAN IP over ADB/USB)
        base_url = os.getenv("API_PUBLIC_BASE_URL", f"http://127.0.0.1:{settings.PORT}")
        return f"{base_url}/api/v1/dev-storage/{bucket}/{object_key}?ttl={expires_in}"

    def upload_encrypted_package(
        self, bucket: str, object_key: str, data: bytes
    ) -> None:
        """Stores encrypted payload into local storage or Supabase Storage."""
        if self.driver == "supabase":
            self.supabase.storage.from_(bucket).upload(
                path=object_key,
                file=data,
                file_options={"content-type": "application/octet-stream", "upsert": "true"},
            )
            return

        target_path = self.local_root / bucket / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)

    def read_package(self, bucket: str, object_key: str) -> Optional[bytes]:
        """Reads stored package bytes."""
        if self.driver == "supabase":
            return self.supabase.storage.from_(bucket).download(object_key)

        target_path = self.local_root / bucket / object_key
        if target_path.exists():
            return target_path.read_bytes()
        return None


storage_adapter = StorageAdapter()
