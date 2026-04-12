import React from 'react';
import { Site, SiteConfig } from '../../lib/supabase';
import { TrendingUp, TrendingDown, Clock, Activity, Settings2 } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function SmartTrader({ site, config }: Props) {
  const primaryColor = config.primary_color || '#000000';
  const secondaryColor = config.secondary_color || '#ffffff';
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-7 w-auto" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: primaryColor }}>
              {config.site_title?.charAt(0) || 'S'}
            </div>
          )}
          <span className="font-bold tracking-tight">{config.site_title || site.name}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-sm font-medium">
            <a href="#" className="text-zinc-50 border-b-2 border-emerald-500 pb-4 -mb-4">Trade</a>
            <a href="#" className="text-zinc-400 hover:text-zinc-200 transition-colors">Portfolio</a>
            <a href="#" className="text-zinc-400 hover:text-zinc-200 transition-colors">Reports</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono font-medium text-emerald-400">$10,000.00</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Demo Account</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-xs font-medium">U</span>
          </div>
        </div>
      </header>

      {/* Main Trading Area */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
        
        {/* Left/Center - Chart Area */}
        <section className="flex-1 flex flex-col gap-4">
          {/* Market Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex items-center gap-4">
            <select className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-zinc-600">
              <option>Derived</option>
              <option>Forex</option>
              <option>Crypto</option>
            </select>
            <select className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-zinc-600">
              <option>Volatility 100 Index</option>
              <option>Volatility 75 Index</option>
              <option>Crash 500 Index</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-sm text-zinc-400">
              <Activity className="w-4 h-4" />
              <span>24h Vol: 1.2M</span>
            </div>
          </div>

          {/* Chart Placeholder */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden min-h-[400px]">
            <div className="absolute top-4 left-4 flex gap-2 z-10">
              <button className="bg-zinc-800/80 backdrop-blur text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors">1M</button>
              <button className="bg-zinc-800/80 backdrop-blur text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors">5M</button>
              <button className="bg-zinc-800/80 backdrop-blur text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors">1H</button>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <Activity className="w-16 h-16 text-zinc-800 mb-4" />
              <p className="text-zinc-500 font-medium">Interactive Chart Area</p>
              <p className="text-zinc-600 text-sm mt-2 max-w-xs text-center">Real-time price data and technical indicators would render here.</p>
            </div>
          </div>
        </section>

        {/* Right - Trade Parameters */}
        <aside className="w-full lg:w-[340px] flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Trade Parameters</h3>
              <Settings2 className="w-4 h-4 text-zinc-500" />
            </div>

            {/* Trade Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Trade Type</label>
              <select className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-600">
                <option>Rise / Fall</option>
                <option>Higher / Lower</option>
                <option>Touch / No Touch</option>
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Duration</label>
              <div className="flex gap-2">
                <Input type="number" defaultValue={5} className="w-20 bg-zinc-950 border-zinc-800" />
                <select className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-600">
                  <option>Ticks</option>
                  <option>Seconds</option>
                  <option>Minutes</option>
                </select>
              </div>
            </div>

            {/* Stake */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Stake (USD)</label>
              <Input type="number" defaultValue={10} className="w-full bg-zinc-950 border-zinc-800 font-mono" />
            </div>

            <div className="h-px bg-zinc-800 my-2"></div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg p-3 flex flex-col items-center justify-center transition-colors group relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <TrendingUp className="w-5 h-5 mb-1 relative z-10" />
                <span className="font-bold text-sm relative z-10">Rise</span>
                <span className="text-xs opacity-80 mt-1 relative z-10">Payout: 19.53</span>
              </button>
              
              <button className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-3 flex flex-col items-center justify-center transition-colors group relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <TrendingDown className="w-5 h-5 mb-1 relative z-10" />
                <span className="font-bold text-sm relative z-10">Fall</span>
                <span className="text-xs opacity-80 mt-1 relative z-10">Payout: 19.53</span>
              </button>
            </div>
          </div>

          {/* Mini History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Recent Positions</h3>
              <Clock className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-center py-8 text-zinc-500 text-sm">
              No recent trades
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// Simple internal Input component to avoid complex imports
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      {...props} 
      className={`flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ''}`}
    />
  );
}
