import React from 'react';
import { Site, SiteConfig } from '../../lib/supabase';
import { Play, Settings, BarChart2, History, Bot } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function BotPlatform({ site, config }: Props) {
  const primaryColor = config.primary_color || '#000000';
  const secondaryColor = config.secondary_color || '#ffffff';
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white" style={{ backgroundColor: primaryColor }}>
              {config.site_title?.charAt(0) || 'B'}
            </div>
          )}
          <span className="font-bold text-lg tracking-tight">{config.site_title || site.name}</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-zinc-400">
          <a href="#" className="hover:text-zinc-50 transition-colors">Workspace</a>
          <a href="#" className="hover:text-zinc-50 transition-colors">Bot Library</a>
          <a href="#" className="hover:text-zinc-50 transition-colors">Performance</a>
        </nav>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-zinc-500">Demo Balance</div>
            <div className="font-mono font-medium text-emerald-400">$10,000.00</div>
          </div>
          <button className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>
            Deposit
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-full md:w-64 border-r border-zinc-800 bg-zinc-900/30 p-4 flex flex-col gap-2">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tools</div>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md bg-zinc-800/50 text-zinc-200 hover:bg-zinc-800 transition-colors text-sm">
            <Bot className="w-4 h-4" />
            My Bots
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors text-sm">
            <Settings className="w-4 h-4" />
            Parameters
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors text-sm">
            <BarChart2 className="w-4 h-4" />
            Analysis
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors text-sm">
            <History className="w-4 h-4" />
            History
          </button>
        </aside>

        {/* Center - Canvas/Details */}
        <section className="flex-1 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Active Strategy: Alpha Trend</h2>
              <p className="text-sm text-zinc-400 mt-1">Running on Volatility 100 Index</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">
                Load Bot
              </button>
              <button className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                <Play className="w-4 h-4" />
                Run Bot
              </button>
            </div>
          </div>

          <div className="flex-1 border border-zinc-800 rounded-xl bg-zinc-900/20 flex items-center justify-center relative overflow-hidden">
            {/* Mock Canvas Grid */}
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#3f3f46 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.2 }}></div>
            <div className="z-10 text-center p-6 bg-zinc-950/80 border border-zinc-800 rounded-lg backdrop-blur-sm max-w-md">
              <Bot className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Bot Canvas</h3>
              <p className="text-sm text-zinc-400">
                This is where the visual bot builder or strategy parameters would be configured.
              </p>
            </div>
          </div>
        </section>

        {/* Right Sidebar - Live Stats */}
        <aside className="w-full md:w-80 border-l border-zinc-800 bg-zinc-900/30 p-4 flex flex-col">
          <h3 className="text-sm font-semibold mb-4">Live Performance</h3>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Total Profit</div>
              <div className="text-lg font-mono font-medium text-emerald-400">+$142.50</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Win Rate</div>
              <div className="text-lg font-mono font-medium text-zinc-200">68.5%</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Total Runs</div>
              <div className="text-lg font-mono font-medium text-zinc-200">124</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Lost Runs</div>
              <div className="text-lg font-mono font-medium text-red-400">39</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-3">Recent Trades</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-zinc-200">Call</div>
                  <div className="text-xs text-zinc-500 font-mono">14:23:0{i}</div>
                </div>
                <div className={`font-mono font-medium ${i % 3 === 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {i % 3 === 0 ? '-$10.00' : '+$9.50'}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
