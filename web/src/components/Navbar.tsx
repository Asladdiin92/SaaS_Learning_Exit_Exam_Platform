'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, Sparkles, Terminal } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-secondary border border-border text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300 font-medium">Supabase Cloud (eu-west-1)</span>
          <span className="text-slate-500">•</span>
          <span className="text-indigo-400 font-mono text-[11px]">pgvector(384)</span>
        </div>

        {/* Master Key Bypass Notice */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 text-xs">
          <ShieldCheck size={14} className="text-indigo-400" />
          <span>Master Key Active</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-surface-secondary hover:bg-surface-tertiary border border-border rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-brand' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
};
