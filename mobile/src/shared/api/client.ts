import { secureStorage } from '../secure-storage';
import * as Crypto from 'expo-crypto';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export const generateUUID = (): string => {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch (_) {}

  // Fallback RFC4122 v4 UUID generator for Node.js / Jest test environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export class ApiClient {
  private activeTenantId: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  setAccessToken(token: string | null): void {
    secureStorage.setInMemoryAccessToken(token);
  }

  getAccessToken(): string | null {
    return secureStorage.getInMemoryAccessToken();
  }

  setActiveTenantId(tenantId: string | null): void {
    this.activeTenantId = tenantId;
    secureStorage.setActiveTenantId(tenantId);
  }

  getActiveTenantId(): string | null {
    return this.activeTenantId;
  }

  /**
   * Single-flight token refresh mutex.
   * Concurrent 401s all await the same in-flight refresh promise.
   */
  private async refreshTokens(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        const deviceId = await secureStorage.getDeviceId();

        if (!refreshToken) {
          this.setAccessToken(null);
          throw new Error('No refresh token available');
        }

        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Device-ID': deviceId,
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
            device_id: deviceId,
          }),
        });

        if (!refreshRes.ok) {
          await secureStorage.clearRefreshToken();
          this.setAccessToken(null);
          throw new Error('Refresh token revoked or expired');
        }

        const refreshData = await refreshRes.json();
        this.setAccessToken(refreshData.access_token);
        await secureStorage.saveRefreshToken(refreshData.refresh_token);

        return refreshData.access_token as string;
      } catch (err) {
        this.setAccessToken(null);
        throw err;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T = any>(
    path: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${API_BASE_URL}${cleanPath}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // 1. Inject volatile in-memory access token
    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. Inject active Tenant ID header (omitted when in Personal Workspace)
    let currentTenant = this.activeTenantId;
    if (!currentTenant) {
      currentTenant = await secureStorage.getActiveTenantId();
    }
    if (currentTenant) {
      headers['X-Tenant-ID'] = currentTenant;
    }

    // 3. Inject Device ID
    const deviceId = await secureStorage.getDeviceId();
    if (deviceId) {
      headers['X-Device-ID'] = deviceId;
    }

    // 4. Inject Idempotency-Key on mutating requests
    const method = options.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = generateUUID();
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 5. Single-Flight 401 Interceptor with Rotating Token Refresh
    if (
      response.status === 401 &&
      !isRetry &&
      !cleanPath.includes('/auth/login') &&
      !cleanPath.includes('/auth/refresh')
    ) {
      // Single-flight lock: All concurrent 401 callers await the same in-flight refresh promise
      await this.refreshTokens();

      // Replay original request with updated access token
      return this.request<T>(path, options, true);
    }

    if (!response.ok) {
      let errorDetail = `Request failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorJson.message || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    // Check if 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T = any>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = any>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export const apiClient = api;
