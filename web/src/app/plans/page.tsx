'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Filter,
  RefreshCw,
  Sparkles,
  HardDrive,
  Calendar,
  Building2,
  Users,
  Plus,
  School,
  Check,
  Copy,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { adminApi, ProductItem, OrderItem, TenantLicenseItem, PendingTransferItem } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';

export default function PlansPage() {
  const [activeTab, setActiveTab] = useState<'b2c' | 'b2b' | 'transfers' | 'orders'>('b2c');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [tenantsLicenses, setTenantsLicenses] = useState<TenantLicenseItem[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter state for orders
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editName, setEditName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Provision / Extend Institutional Seat License Modal
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licOrgName, setLicOrgName] = useState('Haramaya University — CCI');
  const [licSlug, setLicSlug] = useState('hu-cci-exit-exam');
  const [licSeats, setLicSeats] = useState(100);
  const [licDurationDays, setLicDurationDays] = useState(180);
  const [licContractRef, setLicContractRef] = useState('HU-CCI-ENT-2026-002');
  const [licOfflineAllowed, setLicOfflineAllowed] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prodRes, ordRes, licRes, transRes] = await Promise.all([
        adminApi.getProducts(),
        adminApi.getOrders(100),
        adminApi.getTenantsLicenses(),
        adminApi.getPendingTransfers(),
      ]);
      setProducts(prodRes);
      setOrders(ordRes);
      setTenantsLicenses(licRes);
      setPendingTransfers(transRes);
    } catch (err: any) {
      console.error('Failed to load plans data:', err);
      setError(err.message || 'Failed to load plans and commerce data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveTransfer = async (orderId: string, studentName: string) => {
    try {
      setActionLoadingId(orderId);
      setActionMessage(null);
      const res = await adminApi.approveManualTransfer(orderId);
      setActionMessage({
        type: 'success',
        text: `Approved! Access & feature entitlements released for ${studentName}.`,
      });
      await fetchData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Approval failed: ${err.message || 'Server error'}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectTransfer = async (orderId: string, studentName: string) => {
    const reason = window.prompt(`Enter rejection reason for ${studentName}'s transfer:`, 'Transaction reference not found in bank/Telebirr records');
    if (reason === null) return; // User cancelled
    try {
      setActionLoadingId(orderId);
      setActionMessage(null);
      await adminApi.rejectManualTransfer(orderId, reason);
      setActionMessage({
        type: 'success',
        text: `Transfer for ${studentName} was rejected.`,
      });
      await fetchData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Rejection failed: ${err.message || 'Server error'}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setEditPrice(p.price_amount);
    setEditActive(p.is_active);
    setEditName(p.name);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setSaving(true);
      await adminApi.updateProduct(editingProduct.product_id, {
        name: editName,
        price_amount: Number(editPrice),
        is_active: editActive,
      });
      setEditingProduct(null);
      await fetchData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openProvisionModal = (existingTenant?: TenantLicenseItem) => {
    if (existingTenant) {
      setLicOrgName(existingTenant.organization_name);
      setLicSlug(existingTenant.slug);
      setLicContractRef(
        existingTenant.contract_reference
          ? `${existingTenant.contract_reference}-EXT`
          : `CONTRACT-${existingTenant.slug.toUpperCase()}-EXT`
      );
      setLicSeats(50);
      setLicDurationDays(180);
    } else {
      setLicOrgName('');
      setLicSlug('');
      setLicContractRef('');
      setLicSeats(100);
      setLicDurationDays(180);
    }
    setShowLicenseModal(true);
  };

  const handleProvisionLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProvisioning(true);
      await adminApi.provisionTenantLicense({
        organization_name: licOrgName,
        slug: licSlug || undefined,
        licensed_seats: Number(licSeats),
        contract_reference: licContractRef || undefined,
        duration_days: Number(licDurationDays),
        offline_download_allowed: licOfflineAllowed,
      });
      setShowLicenseModal(false);
      await fetchData();
    } catch (err: any) {
      alert(`Provision failed: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesProvider =
      providerFilter === 'ALL' ||
      (o.provider && o.provider.toUpperCase() === providerFilter);
    const matchesStatus =
      statusFilter === 'ALL' || o.status.toUpperCase() === statusFilter;
    return matchesProvider && matchesStatus;
  });

  const totalRevenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);

  const activeTiersCount = products.filter((p) => p.is_active).length;

  const totalB2BSeats = tenantsLicenses.reduce((acc, t) => acc + t.total_seats, 0);
  const activeTenantsCount = tenantsLicenses.filter((t) => t.is_active).length;

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-indigo-400">&lt;commerce-control/&gt;</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">Ethiopian Birr (ETB) Ecosystem</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <CreditCard className="text-indigo-400" size={26} />
            <span>Plans, Pricing & Commercial Access</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure subscription tiers, offline download allowances, AI query quotas, and audit live Telebirr, Chapa & Stripe orders.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-surface-secondary text-sm font-medium text-slate-300 transition-colors self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Active Commercial Tiers"
          value={`${activeTiersCount} / ${products.length}`}
          change="Available in Mobile App"
          trend="Active"
          icon={<CreditCard size={18} />}
        />
        <StatCard
          title="Total Paid Revenue"
          value={`${totalRevenue.toLocaleString()} ETB`}
          change="Direct & Webhook Settled"
          trend="Settled"
          icon={<DollarSign size={18} />}
        />
        <StatCard
          title="Total Transactions"
          value={orders.length}
          change={`${orders.filter((o) => o.status === 'PAID').length} Successful`}
          trend="Total"
          icon={<ShoppingCart size={18} />}
        />
        <StatCard
          title="Institutional B2B Seats"
          value={`${totalB2BSeats.toLocaleString()} Seats`}
          change={`${activeTenantsCount} Active Campuses`}
          trend="Active"
          icon={<School size={18} />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('b2c')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'b2c'
              ? 'bg-brand text-white shadow'
              : 'bg-card border border-border text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard size={14} />
          <span>B2C Plans & Pricing ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('b2b')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'b2b'
              ? 'bg-brand text-white shadow'
              : 'bg-card border border-border text-slate-400 hover:text-white'
          }`}
        >
          <School size={14} />
          <span>Institutional B2B Seat Licenses ({tenantsLicenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'transfers'
              ? 'bg-amber-600 text-white shadow'
              : 'bg-card border border-border text-slate-400 hover:text-white'
          }`}
        >
          <Building2 size={14} />
          <span>Direct Bank & Telebirr Approvals ({pendingTransfers.length})</span>
          {pendingTransfers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold">
              {pendingTransfers.length} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'bg-brand text-white shadow'
              : 'bg-card border border-border text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart size={14} />
          <span>Transactions & Orders ({orders.length})</span>
        </button>
      </div>

      {/* TAB 1: B2C Product Catalog Section */}
      {activeTab === 'b2c' && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Commercial Product Catalog</h2>
              <p className="text-xs text-slate-400">
                Live pricing rendered across mobile screens (MOB-14 SubscriptionPlans & MOB-15 PaymentCheckout).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((prod) => (
              <div
                key={prod.product_id}
                className={`bg-card border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-indigo-500/50 ${
                  prod.is_active ? 'border-border' : 'border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-secondary text-indigo-400 font-semibold border border-indigo-900/40">
                      {prod.code}
                    </span>
                    <Badge variant={prod.is_active ? 'success' : 'default'}>
                      {prod.is_active ? 'Active' : 'Archived'}
                    </Badge>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{prod.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2">{prod.description}</p>

                  <div className="bg-surface-secondary/70 rounded-lg p-3 mb-4">
                    <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-1">
                      <span>{prod.price_amount.toLocaleString()}</span>
                      <span className="text-xs font-semibold text-slate-400">{prod.currency}</span>
                    </div>
                    {prod.billing_interval && (
                      <span className="text-[11px] text-indigo-300 font-medium">
                        Interval: {prod.billing_interval}
                      </span>
                    )}
                  </div>

                  {/* Features Pill List */}
                  <div className="space-y-2 mb-5">
                    {prod.features_summary.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => openEditModal(prod)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-secondary hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors border border-border"
                >
                  <Edit2 size={13} />
                  <span>Edit Pricing & Status</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Institutional B2B Seat Licenses Panel */}
      {activeTab === 'b2b' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <School size={20} className="text-brand" />
                <span>Institutional University B2B Seat Licenses</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enterprise multi-tenant seat allocations per ADR-003 and Phase 11. Licenses grant offline download & AI access to student cohorts.
              </p>
            </div>

            <button
              onClick={() => openProvisionModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors shadow self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>Provision / Extend University Seats</span>
            </button>
          </div>

          {/* Institutional Licenses Table */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-surface-secondary text-xs uppercase tracking-wider text-slate-400 border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold">University Workspace</th>
                    <th className="py-3 px-4 font-semibold">Contract Reference</th>
                    <th className="py-3 px-4 font-semibold">Contracted Capacity</th>
                    <th className="py-3 px-4 font-semibold">Seat Utilization</th>
                    <th className="py-3 px-4 font-semibold">Contract Expiry</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenantsLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                        No institutional tenants found. Click "Provision / Extend University Seats" to allocate.
                      </td>
                    </tr>
                  ) : (
                    tenantsLicenses.map((inst) => {
                      const utilPct = inst.total_seats > 0
                        ? Math.min(100, Math.round((inst.assigned_seats / inst.total_seats) * 100))
                        : 0;
                      return (
                        <tr key={inst.tenant_id} className="hover:bg-surface-secondary/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <Building2 size={15} className="text-indigo-400 shrink-0" />
                              <span>{inst.organization_name}</span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                              {inst.slug}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-indigo-300">
                            {inst.contract_reference || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            {inst.total_seats > 0 ? `${inst.total_seats.toLocaleString()} Seats` : 'Unlicensed'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="w-36">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-mono text-slate-300">
                                  {inst.assigned_seats} / {inst.total_seats}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {utilPct}%
                                </span>
                              </div>
                              <div className="w-full bg-surface-secondary rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    utilPct >= 90
                                      ? 'bg-rose-500'
                                      : utilPct >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${utilPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            {inst.valid_until ? (
                              <span>{new Date(inst.valid_until).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={inst.is_active ? 'success' : 'neutral'}>
                              {inst.is_active ? 'Active Contract' : 'No Contract'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => openProvisionModal(inst)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-secondary hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-border"
                            >
                              <Plus size={12} />
                              <span>Extend Seats</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Direct Bank & Telebirr Approvals */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {/* Bank & Telebirr Accounts Information Card */}
          <div className="bg-card border border-amber-500/30 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="warning">Platform Owner Manual Clearance</Badge>
                  <span className="text-xs text-slate-400">Direct Deposit Verification</span>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="text-amber-400" size={20} />
                  <span>Direct Bank & Telebirr Manual Approvals</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Students transfer registration/plan fees directly to your accounts below and submit their SMS transaction code from their phones.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  <span>Check Transfers</span>
                </button>
              </div>
            </div>

            {/* Official Beneficiary Account Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
                    <span className="text-xs font-bold text-slate-200">Commercial Bank of Ethiopia (CBE)</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-700/40">Direct Deposit</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Account Number:</span>
                    <span className="text-sm font-mono font-bold text-white tracking-wider">1000531623421</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Account Holder:</span>
                    <span className="text-xs font-semibold text-slate-200">ASLADIN ABDUKEDIR</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
                    <span className="text-xs font-bold text-slate-200">Telebirr Mobile Money</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-700/40">Ethio Telecom</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Phone / Account:</span>
                    <span className="text-sm font-mono font-bold text-white tracking-wider">0992947709</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Account Holder:</span>
                    <span className="text-xs font-semibold text-slate-200">ASLADIN ABDUKEDIR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Message Feedback Banner */}
          {actionMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={18} className="text-red-400" />
                )}
                <span>{actionMessage.text}</span>
              </div>
              <button
                onClick={() => setActionMessage(null)}
                className="text-xs underline hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Pending Transfers List / Table */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Pending Payment Claims</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    {pendingTransfers.length} awaiting verification
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Check your CBE mobile banking or Telebirr app for matching transaction code, then click Approve to unlock the student's study package.
                </p>
              </div>
            </div>

            {pendingTransfers.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl bg-slate-900/30">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-200">No Pending Transfer Claims</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  All submitted CBE and Telebirr direct deposits have been verified. Any new student payments submitted on the mobile app will immediately appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-slate-400 font-mono">
                      <th className="py-3 px-3">STUDENT</th>
                      <th className="py-3 px-3">METHOD</th>
                      <th className="py-3 px-3">TRANSACTION REF / SMS</th>
                      <th className="py-3 px-3">SENDER INFO</th>
                      <th className="py-3 px-3">PRODUCT / PLAN</th>
                      <th className="py-3 px-3">AMOUNT</th>
                      <th className="py-3 px-3">SUBMITTED</th>
                      <th className="py-3 px-3 text-right">ONE-CLICK ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingTransfers.map((t) => (
                      <tr key={t.order_id} className="hover:bg-surface-secondary/40 transition-colors">
                        {/* Student */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-100">{t.user_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{t.user_email}</div>
                        </td>

                        {/* Method */}
                        <td className="py-3 px-3">
                          {t.payment_method === 'cbe_manual' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-purple-900/30 border border-purple-600/40 text-purple-300 font-medium text-[11px]">
                              <Building2 size={12} />
                              CBE Bank
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-900/30 border border-blue-600/40 text-blue-300 font-medium text-[11px]">
                              <Smartphone size={12} />
                              Telebirr
                            </span>
                          )}
                        </td>

                        {/* Transaction Ref */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-1 rounded border border-amber-500/30 text-xs select-all">
                              {t.transaction_reference}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(t.transaction_reference);
                                alert(`Copied ref: ${t.transaction_reference}`);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                              title="Copy transaction reference"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>

                        {/* Sender info */}
                        <td className="py-3 px-3">
                          <div className="text-slate-300 font-medium">
                            {t.sender_phone_or_name || 'Not provided'}
                          </div>
                          {t.notes && (
                            <div className="text-[11px] text-slate-400 italic max-w-xs truncate" title={t.notes}>
                              "{t.notes}"
                            </div>
                          )}
                        </td>

                        {/* Product */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-200">{t.product_title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.product_code}</div>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-emerald-400 font-mono">
                            {Math.round(t.amount)} {t.currency}
                          </div>
                        </td>

                        {/* Submitted */}
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(t.submitted_at).toLocaleDateString()} {new Date(t.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveTransfer(t.order_id, t.user_name)}
                              disabled={actionLoadingId === t.order_id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
                            >
                              {actionLoadingId === t.order_id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              <span>Approve & Release</span>
                            </button>
                            <button
                              onClick={() => handleRejectTransfer(t.order_id, t.user_name)}
                              disabled={actionLoadingId === t.order_id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-800/60 hover:bg-red-900/60 text-red-300 text-xs transition-all disabled:opacity-50"
                            >
                              <XCircle size={12} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Orders and Transactions Ledger */}
      {activeTab === 'orders' && (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Transactions Ledger</h2>
            <p className="text-xs text-slate-400">
              Audit recorded payment events and automated entitlement grants.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Provider Filter */}
            <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1 border border-border text-xs">
              <span className="text-slate-400 px-2 flex items-center gap-1 font-semibold">
                <Filter size={12} />
                Provider:
              </span>
              {['ALL', 'TELEBIRR', 'CHAPA', 'STRIPE'].map((p) => (
                <button
                  key={p}
                  onClick={() => setProviderFilter(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    providerFilter === p
                      ? 'bg-brand text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1 border border-border text-xs">
              <span className="text-slate-400 px-2 font-semibold">Status:</span>
              {['ALL', 'PAID', 'PENDING', 'FAILED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-brand text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-surface-secondary text-xs uppercase tracking-wider text-slate-400 border-b border-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Order Reference</th>
                <th className="py-3 px-4 font-semibold">User Email</th>
                <th className="py-3 px-4 font-semibold">Package</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Payment Gateway</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                    No orders match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.order_id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-indigo-300">
                      {ord.order_id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {ord.user_email}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-white">
                      {ord.product_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sm font-bold text-white">
                      {ord.amount.toLocaleString()} {ord.currency}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {ord.provider || 'TELEBIRR'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          ord.status === 'PAID'
                            ? 'success'
                            : ord.status === 'PENDING'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(ord.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Provision / Extend University Seat License Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <School size={20} className="text-brand" />
              <h3 className="text-lg font-bold text-white">
                Provision / Extend University Seat License
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Allocates enterprise B2B student seats and sets license expiration for institutional exit exam review.
            </p>

            <form onSubmit={handleProvisionLicense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  University / Institution Name
                </label>
                <input
                  type="text"
                  value={licOrgName}
                  onChange={(e) => setLicOrgName(e.target.value)}
                  placeholder="e.g. Haramaya University — CCI"
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Workspace Slug
                  </label>
                  <input
                    type="text"
                    value={licSlug}
                    onChange={(e) => setLicSlug(e.target.value)}
                    placeholder="e.g. hu-cci-exit-exam"
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contract Reference
                  </label>
                  <input
                    type="text"
                    value={licContractRef}
                    onChange={(e) => setLicContractRef(e.target.value)}
                    placeholder="e.g. HU-CCI-ENT-2026-002"
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contracted / Additional Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={licSeats}
                    onChange={(e) => setLicSeats(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contract Extension (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={licDurationDays}
                    onChange={(e) => setLicDurationDays(parseInt(e.target.value) || 30)}
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="offline_allowed"
                  checked={licOfflineAllowed}
                  onChange={(e) => setLicOfflineAllowed(e.target.checked)}
                  className="w-4 h-4 rounded text-brand focus:ring-0 bg-surface-secondary border-border"
                />
                <label htmlFor="offline_allowed" className="text-xs font-medium text-slate-200">
                  Allow Offline Package Downloads (ADR-009) for Contracted Seats
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowLicenseModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors shadow flex items-center gap-1.5"
                >
                  {provisioning ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Allocating Seats...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Confirm & Allocate Seats</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              Edit Product: {editingProduct.code}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Update pricing displayed to students in the mobile application.
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Price in ETB (Ethiopian Birr)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand font-mono"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ETB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="product_active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand focus:ring-0 bg-surface-secondary border-border"
                />
                <label htmlFor="product_active" className="text-sm font-medium text-slate-200">
                  Visible & Purchasable in Mobile App
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-medium transition-colors shadow"
                >
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
