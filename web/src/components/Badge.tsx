import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'default';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
}) => {
  const variantStyles = {
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    info: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
    purple: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    default: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${
        size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'
      }`}
    >
      {children}
    </span>
  );
};
