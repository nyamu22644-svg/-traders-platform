import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { LineChart, Activity, BarChart2, PieChart } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function AnalysisTool({ site, config }: Props) {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">Market Analysis</h2>
          <p className="text-zinc-400 text-sm mt-1">Advanced technical and fundamental analysis tools.</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-2 focus:outline-none">
            <option>Forex Major</option>
            <option>Crypto</option>
            <option>Indices</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Technical Summary */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-zinc-50 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Technical Summary
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">EUR/USD</span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">STRONG BUY</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">GBP/USD</span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">BUY</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">USD/JPY</span>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">SELL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">XAU/USD</span>
              <span className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-bold">NEUTRAL</span>
            </div>
          </div>
        </div>

        {/* Market Sentiment */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-zinc-50 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-400" />
            Market Sentiment
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">Retail Longs</span>
                <span className="text-zinc-200">65%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              
              <div className="flex justify-between text-sm mb-1 mt-6">
                <span className="text-zinc-400">Retail Shorts</span>
                <span className="text-zinc-200">35%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: '35%' }}></div>
              </div>
            </div>
            
            <div className="flex items-center justify-center border-l border-zinc-800/50 pl-8">
              <div className="text-center">
                <div className="text-5xl font-extrabold text-white mb-2">65</div>
                <div className="text-sm text-zinc-400 uppercase tracking-wider">Greed Index</div>
              </div>
            </div>
          </div>
        </div>

        {/* Economic Calendar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-3">
          <h3 className="text-lg font-bold text-zinc-50 mb-6 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-400" />
            Upcoming Events
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-zinc-400">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Time</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Impact</th>
                  <th className="px-4 py-3">Forecast</th>
                  <th className="px-4 py-3 rounded-tr-lg">Previous</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-3">14:30</td>
                  <td className="px-4 py-3 font-medium text-zinc-200">USD</td>
                  <td className="px-4 py-3">Nonfarm Payrolls</td>
                  <td className="px-4 py-3"><span className="text-red-400 font-bold">High</span></td>
                  <td className="px-4 py-3">180K</td>
                  <td className="px-4 py-3">210K</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-3">15:00</td>
                  <td className="px-4 py-3 font-medium text-zinc-200">EUR</td>
                  <td className="px-4 py-3">ECB President Speaks</td>
                  <td className="px-4 py-3"><span className="text-yellow-400 font-bold">Med</span></td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
