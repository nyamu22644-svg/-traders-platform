import React, { useState } from 'react';
import { Site, SiteConfig } from '../../lib/supabase';
import { DashboardTool } from '../tools/DashboardTool';
import { BotBuilderTool } from '../tools/BotBuilderTool';
import { FreeBotsTool } from '../tools/FreeBotsTool';
import { AnalysisTool } from '../tools/AnalysisTool';
import { ChartsTool } from '../tools/ChartsTool';
import { SignalCenterTool } from '../tools/SignalCenterTool';
import { FastTraderTool } from '../tools/FastTraderTool';
import { LayoutDashboard, Bot, Download, LineChart, BarChart2, Bell, Zap } from 'lucide-react';

interface Props {
  site: Site;
  config: SiteConfig;
}

const TOOL_CONFIG = {
  dashboard: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: DashboardTool },
  bot_builder: { id: 'bot_builder', label: 'Bot Builder', icon: Bot, component: BotBuilderTool },
  free_bots: { id: 'free_bots', label: 'Free Bots', icon: Download, component: FreeBotsTool },
  analysis: { id: 'analysis', label: 'Analysis Tool', icon: BarChart2, component: AnalysisTool },
  charts: { id: 'charts', label: 'Charts', icon: LineChart, component: ChartsTool },
  signal_center: { id: 'signal_center', label: 'Signal Center', icon: Bell, component: SignalCenterTool },
  fast_trader: { id: 'fast_trader', label: 'Fast Trader', icon: Zap, component: FastTraderTool },
};

export function PlatformLayout({ site, config }: Props) {
  const enabledTools = config.enabled_tools || ['dashboard', 'bot_builder', 'fast_trader'];
  const [activeTool, setActiveTool] = useState(enabledTools[0] || 'dashboard');

  const ActiveComponent = TOOL_CONFIG[activeTool as keyof typeof TOOL_CONFIG]?.component || DashboardTool;
  const primaryColor = config.primary_color || '#3b82f6';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Platform Header / Tool Navigation */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 mr-8">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white" style={{ backgroundColor: primaryColor }}>
              {config.site_title?.charAt(0) || 'P'}
            </div>
          )}
          <span className="font-bold text-lg tracking-tight hidden md:block">{config.site_title || site.name}</span>
        </div>

        {/* Tool Navigation Tabs */}
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {enabledTools.map((toolId) => {
            const tool = TOOL_CONFIG[toolId as keyof typeof TOOL_CONFIG];
            if (!tool) return null;
            const isActive = activeTool === toolId;
            return (
              <button
                key={toolId}
                onClick={() => setActiveTool(toolId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-zinc-800 text-zinc-50 shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <tool.icon className={`w-4 h-4 ${isActive ? 'text-zinc-50' : ''}`} style={isActive ? { color: primaryColor } : {}} />
                {tool.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-4 ml-4 pl-4 border-l border-zinc-800">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-zinc-500">Real Account</div>
            <div className="text-sm font-bold text-emerald-400">$12,450.00</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <span className="text-xs font-bold">JD</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <ActiveComponent site={site} config={config} />
      </main>
    </div>
  );
}
