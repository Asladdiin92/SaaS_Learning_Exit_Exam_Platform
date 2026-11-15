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
} from 'lucide-react';
import { adminApi, ProductItem, OrderItem } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';

export default function PlansPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state for orders
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editName, setEditName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prodRes, ordRes] = await Promise.all([
        adminApi.getProducts(),
        adminApi.getOrders(100),
      ]);
      setProducts(prodRes);
      setOrders(ordRes);
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
          title="Payment Channels"
          value="Telebirr · Chapa"
          change="Stripe & Webhook Active"
          trend="Live"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Product Catalog Section */}
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

      {/* Orders and Transactions Ledger */}
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
