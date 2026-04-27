import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary';
  children?: React.ReactNode;
  [key: string]: any;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-zinc-800 text-zinc-50',
    secondary: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20',
    outline: 'text-zinc-50 border border-zinc-800',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
