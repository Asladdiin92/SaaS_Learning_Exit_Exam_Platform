'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Badge } from '@/components/Badge';
import { adminApi, AdminUser, AdminUserDetail } from '@/lib/api';
import {
  Users,
  Search,
  Shield,
  Smartphone,
  CheckCircle2,
  XCircle,
  Trash2,
  Gift,
  Eye,
  X,
  Building2,
  Calendar,
  Lock,
} from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [grantDays, setGrantDays] = useState(30);
  const [grantAiQuota, setGrantAiQuota] = useState(100);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadUsers = async (q?: string) => {
    setIsLoading(true);
    try {
      const data = await adminApi.getUsers(q);
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(searchQuery);
  };

  const handleSelectUser = async (userId: string) => {
    setIsDetailLoading(true);
    try {
      const detail = await adminApi.getUserDetail(userId);
      setSelectedUser(detail);
      setActionSuccess(null);
    } catch (err) {
      alert('Failed to load user dossier');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleToggleVerification = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.updateUserStatus(selectedUser.user_id, {
        is_email_verified: !selectedUser.is_email_verified,
      });
      setSelectedUser({
        ...selectedUser,
        is_email_verified: !selectedUser.is_email_verified,
      });
      setActionSuccess('Verification status updated successfully.');
      loadUsers(searchQuery);
    } catch (err: any) {
      alert(err.message || 'Update failed');
    }
  };

  const handleChangeRole = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      await adminApi.updateUserStatus(selectedUser.user_id, {
        role: newRole,
      });
      setSelectedUser({
        ...selectedUser,
        primary_role: newRole,
      });
      setActionSuccess(`Role updated to ${newRole}.`);
      loadUsers(searchQuery);
    } catch (err: any) {
      alert(err.message || 'Role update failed');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Revoke access for this device session? The student will be logged out immediately.')) return;
    try {
      await adminApi.revokeDevice(deviceId);
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          devices: selectedUser.devices.map((d) =>
            d.device_id === deviceId ? { ...d, is_revoked: true } : d
          ),
        });
      }
      setActionSuccess('Device session terminated.');
    } catch (err: any) {
      alert(err.message || 'Revocation failed');
    }
  };

  const handleDirectGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await adminApi.grantEntitlement(selectedUser.user_id, {
        offline_download_allowed: true,
        storage_quota_mb: 2048,
        ai_monthly_quota: grantAiQuota,
        valid_days: grantDays,
      });
      setActionSuccess(`Granted ${grantDays} days of full access (+${grantAiQuota} AI queries).`);
      handleSelectUser(selectedUser.user_id);
    } catch (err: any) {
      alert(err.message || 'Grant failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <Navbar
        title="Users & Accessibility Control"
        subtitle="Manage global student accounts, workspace memberships, and device killswitches"
        onRefresh={() => loadUsers(searchQuery)}
        isRefreshing={isLoading}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by full name, email, or AAU username..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase tracking-wider text-slate-400 border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Devices</th>
                  <th className="py-3.5 px-4 font-semibold">Workspaces</th>
                  <th className="py-3.5 px-4 font-semibold">Joined</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      Loading user registry...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No matching users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{u.full_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            u.primary_role === 'SUPER_ADMIN'
                              ? 'purple'
                              : u.primary_role === 'TENANT_ADMIN'
                              ? 'info'
                              : 'neutral'
                          }
                        >
                          {u.primary_role}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.is_email_verified ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 size={13} />
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-amber-400">
                            <XCircle size={13} />
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {u.active_device_count} device{u.active_device_count === 1 ? '' : 's'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {u.membership_count} workspace{u.membership_count === 1 ? '' : 's'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSelectUser(u.user_id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded bg-surface-secondary hover:bg-surface-tertiary text-indigo-400 border border-border transition-colors"
                        >
                          Manage Dossier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Dossier Drawer Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-surface-secondary">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{selectedUser.full_name}</h2>
                  <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-tertiary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {actionSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300">
                    {actionSuccess}
                  </div>
                )}

                {/* Status & Role Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-secondary p-4 rounded-lg border border-border space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Account Status
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">
                        {selectedUser.is_email_verified ? 'Active & Verified' : 'Unverified / Suspended'}
                      </span>
                      <button
                        onClick={handleToggleVerification}
                        className={`px-3 py-1.5 text-xs font-bold rounded ${
                          selectedUser.is_email_verified
                            ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                        }`}
                      >
                        {selectedUser.is_email_verified ? 'Suspend / Unverify' : 'Verify Account'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface-secondary p-4 rounded-lg border border-border space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Primary Role
                    </span>
                    <div className="flex items-center gap-2">
                      {['STUDENT', 'INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN'].map((r) => (
                        <button
                          key={r}
                          onClick={() => handleChangeRole(r)}
                          className={`px-2.5 py-1 text-xs font-bold rounded border ${
                            selectedUser.primary_role === r
                              ? 'bg-brand text-white border-brand'
                              : 'bg-card text-slate-400 border-border hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct Entitlement Override (Platform Owner Power Tool) */}
                <div className="bg-surface-secondary p-4 rounded-lg border border-brand/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Gift size={14} />
                      Platform Owner Direct Entitlement Override
                    </span>
                    <span className="text-[11px] text-slate-400">Bypasses checkout immediately</span>
                  </div>
                  <form onSubmit={handleDirectGrant} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Validity (Days)</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={grantDays}
                        onChange={(e) => setGrantDays(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">AI Queries Quota</label>
                      <input
                        type="number"
                        min="10"
                        max="2000"
                        value={grantAiQuota}
                        onChange={(e) => setGrantAiQuota(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-1.5 px-3 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded transition-colors"
                      >
                        Grant Full Access
                      </button>
                    </div>
                  </form>
                </div>

                {/* Authorized Devices with Killswitch */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Authorized Devices ({selectedUser.devices.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedUser.devices.length === 0 ? (
                      <p className="text-xs text-slate-500">No devices registered.</p>
                    ) : (
                      selectedUser.devices.map((d) => (
                        <div
                          key={d.device_id}
                          className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <Smartphone size={16} className="text-slate-400" />
                            <div>
                              <div className="font-semibold text-white flex items-center gap-2">
                                <span>{d.device_name}</span>
                                {d.is_revoked && (
                                  <Badge variant="danger" size="sm">
                                    Revoked
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {d.os_version || 'Unknown OS'} • App v{d.app_version || '1.0.0'}
                              </div>
                            </div>
                          </div>
                          {!d.is_revoked && (
                            <button
                              onClick={() => handleRevokeDevice(d.device_id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 rounded transition-colors"
                            >
                              Revoke Session
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Workspace Memberships */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Tenancy Memberships ({selectedUser.memberships.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {selectedUser.memberships.map((m) => (
                      <div key={m.membership_id} className="p-3 rounded-lg bg-surface-secondary border border-border">
                        <div className="font-semibold text-white">{m.organization_name}</div>
                        <div className="text-[11px] text-slate-400">
                          Role: <span className="text-indigo-400 font-bold">{m.role}</span> • Status: {m.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
