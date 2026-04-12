import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { ArrowUpRight, ArrowDownRight, Clock, DollarSign } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function FastTraderTool({ site, config }: Props) {
  return (
    <div className="flex h-[calc(100vh-64px)] animate-in fade-in duration-300">
      {/* Chart Area */}
      <div className="flex-1 bg-[#131722] border-r border-zinc-800 relative flex items-center justify-center">
        <div className="text-zinc-600 flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-zinc-600 rounded-full animate-spin mb-4"></div>
          <p>Tick Chart Loading...</p>
        </div>
      </div>

      {/* Trading Panel */}
      <div className="w-80 bg-zinc-950 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <select className="w-full bg-zinc-900 border border-zinc-800 text-zinc-50 text-lg font-bold rounded-md px-3 py-2 focus:outline-none">
            <option>Volatility 100 Index</option>
            <option>Volatility 75 Index</option>
            <option>Boom 1000 Index</option>
          </select>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* Trade Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trade Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-zinc-800 text-zinc-50 py-2 rounded text-sm font-medium border border-zinc-700">Rise/Fall</button>
              <button className="bg-zinc-900 text-zinc-400 py-2 rounded text-sm font-medium border border-zinc-800 hover:bg-zinc-800">Higher/Lower</button>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Duration
            </label>
            <div className="flex gap-2">
              <input type="number" defaultValue="5" className="w-20 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-50 focus:outline-none" />
              <select className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-50 focus:outline-none">
                <option>Ticks</option>
                <option>Seconds</option>
                <option>Minutes</option>
              </select>
            </div>
          </div>

          {/* Stake */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Stake
            </label>
            <input type="number" defaultValue="10.00" className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-50 focus:outline-none text-lg" />
          </div>

          {/* Payout Summary */}
          <div className="bg-zinc-900 rounded-lg p-4 space-y-2 border border-zinc-800">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Payout</span>
              <span className="text-zinc-50 font-bold">$19.55</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Profit</span>
              <span className="text-emerald-400 font-bold">+$9.55 (95.5%)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-zinc-800 space-y-3">
          <button className="w-full py-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <ArrowUpRight className="w-6 h-6" />
            Rise
          </button>
          <button className="w-full py-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <ArrowDownRight className="w-6 h-6" />
            Fall
          </button>
        </div>
      </div>
    </div>
  );
}
