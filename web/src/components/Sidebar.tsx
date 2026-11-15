'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  BookOpen,
  CreditCard,
  Server,
  Shield,
  ExternalLink,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Users & Access', href: '/users', icon: Users },
  { label: 'Telemetry & Logs', href: '/logs', icon: Activity },
  { label: 'Curriculum & DB', href: '/curriculum', icon: BookOpen },
  { label: 'Plans & Access', href: '/plans', icon: CreditCard },
  { label: 'System & Health', href: '/system', icon: Server },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header matching user's asladin.me portfolio panel */}
        <div className="p-5 border-b border-border">
          <Link href="/" className="block group">
            <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono">&lt;asladin/&gt;</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Platform Owner Control</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-surface-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-indigo-200" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Owner Profile Footer & Integration Link to asladin.me */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="bg-surface-secondary rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300">Logged in Owner</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              SUPER_ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate" title="asladdiinabduqaadir@gmail.com">
            asladdiinabduqaadir@gmail.com
          </p>
        </div>

        <a
          href="https://www.asladin.me/login"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs text-slate-400 hover:text-white border border-border rounded-lg hover:bg-surface-secondary transition-colors"
        >
          <span>Portfolio Dashboard</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </aside>
  );
};
