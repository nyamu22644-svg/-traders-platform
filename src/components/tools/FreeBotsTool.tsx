import React from 'react';
import { Site, SiteConfig } from '../../../lib/supabase';
import { Download, Star, Users, Bot } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function FreeBotsTool({ site, config }: Props) {
  const bots = [
    { name: 'Trend Follower Pro', type: 'Trend', users: 1240, rating: 4.8, profit: '+12.4%' },
    { name: 'RSI Mean Reversion', type: 'Oscillator', users: 856, rating: 4.5, profit: '+8.2%' },
    { name: 'Grid Master', type: 'Grid', users: 2100, rating: 4.9, profit: '+15.7%' },
    { name: 'Breakout Hunter', type: 'Momentum', users: 432, rating: 4.2, profit: '+5.1%' },
    { name: 'Scalp King', type: 'Scalping', users: 3400, rating: 4.7, profit: '+22.3%' },
    { name: 'MACD Divergence', type: 'Reversal', users: 620, rating: 4.4, profit: '+9.8%' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-50">Free Bots Library</h2>
        <p className="text-zinc-400 text-sm mt-1">Download and use pre-configured trading bots from our community.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-blue-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-50">{bot.name}</h3>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {bot.type}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-zinc-800/50 my-4">
              <div className="text-center">
                <div className="text-xs text-zinc-500 mb-1">Users</div>
                <div className="text-sm font-semibold text-zinc-200 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> {bot.users}
                </div>
              </div>
              <div className="text-center border-x border-zinc-800/50">
                <div className="text-xs text-zinc-500 mb-1">Rating</div>
                <div className="text-sm font-semibold text-zinc-200 flex items-center justify-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" /> {bot.rating}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-zinc-500 mb-1">Avg. Profit</div>
                <div className="text-sm font-semibold text-emerald-400">{bot.profit}</div>
              </div>
            </div>

            <button className="w-full mt-auto py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
              <Download className="w-4 h-4" />
              Add to My Bots
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
