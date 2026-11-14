import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEYS = {
  REFRESH_TOKEN: 'sec_auth_refresh_token',
  DEVICE_ID: 'sec_device_uuid',
  BIOMETRIC_GRANT: 'sec_biometric_offline_grant',
  ACTIVE_TENANT: 'sec_active_tenant_id',
  PACKAGE_KEY_PREFIX: 'sec_pkg_key_',
};

export interface OfflineWorkspace {
  id: string;
  name: string;
  role?: string;
  is_institution?: boolean;
}

export interface BiometricGrant {
  user_id?: string;
  email: string;
  fullName: string;
  full_name?: string;
  expiresAt: string;
  expires_at?: number | string;
  tenantId: string | null;
  tenantName: string | null;
  workspaces?: OfflineWorkspace[];
  issued_at?: string;
  biometric_enabled?: boolean;
}

export type OfflineBiometricGrant = BiometricGrant;

// In-Memory Volatile Storage for 15-minute Access Token
// STRICT ARCHITECTURAL INVARIANT (ADR-002, Task 2):
// Never write access_token to AsyncStorage, SecureStore, or SQLite.
let volatileAccessToken: string | null = null;

export const volatileTokenStore = {
  getAccessToken(): string | null {
    return volatileAccessToken;
  },
  setAccessToken(token: string | null): void {
    volatileAccessToken = token;
  },
  clearAccessToken(): void {
    volatileAccessToken = null;
  },
};

export const secureStorage = {
  // Volatile Memory Token Helpers
  getInMemoryAccessToken(): string | null {
    return volatileTokenStore.getAccessToken();
  },
  setInMemoryAccessToken(token: string | null): void {
    volatileTokenStore.setAccessToken(token);
  },
  clearInMemoryAccessToken(): void {
    volatileTokenStore.clearAccessToken();
  },

  // Refresh Token in OS Keychain / Keystore
  async saveRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (e) {
      console.warn('SecureStore saveRefreshToken error:', e);
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    } catch (e) {
      console.warn('SecureStore getRefreshToken error:', e);
      return null;
    }
  },

  async clearRefreshToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    } catch (e) {
      console.warn('SecureStore clearRefreshToken error:', e);
    }
  },

  // Device UUID (Generated once on first launch and persisted)
  async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);
      if (!deviceId) {
        if (Crypto.randomUUID) {
          deviceId = Crypto.randomUUID();
        } else {
          deviceId = '10000000-1000-4000-8000-100000000001';
        }
        await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch (e) {
      console.warn('SecureStore getDeviceId fallback:', e);
      return '00000000-0000-4000-8000-000000000000';
    }
  },

  // Offline Biometric Grant
  async setBiometricGrant(grant: BiometricGrant): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        KEYS.BIOMETRIC_GRANT,
        JSON.stringify(grant),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
      );
    } catch (e) {
      console.warn('SecureStore setBiometricGrant error:', e);
    }
  },

  async getBiometricGrant(): Promise<BiometricGrant | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.BIOMETRIC_GRANT);
      if (!data) return null;
      return JSON.parse(data) as BiometricGrant;
    } catch (e) {
      console.warn('SecureStore getBiometricGrant error:', e);
      return null;
    }
  },

  async clearBiometricGrant(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.BIOMETRIC_GRANT);
    } catch (e) {
      console.warn('SecureStore clearBiometricGrant error:', e);
    }
  },

  async isOfflineGrantValid(): Promise<{
    valid: boolean;
    identity: BiometricGrant | null;
  }> {
    try {
      const grant = await this.getBiometricGrant();
      if (!grant) {
        return { valid: false, identity: null };
      }

      const rawExpiry = grant.expires_at ?? grant.expiresAt;
      if (!rawExpiry) {
        return { valid: false, identity: null };
      }

      const expiresMs =
        typeof rawExpiry === 'number'
          ? rawExpiry
          : new Date(rawExpiry).getTime();

      if (isNaN(expiresMs) || expiresMs <= Date.now()) {
        return { valid: false, identity: null };
      }

      if (grant.biometric_enabled === false) {
        return { valid: false, identity: null };
      }

      return { valid: true, identity: grant };
    } catch (e) {
      console.warn('SecureStore isOfflineGrantValid error:', e);
      return { valid: false, identity: null };
    }
  },

  // Wrapped AES-256 Package Keys
  async savePackageKey(resourceId: string, wrappedKey: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        `${KEYS.PACKAGE_KEY_PREFIX}${resourceId}`,
        wrappedKey,
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }
      );
    } catch (e) {
      console.warn(`SecureStore savePackageKey(${resourceId}) error:`, e);
    }
  },

  async getPackageKey(resourceId: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(
        `${KEYS.PACKAGE_KEY_PREFIX}${resourceId}`
      );
    } catch (e) {
      console.warn(`SecureStore getPackageKey(${resourceId}) error:`, e);
      return null;
    }
  },

  async deletePackageKey(resourceId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(
        `${KEYS.PACKAGE_KEY_PREFIX}${resourceId}`
      );
    } catch (e) {
      console.warn(`SecureStore deletePackageKey(${resourceId}) error:`, e);
    }
  },

  // Active Tenant Scoping
  async setActiveTenantId(tenantId: string | null): Promise<void> {
    try {
      if (tenantId) {
        await SecureStore.setItemAsync(KEYS.ACTIVE_TENANT, tenantId);
      } else {
        await SecureStore.deleteItemAsync(KEYS.ACTIVE_TENANT);
      }
    } catch (e) {
      console.warn('SecureStore setActiveTenantId error:', e);
    }
  },

  async getActiveTenantId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.ACTIVE_TENANT);
    } catch (e) {
      return null;
    }
  },

  // Complete Secret Purge on Logout
  async wipeAllSecrets(): Promise<void> {
    volatileTokenStore.clearAccessToken();
    await this.clearRefreshToken();
    await this.clearBiometricGrant();
    await this.setActiveTenantId(null);
  },
};
