import React from 'react';
import { Site, SiteConfig } from '../../lib/supabase';
import { Activity, TrendingUp, Users, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

export function SignalSite({ site, config }: Props) {
  const primaryColor = config.primary_color || '#3b82f6';
  const secondaryColor = config.secondary_color || '#1e3a8a';
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white" style={{ backgroundColor: primaryColor }}>
              {config.site_title?.charAt(0) || 'S'}
            </div>
          )}
          <span className="font-bold text-lg tracking-tight">{config.site_title || site.name}</span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-zinc-400">
          <a href="#" className="hover:text-zinc-50 transition-colors">Signals</a>
          <a href="#" className="hover:text-zinc-50 transition-colors">Performance</a>
          <a href="#" className="hover:text-zinc-50 transition-colors">Pricing</a>
          <a href="#" className="hover:text-zinc-50 transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-4">
          <button className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
            View Results
          </button>
          <button className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>
            Start With Deriv
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-6 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 z-0" style={{ 
          background: `radial-gradient(circle at 50% 0%, ${secondaryColor}40 0%, transparent 70%)` 
        }}></div>
        
        <div className="z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Trading Signals
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            {config.hero_content?.title || 'Professional Trading Signals'}
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
            {config.hero_content?.subtitle || 'Get real-time alerts, expert analysis, and exact entry/exit points delivered straight to your device.'}
          </p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-3 rounded-lg text-base font-semibold text-white flex items-center gap-2 transition-transform hover:scale-105" style={{ backgroundColor: primaryColor }}>
              {config.cta_content?.text || 'Start 7-Day Free Trial'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-3 rounded-lg text-base font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
              View Past Performance
            </button>
          </div>
        </div>
      </section>

      {/* Stats/Features */}
      <section className="py-12 px-6 border-y border-zinc-800 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 mb-2">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">82% Win Rate</h3>
            <p className="text-sm text-zinc-400">Verified historical performance across all major pairs.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 mb-2">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Real-Time Alerts</h3>
            <p className="text-sm text-zinc-400">Instant notifications via Telegram, Discord, or Email.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-purple-400 mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Risk Management</h3>
            <p className="text-sm text-zinc-400">Exact Stop Loss and Take Profit levels provided.</p>
          </div>
        </div>
      </section>

      {/* Recent Signals Preview */}
      <section className="py-20 px-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold text-white">Recent Signals</h2>
          <a href="#" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>View Full History</a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { pair: 'BTC/USD', type: 'LONG', entry: '64,200', tp: '66,500', sl: '63,000', result: 'Won', pips: '+2300', time: '2 hours ago' },
            { pair: 'EUR/USD', type: 'SHORT', entry: '1.0850', tp: '1.0790', sl: '1.0880', result: 'Won', pips: '+60', time: '5 hours ago' },
            { pair: 'XAU/USD', type: 'LONG', entry: '2,340', tp: '2,365', sl: '2,330', result: 'Active', pips: '+15', time: '1 hour ago' },
            { pair: 'GBP/JPY', type: 'SHORT', entry: '192.40', tp: '191.00', sl: '193.00', result: 'Lost', pips: '-60', time: '1 day ago' },
          ].map((signal, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-white">{signal.pair}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${signal.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {signal.type}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{signal.time}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${signal.result === 'Won' ? 'text-emerald-400' : signal.result === 'Lost' ? 'text-red-400' : 'text-blue-400'}`}>
                    {signal.result}
                  </div>
                  <div className="text-sm text-zinc-400">{signal.pips} pips</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800/50">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Entry</div>
                  <div className="font-mono text-sm text-zinc-200">{signal.entry}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Take Profit</div>
                  <div className="font-mono text-sm text-emerald-400">{signal.tp}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Stop Loss</div>
                  <div className="font-mono text-sm text-red-400">{signal.sl}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-zinc-900/50 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-zinc-400">Choose the plan that fits your trading style.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-2">Monthly</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-extrabold text-white">$49</span>
                <span className="text-zinc-500">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {['3-5 Premium Signals Daily', 'Exact Entry, TP & SL', 'Risk Management Guide', '24/7 Support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-lg font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
                Subscribe Monthly
              </button>
            </div>
            
            <div className="bg-zinc-900 border-2 rounded-2xl p-8 flex flex-col relative" style={{ borderColor: primaryColor }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                MOST POPULAR
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Lifetime</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-extrabold text-white">$399</span>
                <span className="text-zinc-500">one-time</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Everything in Monthly', 'VIP Chat Access', '1-on-1 Strategy Session', 'Early Access to New Tools'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                Get Lifetime Access
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500 mt-auto">
        <p>&copy; {new Date().getFullYear()} {config.site_title || site.name}. All rights reserved.</p>
        <p className="mt-2 text-xs max-w-2xl mx-auto">
          Trading involves significant risk and may not be suitable for all investors. Past performance is not indicative of future results.
        </p>
      </footer>
    </div>
  );
}
