'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { adminApi, AdminStats, ActivityLog } from '@/lib/api';
import {
  Users,
  Smartphone,
  Building2,
  FileCheck2,
  DollarSign,
  HelpCircle,
  BookOpen,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';

export default function OverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [s, logs] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getActivityLogs(undefined, 8),
      ]);
      setStats(s);
      setRecentLogs(logs);
    } catch (err) {
      console.error('Error loading admin overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <Navbar
        title="Executive Control Overview"
        subtitle="Live telemetry and platform metrics across all 15 curriculum courses"
        onRefresh={loadData}
        isRefreshing={isLoading}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Registered Users"
            value={stats?.total_users ?? '—'}
            subtitle="Students, Instructors & Admins"
            icon={<Users size={18} />}
          />
          <StatCard
            title="Active Devices"
            value={stats?.active_devices ?? '—'}
            subtitle="Smartphones, Tablets & PCs"
            icon={<Smartphone size={18} />}
            trend="+100% Mobile"
          />
          <StatCard
            title="Total Revenue"
            value={stats ? `${stats.total_revenue_etb.toLocaleString()} ETB` : '—'}
            subtitle={`${stats?.total_orders ?? 0} settled orders`}
            icon={<DollarSign size={18} />}
            trend="Telebirr / Chapa"
          />
          <StatCard
            title="Exam Attempts"
            value={stats?.total_attempts ?? '—'}
            subtitle="Simulated & Model Exams"
            icon={<FileCheck2 size={18} />}
          />
        </div>

        {/* Secondary KPI Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Question Bank"
            value={stats?.total_questions ?? '—'}
            subtitle="Exit Exam Items with Distractors"
            icon={<HelpCircle size={18} />}
          />
          <StatCard
            title="Canonical Courses"
            value={stats?.total_courses ?? 15}
            subtitle="Across 5 Core National Themes"
            icon={<BookOpen size={18} />}
          />
          <StatCard
            title="AI Tutor Quota Pool"
            value={stats?.ai_queries_quota_allocated ?? '—'}
            subtitle="Monthly Queries Allocated"
            icon={<Sparkles size={18} />}
          />
          <StatCard
            title="Workspaces"
            value={stats?.total_institutions ?? '—'}
            subtitle="Active University Tenancies"
            icon={<Building2 size={18} />}
          />
        </div>

        {/* Quick Executive Shortcuts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Platform Owner Quick Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/users"
              className="flex items-center justify-between p-3.5 rounded-lg bg-surface-secondary border border-border hover:border-brand transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-indigo-400" />
                <span className="text-sm font-medium text-white">Manage Users</span>
              </div>
              <ArrowRight size={15} className="text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/logs"
              className="flex items-center justify-between p-3.5 rounded-lg bg-surface-secondary border border-border hover:border-brand transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Zap size={18} className="text-amber-400" />
                <span className="text-sm font-medium text-white">Telemetry Feed</span>
              </div>
              <ArrowRight size={15} className="text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/curriculum"
              className="flex items-center justify-between p-3.5 rounded-lg bg-surface-secondary border border-border hover:border-brand transition-colors group"
            >
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">Question Bank</span>
              </div>
              <ArrowRight size={15} className="text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/plans"
              className="flex items-center justify-between p-3.5 rounded-lg bg-surface-secondary border border-border hover:border-brand transition-colors group"
            >
              <div className="flex items-center gap-3">
                <DollarSign size={18} className="text-sky-400" />
                <span className="text-sm font-medium text-white">Plans & Access</span>
              </div>
              <ArrowRight size={15} className="text-slate-500 group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>

        {/* Real-time Activity Preview */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Recent Platform Events</h2>
              <p className="text-xs text-slate-400">Live stream across security, sync, and commerce</p>
            </div>
            <Link
              href="/logs"
              className="text-xs font-semibold text-brand hover:text-brand-hover flex items-center gap-1"
            >
              <span>View All Logs</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No recent telemetry logs recorded.</p>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border/70 hover:border-border transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant={
                        log.category === 'COMMERCE'
                          ? 'success'
                          : log.category === 'SYNC'
                          ? 'info'
                          : log.category === 'EXAM_GRADING'
                          ? 'purple'
                          : 'warning'
                      }
                    >
                      {log.category}
                    </Badge>
                    <div className="truncate">
                      <span className="font-semibold text-white mr-2">{log.action}</span>
                      <span className="text-slate-400">{log.description}</span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-[11px] shrink-0 ml-4 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
