export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const DEFAULT_ADMIN_KEY = 'asladin-platform-owner-master-key-2026';

export interface AdminStats {
  total_users: number;
  active_devices: number;
  total_institutions: number;
  total_attempts: number;
  total_orders: number;
  total_revenue_etb: number;
  total_questions: number;
  total_courses: number;
  ai_queries_quota_allocated: number;
  system_status: string;
}

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string;
  is_email_verified: boolean;
  created_at: string;
  membership_count: number;
  active_device_count: number;
  primary_role: string;
}

export interface AdminUserDetail extends AdminUser {
  updated_at: string;
  memberships: Array<{
    membership_id: string;
    tenant_id: string;
    organization_name: string;
    role: string;
    status: string;
    cohort_name?: string;
    joined_at?: string;
  }>;
  devices: Array<{
    device_id: string;
    device_name: string;
    os_version?: string;
    app_version?: string;
    is_revoked: boolean;
    last_seen_at?: string;
  }>;
  entitlements: Array<{
    entitlement_id: string;
    source_type: string;
    offline_download_allowed: boolean;
    storage_quota_mb: number;
    ai_monthly_quota: number;
    valid_from?: string;
    valid_until?: string;
    is_active: boolean;
  }>;
  recent_attempts: Array<{
    attempt_id: string;
    status: string;
    score?: number;
    passed?: boolean;
    created_at?: string;
  }>;
  recent_orders: Array<{
    order_id: string;
    product_name: string;
    amount: number;
    currency: string;
    status: string;
    created_at?: string;
  }>;
}

export interface ActivityLog {
  id: string;
  category: 'AUTH' | 'SYNC' | 'EXAM_GRADING' | 'COMMERCE' | 'SECURITY';
  action: string;
  actor_email?: string;
  description: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details?: Record<string, any>;
}

export interface CourseItem {
  course_id: number;
  theme_id: number;
  theme_name: string;
  code: string;
  title: string;
  credit_hours: number;
  general_objective?: string;
  resource_count: number;
  question_count: number;
}

export interface QuestionItem {
  question_id: string;
  course_id: number;
  course_code: string;
  question_text: string;
  bloom_level: string;
  difficulty?: string;
  version?: number;
  options_count: number;
  explanation?: string;
  options: Array<{
    label: string;
    text: string;
    is_correct: boolean;
  }>;
}

export interface ResourceItem {
  resource_id: string;
  course_id: number;
  course_code: string;
  course_title?: string;
  type: string;
  title: string;
  storage_bucket: string;
  storage_object_key: string;
  file_size_bytes: number;
  sha256_checksum?: string;
  is_offline_eligible: boolean;
  version: number;
  published_at?: string;
}

export interface ProductItem {
  product_id: string;
  code: string;
  name: string;
  description?: string;
  price_amount: number;
  currency: string;
  billing_interval?: string;
  is_active: boolean;
  features_summary: string[];
}

export interface OrderItem {
  order_id: string;
  user_email: string;
  product_name: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string;
  created_at: string;
}

export interface PendingTransferItem {
  order_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  product_id: string;
  product_code: string;
  product_title: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_reference: string;
  sender_phone_or_name?: string;
  notes?: string;
  status: string;
  submitted_at: string;
}

export interface TenantLicenseItem {
  tenant_id: string;
  organization_name: string;
  slug: string;
  status: string;
  license_id?: string;
  contract_reference?: string;
  total_seats: number;
  assigned_seats: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
}

export interface SystemHealth {
  status: string;
  api_version: string;
  database: {
    provider: string;
    pooler_port: number;
    latency_ms: number;
    pgvector_extension: string;
  };
  storage: {
    driver: string;
    bucket: string;
    status: string;
  };
  active_pooler_connections: number;
  applied_migrations: number;
  uptime_timestamp: string;
}

export interface MigrationItem {
  filename: string;
  checksum?: string;
  applied_at?: string;
  status: string;
}

export interface LakeMirrorStatus {
  status: string;
  snapshot_watermark_seq: number;
  raw_mirror_path: string;
  curated_analytics_path: string;
  last_verified_at: string;
}

export interface DatabaseStatus {
  applied_migrations: MigrationItem[];
  table_counts: Record<string, number>;
  latest_sync_seq: number;
  lake_mirror: LakeMirrorStatus;
}

class AdminApiClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Admin-Key': DEFAULT_ADMIN_KEY,
    };
    if (typeof window !== 'undefined') {
      const storedKey =
        sessionStorage.getItem('asladin_admin_key') ||
        localStorage.getItem('asladin_admin_key');
      if (storedKey) {
        headers['X-Admin-Key'] = storedKey;
      }
      const token =
        sessionStorage.getItem('asladin_admin_jwt') ||
        sessionStorage.getItem('asladin_admin_token') ||
        localStorage.getItem('asladin_admin_jwt') ||
        localStorage.getItem('asladin_admin_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }

    return res.json();
  }

  // 1. Overview
  async getOverview(): Promise<AdminStats> {
    return this.request<AdminStats>('/admin/overview');
  }

  // 2. Users
  async getUsers(q?: string, limit = 50, offset = 0): Promise<AdminUser[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) params.set('q', q);
    return this.request<AdminUser[]>(`/admin/users?${params.toString()}`);
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}`);
  }

  async updateUserStatus(userId: string, data: { is_email_verified?: boolean; role?: string; cohort_name?: string }) {
    return this.request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async grantEntitlement(userId: string, data: { offline_download_allowed?: boolean; storage_quota_mb?: number; ai_monthly_quota?: number; valid_days?: number }) {
    return this.request(`/admin/users/${userId}/entitlements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeDevice(deviceId: string) {
    return this.request(`/admin/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  // 3. Activity Logs
  async getActivityLogs(category?: string, limit = 50): Promise<ActivityLog[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (category) params.set('category', category);
    return this.request<ActivityLog[]>(`/admin/activity-logs?${params.toString()}`);
  }

  // 4. Curriculum & Database
  async getCourses(): Promise<CourseItem[]> {
    return this.request<CourseItem[]>('/admin/curriculum/courses');
  }

  async updateCourse(courseId: number, data: { title?: string; credit_hours?: number; general_objective?: string }) {
    return this.request(`/admin/curriculum/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getQuestions(params?: { course_id?: number; bloom_level?: string; q?: string; limit?: number }): Promise<QuestionItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.course_id) searchParams.set('course_id', String(params.course_id));
    if (params?.bloom_level) searchParams.set('bloom_level', params.bloom_level);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return this.request<QuestionItem[]>(`/admin/questions?${searchParams.toString()}`);
  }

  async createQuestion(data: any) {
    return this.request('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuestion(questionId: string, data: any) {
    return this.request(`/admin/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // 4b. Course Resource Packages (ADR-009)
  async getResources(params?: { course_id?: number; type?: string }): Promise<ResourceItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.course_id) searchParams.set('course_id', String(params.course_id));
    if (params?.type) searchParams.set('type', params.type);
    return this.request<ResourceItem[]>(`/admin/resources?${searchParams.toString()}`);
  }

  async createResource(data: {
    course_id: number;
    type: string;
    title: string;
    storage_bucket?: string;
    storage_object_key: string;
    file_size_bytes?: number;
    sha256_checksum?: string;
    is_offline_eligible?: boolean;
  }): Promise<ResourceItem> {
    return this.request<ResourceItem>('/admin/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateResource(
    resourceId: string,
    data: Partial<{
      title: string;
      type: string;
      storage_bucket: string;
      storage_object_key: string;
      file_size_bytes: number;
      sha256_checksum: string;
      is_offline_eligible: boolean;
    }>
  ): Promise<ResourceItem> {
    return this.request<ResourceItem>(`/admin/resources/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // 5. Commerce & Products
  async getProducts(): Promise<ProductItem[]> {
    return this.request<ProductItem[]>('/admin/commerce/products');
  }

  async updateProduct(productId: string, data: Partial<ProductItem>) {
    return this.request(`/admin/commerce/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getOrders(limit = 50): Promise<OrderItem[]> {
    return this.request<OrderItem[]>(`/admin/commerce/orders?limit=${limit}`);
  }

  // 5c. Manual Bank & Telebirr Approvals
  async getPendingTransfers(): Promise<PendingTransferItem[]> {
    return this.request<PendingTransferItem[]>('/admin/pending-transfers');
  }

  async approveManualTransfer(orderId: string): Promise<{ status: string; order_id: string; message: string; entitlement_id?: string }> {
    return this.request(`/admin/orders/${orderId}/approve`, {
      method: 'POST',
    });
  }

  async rejectManualTransfer(orderId: string, reason?: string): Promise<{ status: string; order_id: string; message: string }> {
    return this.request(`/admin/orders/${orderId}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, {
      method: 'POST',
    });
  }

  // 5b. Institutional B2B Licenses
  async getTenantsLicenses(): Promise<TenantLicenseItem[]> {
    return this.request<TenantLicenseItem[]>('/admin/tenants-licenses');
  }

  async provisionTenantLicense(data: {
    organization_name: string;
    slug?: string;
    licensed_seats: number;
    contract_reference?: string;
    duration_days?: number;
    offline_download_allowed?: boolean;
  }): Promise<TenantLicenseItem> {
    return this.request<TenantLicenseItem>('/admin/tenants-licenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 6. System Health & Database Diagnostics
  async getSystemHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/admin/system/health');
  }

  async getDatabaseStatus(): Promise<DatabaseStatus> {
    return this.request<DatabaseStatus>('/admin/database-status');
  }
}

export const adminApi = new AdminApiClient();
