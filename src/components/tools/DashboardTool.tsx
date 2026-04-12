import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { Activity, TrendingUp, Wallet, Clock } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function DashboardTool({ site, config }: Props) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">Dashboard Overview</h2>
          <p className="text-zinc-400 text-sm">Welcome back to {config.site_title || site.name}</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors">
            Deposit
          </button>
          <button className="px-4 py-2 text-white rounded-md text-sm font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: config.primary_color || '#3b82f6' }}>
            Trade Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Balance', value: '$12,450.00', icon: Wallet, color: 'text-blue-400' },
          { label: 'Active Trades', value: '3', icon: Activity, color: 'text-emerald-400' },
          { label: 'Today\'s P&L', value: '+$450.20', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Win Rate', value: '68%', icon: Clock, color: 'text-purple-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-zinc-400">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-zinc-50">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-h-[400px] flex flex-col items-center justify-center text-zinc-500">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p>Chart Data Unavailable</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-zinc-50 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-zinc-200">EUR/USD Long</div>
                  <div className="text-xs text-zinc-500">Closed at Take Profit</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">+$45.00</div>
                  <div className="text-xs text-zinc-500">2h ago</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
