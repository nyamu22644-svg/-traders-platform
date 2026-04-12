import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { Maximize2, Settings, Camera } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function ChartsTool({ site, config }: Props) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <select className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 focus:outline-none font-bold">
            <option>BTC/USD</option>
            <option>ETH/USD</option>
            <option>EUR/USD</option>
          </select>
          <div className="h-6 w-px bg-zinc-800 mx-2"></div>
          <div className="flex bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
            {['1m', '5m', '15m', '1H', '4H', '1D'].map((tf) => (
              <button key={tf} className={`px-3 py-1 text-xs font-medium rounded ${tf === '1H' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}>
                {tf}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-zinc-800 mx-2"></div>
          <button className="text-sm text-zinc-400 hover:text-zinc-200 px-2">Indicators</button>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-zinc-400 hover:text-zinc-200"><Camera className="w-4 h-4" /></button>
          <button className="text-zinc-400 hover:text-zinc-200"><Settings className="w-4 h-4" /></button>
          <button className="text-zinc-400 hover:text-zinc-200"><Maximize2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 bg-[#131722] relative flex items-center justify-center">
        <div className="text-zinc-600 flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-zinc-600 rounded-full animate-spin mb-4"></div>
          <p>Loading Advanced Charts...</p>
        </div>
        
        {/* Mock Price Axis */}
        <div className="absolute right-0 top-0 bottom-0 w-16 border-l border-zinc-800/50 bg-[#1e222d] flex flex-col justify-between py-10 text-[10px] text-zinc-500 items-end pr-2">
          <span>65,000.00</span>
          <span>64,500.00</span>
          <span className="text-emerald-500 font-bold bg-emerald-500/10 w-full text-right py-1">64,230.50</span>
          <span>64,000.00</span>
          <span>63,500.00</span>
        </div>

        {/* Mock Time Axis */}
        <div className="absolute left-0 right-16 bottom-0 h-8 border-t border-zinc-800/50 bg-[#1e222d] flex justify-between px-10 text-[10px] text-zinc-500 items-center">
          <span>10:00</span>
          <span>11:00</span>
          <span>12:00</span>
          <span>13:00</span>
          <span>14:00</span>
        </div>
      </div>
    </div>
  );
}
