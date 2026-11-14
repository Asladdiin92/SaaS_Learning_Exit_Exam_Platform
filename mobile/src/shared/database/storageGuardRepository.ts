import { database } from './db';

export interface ProtectedStorageCounts {
  activeAttemptsCount: number;
  pendingSyncCount: number;
  lockedPackagesCount: number;
  isEvictionSafe: boolean;
}

export interface EvictionResult {
  targetBytesRequested: number;
  bytesFreed: number;
  evictedPackageIds: string[];
  remainingBytesNeeded: number;
  skippedActiveCount: number;
}

export interface LocalDownloadPackage {
  package_id: string;
  resource_id: string;
  version: number;
  encrypted_path: string;
  sha256_checksum: string | null;
  size_bytes: number;
  state: string;
  grant_id: string | null;
  license_expiry: string | null;
  last_opened_at: string | null;
}

export const storageGuardRepository = {
  /**
   * Get count of protected active attempts and pending sync operations (MOB-27 / Section 8.2)
   */
  async getProtectedCounts(userId: string): Promise<ProtectedStorageCounts> {
    const attempts = await database.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM local_exam_attempts 
       WHERE user_id = ? AND status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING');`,
      [userId]
    );
    const activeAttemptsCount = attempts[0]?.count || 0;

    const syncOps = await database.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_operations 
       WHERE user_id = ? AND state != 'SERVER_ACCEPTED';`,
      [userId]
    );
    const pendingSyncCount = syncOps[0]?.count || 0;

    const lockedPkgs = await database.query<{ exam_package_id: string }>(
      `SELECT DISTINCT exam_package_id FROM local_exam_attempts 
       WHERE user_id = ? AND status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING');`,
      [userId]
    );
    const lockedPackagesCount = lockedPkgs.length;

    return {
      activeAttemptsCount,
      pendingSyncCount,
      lockedPackagesCount,
      isEvictionSafe: activeAttemptsCount === 0 && pendingSyncCount === 0,
    };
  },

  /**
   * Evict eligible cached packages to free storage under memory pressure (MOB-27).
   * HARD INVARIANTS:
   * 1. NEVER delete or evict local_exam_attempts.
   * 2. NEVER delete or evict local_answer_events.
   * 3. NEVER delete or evict sync_operations.
   * 4. NEVER delete a download_package referenced by an active attempt.
   */
  async evictEligibleCacheOnly(targetBytesToFree: number): Promise<EvictionResult> {
    if (targetBytesToFree <= 0) {
      return {
        targetBytesRequested: targetBytesToFree,
        bytesFreed: 0,
        evictedPackageIds: [],
        remainingBytesNeeded: 0,
        skippedActiveCount: 0,
      };
    }

    return await database.withTransaction(async (tx) => {
      // 1. Identify all packages actively referenced by IN_PROGRESS or SUBMITTED_LOCAL_PENDING attempts
      const activeAttempts = await tx.query<{ exam_package_id: string }>(
        `SELECT DISTINCT exam_package_id FROM local_exam_attempts 
         WHERE status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING');`
      );
      const lockedIds = new Set(activeAttempts.map((a) => a.exam_package_id));

      // 2. Fetch all cached download packages
      const packages = await tx.query<LocalDownloadPackage>(
        `SELECT * FROM download_packages;`
      );

      // 3. Filter candidates: Exclude packages locked by active attempts
      let skippedActiveCount = 0;
      const eligibleCandidates: LocalDownloadPackage[] = [];

      for (const pkg of packages) {
        if (lockedIds.has(pkg.package_id) || lockedIds.has(pkg.resource_id)) {
          skippedActiveCount++;
          continue; // HARD GUARD: Refuse to evict
        }
        eligibleCandidates.push(pkg);
      }

      // 4. Sort eligible candidates:
      // Priority 1: Expired licenses first
      // Priority 2: Least-recently-opened (LRU)
      const now = new Date().toISOString();
      eligibleCandidates.sort((a, b) => {
        const aExpired = a.license_expiry && a.license_expiry < now;
        const bExpired = b.license_expiry && b.license_expiry < now;

        if (aExpired && !bExpired) return -1;
        if (!aExpired && bExpired) return 1;

        const aOpened = a.last_opened_at || '';
        const bOpened = b.last_opened_at || '';
        if (aOpened < bOpened) return -1;
        if (aOpened > bOpened) return 1;
        return 0;
      });

      // 5. Evict until targetBytesToFree is achieved
      let bytesFreed = 0;
      const evictedPackageIds: string[] = [];

      for (const pkg of eligibleCandidates) {
        if (bytesFreed >= targetBytesToFree) break;

        await tx.execute(
          `DELETE FROM download_packages WHERE package_id = ?;`,
          [pkg.package_id]
        );

        // Update local_resources access state back to AVAILABLE
        await tx.execute(
          `UPDATE local_resources SET access_state = 'AVAILABLE' WHERE resource_id = ?;`,
          [pkg.resource_id]
        );

        bytesFreed += pkg.size_bytes || 0;
        evictedPackageIds.push(pkg.package_id);
      }

      const remainingBytesNeeded = Math.max(0, targetBytesToFree - bytesFreed);

      return {
        targetBytesRequested: targetBytesToFree,
        bytesFreed,
        evictedPackageIds,
        remainingBytesNeeded,
        skippedActiveCount,
      };
    });
  },

  /**
   * Get storage usage breakdown
   */
  async getStorageUsage(): Promise<{
    downloadedBytes: number;
    packageCount: number;
  }> {
    const rows = await database.query<LocalDownloadPackage>(
      `SELECT * FROM download_packages WHERE state = 'AVAILABLE_OFFLINE';`
    );
    const downloadedBytes = rows.reduce((acc, cur) => acc + (cur.size_bytes || 0), 0);
    return {
      downloadedBytes,
      packageCount: rows.length,
    };
  },
};
