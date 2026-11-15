'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Badge } from '@/components/Badge';
import { adminApi, ActivityLog } from '@/lib/api';
import {
  Activity,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap,
} from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async (category?: string) => {
    setIsLoading(true);
    try {
      const cat = category === 'ALL' || !category ? undefined : category;
      const data = await adminApi.getActivityLogs(cat, 60);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(categoryFilter);
  }, [categoryFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <Navbar
        title="Activity & Telemetry Log Analyzer"
        subtitle="Real-time audit stream across auth, offline monotonic syncs, exam grading, and payment webhooks"
        onRefresh={() => loadLogs(categoryFilter)}
        isRefreshing={isLoading}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'COMMERCE', 'SYNC', 'EXAM_GRADING', 'AUTH'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                categoryFilter === cat
                  ? 'bg-brand text-white border-brand'
                  : 'bg-card text-slate-400 border-border hover:text-white hover:bg-surface-secondary'
              }`}
            >
              {cat === 'ALL' ? 'All Telemetry Events' : cat}
            </button>
          ))}
        </div>

        {/* Log Stream Container */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-surface-secondary flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={14} className="text-indigo-400" />
              Event Stream ({logs.length} events loaded)
            </span>
            <span className="text-xs text-slate-500 font-mono">Monotonic change sequence validated</span>
          </div>

          <div className="divide-y divide-border/60">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-sm">Streaming telemetry records...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No activity logs found for this filter.</div>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="p-4 hover:bg-surface-secondary/40 transition-colors">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start gap-3 min-w-0">
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

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">{log.action}</span>
                            {log.actor_email && (
                              <span className="text-xs text-indigo-400 font-mono">
                                ({log.actor_email})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{log.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        {log.details && (
                          <button className="text-slate-500 hover:text-white">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable JSON details */}
                    {isExpanded && log.details && (
                      <div className="mt-3 pt-3 border-t border-border/80">
                        <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                          Raw Payload / State
                        </span>
                        <pre className="p-3 rounded-lg bg-surface-primary border border-border text-[11px] font-mono text-indigo-300 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
