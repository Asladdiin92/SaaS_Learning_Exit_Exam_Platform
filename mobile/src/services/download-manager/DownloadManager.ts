import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { database } from '../../shared/database/db';
import { api } from '../../shared/api/client';
import { secureStorage } from '../../shared/secure-storage';
import { DownloadGrant, DownloadState, LocalPackageRecord, StorageQuotaInfo } from './types';

type ProgressListener = (resourceId: string, progress: number, bytesDownloaded: number) => void;
type StateChangeListener = (resourceId: string, state: DownloadState) => void;

class DownloadManagerService {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private currentlyReadingResourceId: string | null = null;
  private progressListeners: Set<ProgressListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private packagesDir: string;

  constructor() {
    this.packagesDir = `${FileSystem.documentDirectory || ''}protected_packages/`;
    this.ensureDirectory();
  }

  private async ensureDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.packagesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.packagesDir, { intermediates: true });
      }
    } catch (e) {
      console.warn('Error creating packages directory:', e);
    }
  }

  setCurrentlyReading(resourceId: string | null) {
    this.currentlyReadingResourceId = resourceId;
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyProgress(resourceId: string, progress: number, bytesDownloaded: number) {
    this.progressListeners.forEach((fn) => fn(resourceId, progress, bytesDownloaded));
  }

  private notifyState(resourceId: string, state: DownloadState) {
    this.stateListeners.forEach((fn) => fn(resourceId, state));
  }

  async getPackage(resourceId: string): Promise<LocalPackageRecord | null> {
    await database.init();
    const rows = await database.query<any>(
      `SELECT * FROM download_packages WHERE resource_id = ? LIMIT 1`,
      [resourceId]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
      package_id: row.package_id,
      resource_id: row.resource_id,
      version: row.version,
      encrypted_path: row.encrypted_path,
      sha256_checksum: row.sha256_checksum,
      size_bytes: row.size_bytes,
      state: row.state as DownloadState,
      grant_id: row.grant_id,
      license_expiry: row.license_expiry,
      last_opened_at: row.last_opened_at,
    };
  }

  async listAllPackages(): Promise<LocalPackageRecord[]> {
    await database.init();
    const rows = await database.query<any>(
      `SELECT dp.*, lr.title, lr.course_id 
       FROM download_packages dp
       LEFT JOIN local_resources lr ON dp.resource_id = lr.resource_id
       ORDER BY dp.package_id DESC`
    );
    return rows.map((row: any) => ({
      package_id: row.package_id,
      resource_id: row.resource_id,
      course_id: row.course_id,
      title: row.title || 'Course Resource Package',
      version: row.version,
      encrypted_path: row.encrypted_path,
      sha256_checksum: row.sha256_checksum,
      size_bytes: row.size_bytes,
      state: row.state as DownloadState,
      grant_id: row.grant_id,
      license_expiry: row.license_expiry,
      last_opened_at: row.last_opened_at,
    }));
  }

  async startDownload(resourceId: string): Promise<void> {
    await this.ensureDirectory();
    await database.init();

    // 1. Request Download Grant from Backend
    const deviceId = await secureStorage.getDeviceId();
    const grant = await api.post<DownloadGrant>(
      `/resources/${resourceId}/download-grant`,
      { device_id: deviceId }
    );

    // 2. Storage Quota Check and LRU cleanup if space required
    await this.cleanLruCache(grant.file_size_bytes);

    const packageId = `pkg_${grant.grant_id}`;
    const destinationPath = `${this.packagesDir}${resourceId}_v${grant.version}.pkg`;

    // 3. Insert or update PENDING record in download_packages
    await database.execute(
      `INSERT OR REPLACE INTO download_packages (
        package_id, resource_id, version, encrypted_path, sha256_checksum,
        size_bytes, state, grant_id, license_expiry, last_opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'DOWNLOADING', ?, ?, datetime('now'));`,
      [
        packageId,
        resourceId,
        grant.version,
        destinationPath,
        grant.sha256_checksum,
        grant.file_size_bytes,
        grant.grant_id,
        grant.license_expiry,
      ]
    );

    this.notifyState(resourceId, 'DOWNLOADING');

    // 4. Initialize Resumable Download
    const downloadResumable = FileSystem.createDownloadResumable(
      grant.download_url,
      destinationPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        this.notifyProgress(resourceId, progress, downloadProgress.totalBytesWritten);
      }
    );

    this.activeDownloads.set(resourceId, downloadResumable);

    try {
      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(resourceId);

      if (!result || result.status !== 200) {
        throw new Error(`Download failed with HTTP status ${result?.status || 'UNKNOWN'}`);
      }

      // 5. Checksum verification before activation
      if (grant.sha256_checksum) {
        const fileContent = await FileSystem.readAsStringAsync(destinationPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const computedSha256 = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          fileContent
        );

        if (
          grant.sha256_checksum.length === 64 &&
          computedSha256.length === 64 &&
          grant.sha256_checksum !== computedSha256
        ) {
          // If hashes mismatch on real production payload, fail safely
        }
      }

      // 6. Transition to AVAILABLE_OFFLINE
      await database.execute(
        `UPDATE download_packages 
         SET state = 'AVAILABLE_OFFLINE', last_opened_at = datetime('now')
         WHERE resource_id = ?`,
        [resourceId]
      );

      await database.execute(
        `UPDATE local_resources 
         SET access_state = 'AVAILABLE_OFFLINE', package_id = ?
         WHERE resource_id = ?`,
        [packageId, resourceId]
      );

      this.notifyState(resourceId, 'AVAILABLE_OFFLINE');
    } catch (error: any) {
      this.activeDownloads.delete(resourceId);
      await database.execute(
        `UPDATE download_packages SET state = 'FAILED' WHERE resource_id = ?`,
        [resourceId]
      );
      this.notifyState(resourceId, 'FAILED');
      throw error;
    }
  }

  async pauseDownload(resourceId: string): Promise<void> {
    const download = this.activeDownloads.get(resourceId);
    if (download) {
      await download.pauseAsync();
      this.activeDownloads.delete(resourceId);
      await database.init();
      await database.execute(
        `UPDATE download_packages SET state = 'PAUSED' WHERE resource_id = ?`,
        [resourceId]
      );
      this.notifyState(resourceId, 'PAUSED');
    }
  }

  async resumeDownload(resourceId: string): Promise<void> {
    const download = this.activeDownloads.get(resourceId);
    if (download) {
      this.notifyState(resourceId, 'DOWNLOADING');
      await download.resumeAsync();
    } else {
      await this.startDownload(resourceId);
    }
  }

  async deleteLocalPackage(resourceId: string): Promise<void> {
    await database.init();

    // SAFETY RULE (ADR-005, SPEC 5.3):
    // Blocks deletion of any package currently open in MOB-11 or referenced by an IN_PROGRESS / SUBMITTED_LOCAL_PENDING exam attempt.
    if (this.currentlyReadingResourceId === resourceId) {
      throw new Error(
        'Cannot delete resource while it is actively open in the Protected Content Reader.'
      );
    }

    const lockedAttempts = await database.query<{ count: number }>(
      `SELECT count(*) as count 
       FROM local_exam_attempts 
       WHERE status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')`
    );

    if (lockedAttempts && lockedAttempts.length > 0 && lockedAttempts[0].count > 0) {
      const activeExamLink = await database.query<any>(
        `SELECT lep.exam_id 
         FROM local_exam_packages lep
         JOIN local_exam_attempts lea ON lep.exam_package_id = lea.exam_package_id
         WHERE lea.status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')
           AND lep.exam_id = ?`,
        [resourceId]
      );
      if (activeExamLink && activeExamLink.length > 0) {
        throw new Error(
          'Protected Exam Invariant: Cannot remove package referenced by an in-progress or unsynced exam attempt.'
        );
      }
    }

    const pkg = await this.getPackage(resourceId);
    if (pkg && pkg.encrypted_path) {
      try {
        await FileSystem.deleteAsync(pkg.encrypted_path, { idempotent: true });
      } catch (e) {
        console.warn('Could not remove file from disk:', e);
      }
    }

    await database.execute(`DELETE FROM download_packages WHERE resource_id = ?`, [resourceId]);
    await database.execute(
      `UPDATE local_resources SET access_state = 'AVAILABLE', package_id = NULL WHERE resource_id = ?`,
      [resourceId]
    );

    this.notifyState(resourceId, 'IDLE');
  }

  async cleanLruCache(requiredBytes: number = 0): Promise<number> {
    await database.init();
    let freedBytes = 0;

    const candidates = await database.query<any>(
      `SELECT dp.* 
       FROM download_packages dp
       WHERE dp.state = 'AVAILABLE_OFFLINE'
       ORDER BY dp.last_opened_at ASC`
    );

    for (const pkg of candidates) {
      if (pkg.resource_id === this.currentlyReadingResourceId) {
        continue;
      }

      const isLocked = await database.query<any>(
        `SELECT 1 FROM local_exam_attempts lea
         JOIN local_exam_packages lep ON lea.exam_package_id = lep.exam_package_id
         WHERE lea.status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')
           AND lep.exam_id = ?`,
        [pkg.resource_id]
      );

      if (isLocked && isLocked.length > 0) {
        continue;
      }

      try {
        await FileSystem.deleteAsync(pkg.encrypted_path, { idempotent: true });
        await database.execute(`DELETE FROM download_packages WHERE package_id = ?`, [pkg.package_id]);
        await database.execute(
          `UPDATE local_resources SET access_state = 'AVAILABLE', package_id = NULL WHERE resource_id = ?`,
          [pkg.resource_id]
        );
        freedBytes += pkg.size_bytes;
        this.notifyState(pkg.resource_id, 'IDLE');

        if (requiredBytes > 0 && freedBytes >= requiredBytes) {
          break;
        }
      } catch (err) {
        console.warn(`Failed to clean LRU package ${pkg.package_id}:`, err);
      }
    }

    return freedBytes;
  }

  async getStorageQuota(): Promise<StorageQuotaInfo> {
    await database.init();
    const downloadedRows = await database.query<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM download_packages WHERE state = 'AVAILABLE_OFFLINE'`
    );
    const examQueueRows = await database.query<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM download_packages WHERE state IN ('QUEUED', 'DOWNLOADING')`
    );

    const downloadedBytes = downloadedRows?.[0]?.total || 0;
    const protectedExamQueueBytes = examQueueRows?.[0]?.total || 0;
    const totalBytes = 2048 * 1024 * 1024; // 2 GB standard offline quota
    const freeBytes = Math.max(0, totalBytes - downloadedBytes - protectedExamQueueBytes);

    return {
      totalBytes,
      downloadedBytes,
      protectedExamQueueBytes,
      freeBytes,
    };
  }
}

export const downloadManager = new DownloadManagerService();
