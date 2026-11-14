export type DownloadState =
  | 'IDLE'
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'AVAILABLE_OFFLINE'
  | 'FAILED'
  | 'EXPIRED';

export interface DownloadGrant {
  grant_id: string;
  resource_id: string;
  course_id: number;
  title: string;
  type: string;
  storage_bucket: string;
  storage_object_key: string;
  download_url: string;
  file_size_bytes: number;
  sha256_checksum: string | null;
  version: number;
  wrapped_aes_key: string;
  license_expiry: string;
  watermark: {
    user_id: string;
    email: string;
    full_name: string;
    tenant_id: string | null;
    device_id: string | null;
    issued_at: string;
    formatted_watermark: string;
  };
}

export interface LocalPackageRecord {
  package_id: string;
  resource_id: string;
  course_id?: number;
  title?: string;
  version: number;
  encrypted_path: string;
  sha256_checksum: string | null;
  size_bytes: number;
  state: DownloadState;
  grant_id: string | null;
  license_expiry: string | null;
  last_opened_at: string | null;
  progress_percent?: number;
  bytes_downloaded?: number;
  error_message?: string;
}

export interface StorageQuotaInfo {
  totalBytes: number;
  downloadedBytes: number;
  protectedExamQueueBytes: number;
  freeBytes: number;
}
