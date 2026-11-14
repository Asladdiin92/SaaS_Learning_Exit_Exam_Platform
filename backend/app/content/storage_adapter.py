import os
import base64
import hashlib
import hmac
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote
from uuid import UUID
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

    def local_package_path(self, bucket: str, object_key: str) -> Path:
        """Resolve a local package path without allowing traversal outside its bucket."""
        key_path = Path(object_key)
        if key_path.is_absolute() or any(part in {"", ".", ".."} for part in key_path.parts):
            raise ValueError("Invalid storage object key.")
        if Path(bucket).name != bucket or bucket in {"", ".", ".."}:
            raise ValueError("Invalid storage bucket.")

        base = self.local_root if self.local_root.name == bucket else self.local_root / bucket
        root = base.resolve()
        target = (base / key_path).resolve()
        if not target.is_relative_to(root):
            raise ValueError("Storage object key resolves outside its bucket.")
        return target

    def derive_ephemeral_aes_key(
        self,
        user_id: UUID,
        device_id: UUID,
        grant_id: UUID,
        resource_id: UUID,
        version: int,
    ) -> str:
        """Derive a grant-specific AES-256 key bound to its user, device, and package."""
        material = (
            f"offline-download:{user_id}:{device_id}:{grant_id}:"
            f"{resource_id}:{version}"
        ).encode("utf-8")
        key = hmac.new(
            settings.JWT_SECRET_KEY.encode("utf-8"),
            material,
            hashlib.sha256,
        ).digest()
        return base64.b64encode(key).decode("ascii")

    @property
    def supabase(self):
        if self._supabase_client is None and self.driver == "supabase":
            from supabase import create_client

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
        expires_at = int(time.time()) + expires_in
        signature = self._sign_local_download(bucket, object_key, expires_at)
        return (
            f"{base_url}/api/v1/dev-storage/{quote(bucket, safe='')}/"
            f"{quote(object_key, safe='/')}?expires={expires_at}&signature={signature}"
        )

    @staticmethod
    def _sign_local_download(bucket: str, object_key: str, expires_at: int) -> str:
        message = f"{bucket}\n{object_key}\n{expires_at}".encode("utf-8")
        return hmac.new(
            settings.JWT_SECRET_KEY.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()

    def verify_local_download_signature(
        self,
        bucket: str,
        object_key: str,
        expires_at: int,
        signature: str,
    ) -> bool:
        return (
            expires_at > int(time.time())
            and hmac.compare_digest(
                self._sign_local_download(bucket, object_key, expires_at),
                signature,
            )
        )

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

        target_path = self.local_package_path(bucket, object_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)

    def read_package(self, bucket: str, object_key: str) -> Optional[bytes]:
        """Reads stored package bytes."""
        if self.driver == "supabase":
            return self.supabase.storage.from_(bucket).download(object_key)

        target_path = self.local_package_path(bucket, object_key)
        if target_path.exists():
            return target_path.read_bytes()
        return None

    def get_local_package_path(self, bucket: str, object_key: str) -> Optional[Path]:
        if self.driver != "local":
            return None
        path = self.local_package_path(bucket, object_key)
        return path if path.is_file() else None

    def read_local_package_range(
        self,
        bucket: str,
        object_key: str,
        start: int,
        end: int,
    ) -> tuple[bytes, int]:
        """Read an inclusive byte range and return it with the package's total size."""
        path = self.get_local_package_path(bucket, object_key)
        if path is None:
            raise FileNotFoundError(f"Package '{object_key}' was not found.")
        size = path.stat().st_size
        if start < 0 or end < start or start >= size:
            raise ValueError("Requested byte range is not satisfiable.")
        end = min(end, size - 1)
        with path.open("rb") as package_file:
            package_file.seek(start)
            return package_file.read(end - start + 1), size


storage_adapter = StorageAdapter()
