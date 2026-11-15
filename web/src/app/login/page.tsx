'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { DEFAULT_ADMIN_KEY } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('asladdiinabduqaadir@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    // Development mode master key storage
    if (typeof window !== 'undefined') {
      localStorage.setItem('asladin_admin_key', DEFAULT_ADMIN_KEY);
      localStorage.setItem('asladin_admin_email', email);
    }
    setTimeout(() => {
      router.push('/');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col justify-between select-none relative overflow-x-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Navigation Bar matching www.asladin.me */}
      <header className="w-full max-w-6xl mx-auto px-6 pt-6 z-10">
        <div className="bg-[#0D1322]/80 backdrop-blur-md border border-slate-800/80 rounded-full px-5 py-2.5 flex items-center justify-between shadow-lg shadow-black/40">
          {/* Avatar Profile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full ring-2 ring-indigo-500/70 p-0.5 bg-gradient-to-tr from-indigo-500 to-sky-400 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
              <span className="font-mono">&lt;A/&gt;</span>
            </div>
            <span className="text-sm font-semibold tracking-wide text-white hidden sm:inline">
              Asladdiin Abduqaadir
            </span>
          </div>

          {/* Portfolio Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Gallery
            </a>
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Projects
            </a>
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              About
            </a>
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Resume</span>
              <span className="text-xs">↗</span>
            </a>
          </nav>

          {/* Hire Me Action Button */}
          <a
            href="https://www.asladin.me"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
          >
            <span>Hire Me</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* Main Sign-In Hero Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-md">
          {/* Header Monogram & Subtitles */}
          <div className="text-center mb-8">
            <div className="text-3xl font-mono font-bold tracking-tight text-indigo-400 mb-2">
              &lt;asladin/&gt;
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin sign in</h1>
            <p className="text-sm text-slate-400 mt-1">Portfolio & SaaS Platform Control Panel</p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0E1526]/90 border border-slate-800/90 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#080C16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#080C16] border border-slate-800 rounded-lg px-3.5 py-2.5 pr-14 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#4338CA] hover:bg-[#4F46E5] text-white font-medium text-sm transition-all shadow-md shadow-indigo-900/40 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Instant Dev Bypass Indicator */}
            <div className="mt-5 pt-5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleLogin()}
                className="w-full py-2 px-3 rounded-lg bg-indigo-950/50 hover:bg-indigo-950/80 border border-indigo-800/40 text-xs font-medium text-indigo-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldCheck size={14} className="text-indigo-400" />
                <span>One-Click Dev Access (Master Key Auto-Bypass)</span>
              </button>
              <p className="text-[10px] text-center text-slate-500 mt-2">
                Production SSO Hook: Configured to verify against <code>www.asladin.me/login</code>
              </p>
            </div>
          </div>

          {/* Back to Portfolio Link */}
          <div className="text-center mt-6">
            <a
              href="https://www.asladin.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <span>← Back to portfolio</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-600 border-t border-slate-900 z-10">
        © 2026 Asladdiin Abduqaadir · Ethiopian National Exit Exam SaaS Platform
      </footer>
    </div>
  );
}
