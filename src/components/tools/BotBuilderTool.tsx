import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { Play, Settings, Plus, Bot } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function BotBuilderTool({ site, config }: Props) {
  return (
    <div className="flex h-[calc(100vh-64px)] animate-in fade-in duration-300">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-200">My Bots</h3>
          <button className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-50">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {['MACD Crossover', 'RSI Scalper', 'Grid Bot Alpha'].map((bot, i) => (
            <button key={i} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${i === 0 ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
              <Bot className="w-4 h-4" />
              {bot}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 bg-zinc-900 flex flex-col relative overflow-hidden">
        {/* Toolbar */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <select className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 focus:outline-none">
              <option>EUR/USD</option>
              <option>BTC/USD</option>
            </select>
            <select className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 focus:outline-none">
              <option>1m</option>
              <option>5m</option>
              <option>15m</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-md">
              <Settings className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: config.primary_color || '#3b82f6' }}>
              <Play className="w-4 h-4" />
              Run Bot
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-8 relative">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}></div>
          
          <div className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-lg p-4 w-64 shadow-xl">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Entry Condition</div>
            <div className="space-y-2">
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-sm text-zinc-300">
                If <span className="text-blue-400">MACD Line</span> crosses above <span className="text-blue-400">Signal Line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
