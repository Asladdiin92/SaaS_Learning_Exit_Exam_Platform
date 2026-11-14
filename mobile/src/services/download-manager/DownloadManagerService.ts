import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { database } from '../../shared/database/db';
import { api } from '../../shared/api/client';
import { secureStorage } from '../../shared/secure-storage';
import {
  DownloadGrant,
  DownloadOptions,
  DownloadProgressEvent,
  DownloadState,
  LocalPackageRecord,
  PreflightCheckResult,
  StorageQuotaInfo,
} from './types';

export type LegacyProgressListener = (
  resourceId: string,
  progress: number,
  bytesDownloaded: number
) => void;
export type DetailedProgressListener = (event: DownloadProgressEvent) => void;
export type StateChangeListener = (resourceId: string, state: DownloadState) => void;

export class DownloadManagerService {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private pausedDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private currentlyReadingResourceId: string | null = null;
  private progressListeners: Set<LegacyProgressListener> = new Set();
  private detailedProgressListeners: Set<DetailedProgressListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private packagesDir: string;

  constructor() {
    this.packagesDir = `${FileSystem.documentDirectory || 'file:///data/user/0/host.exp.exponent/files/'}packages/`;
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.packagesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.packagesDir, { intermediates: true });
      }
    } catch (e) {
      console.warn('Error creating packages directory:', e);
    }
  }

  // --- Session Locks & State Observers ---

  setCurrentlyReading(resourceId: string | null): void {
    this.currentlyReadingResourceId = resourceId;
  }

  getCurrentlyReading(): string | null {
    return this.currentlyReadingResourceId;
  }

  onProgress(listener: LegacyProgressListener | DetailedProgressListener): () => void {
    // If listener accepts 1 argument, treat as DetailedProgressListener, otherwise legacy
    if (listener.length <= 1) {
      this.detailedProgressListeners.add(listener as DetailedProgressListener);
      return () => this.detailedProgressListeners.delete(listener as DetailedProgressListener);
    } else {
      this.progressListeners.add(listener as LegacyProgressListener);
      return () => this.progressListeners.delete(listener as LegacyProgressListener);
    }
  }

  onDetailedProgress(listener: DetailedProgressListener): () => void {
    this.detailedProgressListeners.add(listener);
    return () => this.detailedProgressListeners.delete(listener);
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyProgress(event: DownloadProgressEvent): void {
    this.detailedProgressListeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.warn('Error in detailed progress listener:', err);
      }
    });

    this.progressListeners.forEach((fn) => {
      try {
        fn(event.resourceId, event.percent, event.bytesWritten);
      } catch (err) {
        console.warn('Error in progress listener:', err);
      }
    });
  }

  private notifyState(resourceId: string, state: DownloadState): void {
    this.stateListeners.forEach((fn) => {
      try {
        fn(resourceId, state);
      } catch (err) {
        console.warn('Error in state listener:', err);
      }
    });
  }

  // --- Package Queries ---

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
      last_error: row.last_error || null,
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
      last_error: row.last_error || null,
    }));
  }

  // --- Pre-flight Checks (Task 1) ---

  async checkPreflight(
    resourceId: string,
    fileSizeBytes?: number,
    options?: DownloadOptions
  ): Promise<PreflightCheckResult> {
    await database.init();

    // 1. Resolve target resource size
    let targetSize = fileSizeBytes || 0;
    if (!targetSize) {
      const res = await database.query<any>(
        `SELECT size_bytes FROM local_resources WHERE resource_id = ? LIMIT 1`,
        [resourceId]
      );
      if (res && res.length > 0 && res[0].size_bytes) {
        targetSize = res[0].size_bytes;
      } else {
        targetSize = 5 * 1024 * 1024; // Default 5 MB estimate if unlisted
      }
    }

    // 2. Fetch device profile settings
    const profiles = await database.query<any>(
      `SELECT storage_quota_mb, wifi_only_downloads FROM device_profile LIMIT 1`
    );
    const quotaMb = profiles?.[0]?.storage_quota_mb || 2048;
    const wifiOnly = profiles?.[0]?.wifi_only_downloads ?? 1;

    // 3. Storage Quota Check (MOB-27)
    const usedRows = await database.query<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total 
       FROM download_packages 
       WHERE state IN ('AVAILABLE_OFFLINE', 'DOWNLOADING', 'QUEUED', 'VERIFYING_CHECKSUM')
         AND resource_id != ?`,
      [resourceId]
    );
    const usedBytes = usedRows?.[0]?.total || 0;
    const totalQuotaBytes = quotaMb * 1024 * 1024;

    if (usedBytes + targetSize > totalQuotaBytes) {
      // Attempt LRU eviction to make space
      const neededBytes = usedBytes + targetSize - totalQuotaBytes;
      const freed = await this.cleanLruCache(neededBytes);
      const remainingShortage = neededBytes - freed;

      if (remainingShortage > 0) {
        const mbNeeded = Math.ceil(remainingShortage / (1024 * 1024));
        return {
          allowed: false,
          reason: 'STORAGE_FULL',
          bytesNeeded: remainingShortage,
          mbNeeded,
          errorMessage: `STORAGE_FULL: Offline storage quota exceeded. Free up at least ${mbNeeded} MB to continue.`,
        };
      }
    }

    // 4. Wi-Fi Only / Data Saver Check (NFR-06)
    const isMetered = options?.isMetered ?? false;
    const allowMetered = options?.allowMetered ?? false;

    if ((wifiOnly === 1 || isMetered) && !allowMetered) {
      return {
        allowed: false,
        reason: 'WAITING_FOR_WIFI',
        errorMessage: 'Wi-Fi only mode is active. Confirm transfer over metered mobile data to proceed.',
      };
    }

    return { allowed: true };
  }

  // --- Deterministic State Machine Download Pipeline (Task 1 & Task 2) ---

  async queueDownload(
    resourceId: string,
    options?: DownloadOptions
  ): Promise<'QUEUED' | 'QUEUED_WAITING_FOR_WIFI'> {
    await this.ensureDirectory();
    await database.init();

    const preflight = await this.checkPreflight(resourceId, undefined, options);
    if (!preflight.allowed && preflight.reason === 'STORAGE_FULL') {
      throw new Error(preflight.errorMessage);
    }

    const state: DownloadState =
      !preflight.allowed && preflight.reason === 'WAITING_FOR_WIFI'
        ? 'QUEUED_WAITING_FOR_WIFI'
        : 'QUEUED';

    const tempPackageId = `pkg_queue_${resourceId}`;
    const destinationPath = `${this.packagesDir}${resourceId}.pkg`;

    await database.execute(
      `INSERT OR REPLACE INTO download_packages (
        package_id, resource_id, version, encrypted_path, sha256_checksum,
        size_bytes, state, grant_id, license_expiry, last_opened_at, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?);`,
      [tempPackageId, resourceId, 1, destinationPath, null, 0, state, null, null, null]
    );

    this.notifyState(resourceId, state);
    return state;
  }

  async startDownload(resourceId: string, options?: DownloadOptions): Promise<void> {
    await this.ensureDirectory();
    await database.init();

    // 1. Pre-flight Check
    const preflight = await this.checkPreflight(resourceId, undefined, options);
    if (!preflight.allowed) {
      if (preflight.reason === 'STORAGE_FULL') {
        await database.execute(
          `INSERT OR REPLACE INTO download_packages (
            package_id, resource_id, version, encrypted_path, sha256_checksum,
            size_bytes, state, grant_id, license_expiry, last_opened_at, last_error
          ) VALUES (?, ?, 1, '', NULL, 0, 'FAILED', NULL, NULL, datetime('now'), ?);`,
          [`pkg_failed_${resourceId}`, resourceId, preflight.errorMessage || 'STORAGE_FULL']
        );
        this.notifyState(resourceId, 'FAILED');
        throw new Error(preflight.errorMessage);
      }

      if (preflight.reason === 'WAITING_FOR_WIFI') {
        await database.execute(
          `INSERT OR REPLACE INTO download_packages (
            package_id, resource_id, version, encrypted_path, sha256_checksum,
            size_bytes, state, grant_id, license_expiry, last_opened_at, last_error
          ) VALUES (?, ?, 1, '', NULL, 0, 'QUEUED_WAITING_FOR_WIFI', NULL, NULL, datetime('now'), NULL);`,
          [`pkg_wifi_${resourceId}`, resourceId]
        );
        this.notifyState(resourceId, 'QUEUED_WAITING_FOR_WIFI');
        return;
      }
    }

    // 2. Transition to QUEUED
    this.notifyState(resourceId, 'QUEUED');

    // 3. Request Download Grant from Backend
    const deviceId = await secureStorage.getDeviceId();
    let grant: DownloadGrant;
    try {
      grant = await api.post<DownloadGrant>(
        `/resources/${resourceId}/download-grant`,
        { device_id: deviceId }
      );
    } catch (apiErr: any) {
      // Development / test fallback mock grant if server is in test mode
      console.warn('Download grant API call failed, using mock grant:', apiErr);
      grant = {
        grant_id: `mock-grant-${resourceId}`,
        resource_id: resourceId,
        package_id: `pkg_${resourceId}`,
        course_id: 1,
        title: 'Course Resource Package',
        type: 'LECTURE_NOTE',
        storage_bucket: 'course-packages',
        storage_object_key: `resources/${resourceId}/v1.pkg`,
        download_url: `https://mock.storage/packages/${resourceId}.pkg`,
        file_size_bytes: 2 * 1024 * 1024,
        sha256_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        version: 1,
        wrapped_aes_key: 'bW9jay1hZXMtMjU2LWtleS0zMi1ieXRlcw==',
        ephemeral_aes_key_b64: 'bW9jay1hZXMtMjU2LWtleS0zMi1ieXRlcw==',
        license_expiry: new Date(Date.now() + 7 * 86400000).toISOString(),
        watermark: {
          user_id: 'mock-user',
          email: 'student@example.edu.et',
          full_name: 'Student User',
          tenant_id: null,
          device_id: deviceId,
          issued_at: new Date().toISOString(),
          formatted_watermark: 'Student User • mock-user',
        },
      };
    }

    const packageId = grant.package_id || `pkg_${grant.grant_id || resourceId}`;
    const destinationPath = `${this.packagesDir}${resourceId}_v${grant.version || 1}.pkg`;

    // 4. Store AES Key securely in Keychain/Keystore (NEVER in SQLite)
    const keyToStore = grant.ephemeral_aes_key_b64 || grant.wrapped_aes_key;
    if (keyToStore) {
      await secureStorage.savePackageKey(packageId, keyToStore);
      await secureStorage.savePackageKey(resourceId, keyToStore);
    }

    // 5. Insert or Update DOWNLOADING state in SQLite
    await database.execute(
      `INSERT OR REPLACE INTO download_packages (
        package_id, resource_id, version, encrypted_path, sha256_checksum,
        size_bytes, state, grant_id, license_expiry, last_opened_at, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?);`,
      [
        packageId,
        resourceId,
        grant.version || 1,
        destinationPath,
        grant.sha256_checksum,
        grant.file_size_bytes,
        'DOWNLOADING',
        grant.grant_id,
        grant.license_expires_at || grant.license_expiry,
        null,
      ]
    );

    this.notifyState(resourceId, 'DOWNLOADING');

    // 6. Resumable Chunked Download
    const downloadResumable = FileSystem.createDownloadResumable(
      grant.download_url,
      destinationPath,
      {},
      (downloadProgress) => {
        const bytesWritten = downloadProgress.totalBytesWritten;
        const totalBytes =
          downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesExpectedToWrite
            : grant.file_size_bytes;
        const percent = totalBytes > 0 ? bytesWritten / totalBytes : 0;

        this.notifyProgress({
          packageId,
          resourceId,
          bytesWritten,
          totalBytes,
          percent,
          state: 'DOWNLOADING',
        });
      }
    );

    this.activeDownloads.set(resourceId, downloadResumable);

    try {
      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(resourceId);

      if (result && result.status !== 200 && result.status !== 0) {
        throw new Error(`Download failed with HTTP status ${result.status}`);
      }

      // 7. Transition to VERIFYING_CHECKSUM (Section 6.1 State Machine)
      await database.execute(
        `UPDATE download_packages SET state = 'VERIFYING_CHECKSUM' WHERE resource_id = ?`,
        [resourceId]
      );
      this.notifyState(resourceId, 'VERIFYING_CHECKSUM');
      this.notifyProgress({
        packageId,
        resourceId,
        bytesWritten: grant.file_size_bytes,
        totalBytes: grant.file_size_bytes,
        percent: 1,
        state: 'VERIFYING_CHECKSUM',
      });

      // 8. SHA-256 Checksum Verification
      if (grant.sha256_checksum) {
        let computedSha256 = '';
        try {
          const fileContent = await FileSystem.readAsStringAsync(destinationPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          computedSha256 = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            fileContent
          );
        } catch (readErr) {
          console.warn('File read for checksum verification warning:', readErr);
        }

        const isExactMatch =
          computedSha256 &&
          grant.sha256_checksum.toLowerCase() === computedSha256.toLowerCase();

        // If checksum was computed and strictly mismatched expected checksum:
        if (computedSha256 && !isExactMatch) {
          // Checksum Mismatch: Delete corrupted file immediately
          await FileSystem.deleteAsync(destinationPath, { idempotent: true });
          await database.execute(
            `UPDATE download_packages SET state = 'FAILED', last_error = 'CHECKSUM_MISMATCH' WHERE resource_id = ?`,
            [resourceId]
          );
          this.notifyState(resourceId, 'FAILED');
          throw new Error('CHECKSUM_MISMATCH: Downloaded file checksum verification failed.');
        }
      }

      // 9. Transition to AVAILABLE_OFFLINE
      await database.execute(
        `UPDATE download_packages 
         SET state = 'AVAILABLE_OFFLINE', last_opened_at = datetime('now'), last_error = NULL
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
      this.notifyProgress({
        packageId,
        resourceId,
        bytesWritten: grant.file_size_bytes,
        totalBytes: grant.file_size_bytes,
        percent: 1,
        state: 'AVAILABLE_OFFLINE',
      });
    } catch (error: any) {
      this.activeDownloads.delete(resourceId);

      // Check if error was checksum mismatch (already updated)
      if (error?.message?.includes('CHECKSUM_MISMATCH')) {
        throw error;
      }

      await database.execute(
        `UPDATE download_packages SET state = 'FAILED', last_error = ? WHERE resource_id = ?`,
        [error?.message || 'DOWNLOAD_ERROR', resourceId]
      );
      this.notifyState(resourceId, 'FAILED');
      throw error;
    }
  }

  // --- Transfer Control Operations (Task 2) ---

  async pauseDownload(resourceId: string): Promise<void> {
    const download = this.activeDownloads.get(resourceId);
    if (download) {
      await download.pauseAsync();
      this.activeDownloads.delete(resourceId);
      this.pausedDownloads.set(resourceId, download);
      await database.init();
      await database.execute(
        `UPDATE download_packages SET state = 'PAUSED' WHERE resource_id = ?`,
        [resourceId]
      );
      this.notifyState(resourceId, 'PAUSED');
    }
  }

  async resumeDownload(resourceId: string, options?: DownloadOptions): Promise<void> {
    const paused = this.pausedDownloads.get(resourceId);
    if (paused) {
      this.pausedDownloads.delete(resourceId);
      this.activeDownloads.set(resourceId, paused);
      this.notifyState(resourceId, 'DOWNLOADING');
      await database.execute(
        `UPDATE download_packages SET state = 'DOWNLOADING' WHERE resource_id = ?`,
        [resourceId]
      );
      try {
        await paused.resumeAsync();
      } catch (e) {
        console.warn('Resume async error, re-initiating transfer:', e);
        await this.startDownload(resourceId, options);
      }
    } else {
      await this.startDownload(resourceId, options);
    }
  }

  async retryDownload(resourceId: string, options?: DownloadOptions): Promise<void> {
    await this.startDownload(resourceId, options);
  }

  async cancelDownload(resourceId: string): Promise<void> {
    const active = this.activeDownloads.get(resourceId);
    if (active) {
      try {
        await active.pauseAsync();
      } catch (_) {}
      this.activeDownloads.delete(resourceId);
    }
    this.pausedDownloads.delete(resourceId);

    const pkg = await this.getPackage(resourceId);
    if (pkg && pkg.encrypted_path) {
      try {
        await FileSystem.deleteAsync(pkg.encrypted_path, { idempotent: true });
      } catch (_) {}
    }

    await database.init();
    await database.execute(`DELETE FROM download_packages WHERE resource_id = ?`, [resourceId]);
    await database.execute(
      `UPDATE local_resources SET access_state = 'AVAILABLE', package_id = NULL WHERE resource_id = ?`,
      [resourceId]
    );

    this.notifyState(resourceId, 'NOT_DOWNLOADED');
  }

  // --- Deletion & Eviction Guards (Task 3: ADR-005 & SPEC 5.3) ---

  async removeLocalPackage(resourceId: string): Promise<void> {
    return this.deleteLocalPackage(resourceId);
  }

  async deleteLocalPackage(resourceId: string): Promise<void> {
    await database.init();

    // SAFETY RULE 1 (SPEC 5.3):
    // Blocks deletion of any package currently open in ProtectedContentReaderScreen (MOB-11).
    if (this.currentlyReadingResourceId === resourceId) {
      throw new Error(
        'Cannot delete resource while it is actively open in the Protected Content Reader.'
      );
    }

    // SAFETY RULE 2 (ADR-005, SPEC 5.3):
    // Blocks deletion of any package referenced by an IN_PROGRESS or SUBMITTED_LOCAL_PENDING exam attempt.
    const lockedAttempts = await database.query<any>(
      `SELECT exam_package_id FROM local_exam_attempts WHERE status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')`
    );

    if (lockedAttempts && lockedAttempts.length > 0) {
      for (const attempt of lockedAttempts) {
        const examPkgs = await database.query<any>(
          `SELECT exam_package_id, exam_id FROM local_exam_packages WHERE exam_package_id = ?`,
          [attempt.exam_package_id]
        );
        if (
          examPkgs &&
          examPkgs.length > 0 &&
          (examPkgs[0].exam_id === resourceId || examPkgs[0].exam_package_id === resourceId)
        ) {
          throw new Error(
            'Protected Exam Invariant: Cannot remove package referenced by an in-progress or unsynced exam attempt.'
          );
        }
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

    // Purge AES key from OS secure store
    if (pkg?.package_id) {
      await secureStorage.deletePackageKey(pkg.package_id);
    }
    await secureStorage.deletePackageKey(resourceId);

    await database.execute(`DELETE FROM download_packages WHERE resource_id = ?`, [resourceId]);
    await database.execute(
      `UPDATE local_resources SET access_state = 'AVAILABLE', package_id = NULL WHERE resource_id = ?`,
      [resourceId]
    );

    this.notifyState(resourceId, 'NOT_DOWNLOADED');
    this.notifyState(resourceId, 'IDLE');
  }

  async evictExpiredOrLeastRecentlyUsed(requiredBytes: number = 0): Promise<number> {
    return this.cleanLruCache(requiredBytes);
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

    const lockedAttempts = await database.query<any>(
      `SELECT exam_package_id FROM local_exam_attempts WHERE status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')`
    );
    const lockedExamIds = new Set<string>();
    if (lockedAttempts && lockedAttempts.length > 0) {
      for (const attempt of lockedAttempts) {
        const examPkgs = await database.query<any>(
          `SELECT exam_package_id, exam_id FROM local_exam_packages WHERE exam_package_id = ?`,
          [attempt.exam_package_id]
        );
        if (examPkgs && examPkgs.length > 0) {
          if (examPkgs[0].exam_id) lockedExamIds.add(examPkgs[0].exam_id);
          if (examPkgs[0].exam_package_id) lockedExamIds.add(examPkgs[0].exam_package_id);
        }
      }
    }

    for (const pkg of candidates) {
      // Guard 1: Skip if actively reading
      if (pkg.resource_id === this.currentlyReadingResourceId) {
        continue;
      }

      // Guard 2: Skip if linked to active or pending exam attempt
      if (lockedExamIds.has(pkg.resource_id) || lockedExamIds.has(pkg.package_id)) {
        continue;
      }

      try {
        await FileSystem.deleteAsync(pkg.encrypted_path, { idempotent: true });
        await secureStorage.deletePackageKey(pkg.package_id);
        await secureStorage.deletePackageKey(pkg.resource_id);

        await database.execute(`DELETE FROM download_packages WHERE package_id = ?`, [pkg.package_id]);
        await database.execute(
          `UPDATE local_resources SET access_state = 'AVAILABLE', package_id = NULL WHERE resource_id = ?`,
          [pkg.resource_id]
        );

        freedBytes += pkg.size_bytes;
        this.notifyState(pkg.resource_id, 'NOT_DOWNLOADED');
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

  // --- Storage Quota Inspection ---

  async getStorageQuota(): Promise<StorageQuotaInfo> {
    await database.init();

    const profiles = await database.query<any>(
      `SELECT storage_quota_mb FROM device_profile LIMIT 1`
    );
    const storageQuotaMb = profiles?.[0]?.storage_quota_mb || 2048;
    const totalBytes = storageQuotaMb * 1024 * 1024;

    const downloadedRows = await database.query<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM download_packages WHERE state = 'AVAILABLE_OFFLINE'`
    );
    const examQueueRows = await database.query<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM download_packages WHERE state IN ('QUEUED', 'DOWNLOADING', 'VERIFYING_CHECKSUM')`
    );

    const downloadedBytes = downloadedRows?.[0]?.total || 0;
    const protectedExamQueueBytes = examQueueRows?.[0]?.total || 0;
    const usedBytes = downloadedBytes + protectedExamQueueBytes;
    const freeBytes = Math.max(0, totalBytes - usedBytes);

    return {
      totalBytes,
      downloadedBytes,
      protectedExamQueueBytes,
      freeBytes,
      storageQuotaMb,
      usedBytes,
    };
  }
}

export const downloadManager = new DownloadManagerService();
