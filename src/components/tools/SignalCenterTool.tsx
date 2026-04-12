import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { Bell, Zap, ShieldAlert } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function SignalCenterTool({ site, config }: Props) {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">Signal Center</h2>
          <p className="text-zinc-400 text-sm mt-1">Live trading signals and alerts from expert analysts.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors">
          <Bell className="w-4 h-4" />
          Alert Settings
        </button>
      </div>

      <div className="space-y-4">
        {[
          { pair: 'BTC/USD', type: 'LONG', entry: '64,200', tp: '66,500', sl: '63,000', status: 'Active', time: 'Just now', strength: 'High' },
          { pair: 'EUR/USD', type: 'SHORT', entry: '1.0850', tp: '1.0790', sl: '1.0880', status: 'Pending', time: '15m ago', strength: 'Medium' },
          { pair: 'XAU/USD', type: 'LONG', entry: '2,340', tp: '2,365', sl: '2,330', status: 'Closed', time: '2h ago', strength: 'High' },
        ].map((signal, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${signal.type === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-zinc-50">{signal.pair}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${signal.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {signal.type}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">{signal.time} • {signal.strength} Probability</div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Entry</div>
                  <div className="font-mono text-sm text-zinc-200">{signal.entry}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Take Profit</div>
                  <div className="font-mono text-sm text-emerald-400">{signal.tp}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Stop Loss</div>
                  <div className="font-mono text-sm text-red-400">{signal.sl}</div>
                </div>
                <div className="pl-6 border-l border-zinc-800">
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: config.primary_color || '#3b82f6' }}>
                    Copy Trade
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-200/80">
          <strong>Risk Warning:</strong> Trading signals are provided for educational purposes and do not constitute financial advice. Always use proper risk management and never risk more than 1-2% of your account on a single trade.
        </p>
      </div>
    </div>
  );
}
