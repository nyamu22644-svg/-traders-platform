import React from 'react';
import {
  BellRing,
  BookOpen,
  Bot,
  Boxes,
  CandlestickChart,
  ChartColumn,
  Copy,
  LayoutDashboard,
  WalletCards,
} from 'lucide-react';
import { Site, SiteConfig } from '../../lib/supabase';
import { OfficialDbotEmbed } from '../tools/OfficialDbotEmbed';
import { useDerivOAuth } from '../../hooks/useDerivOAuth';

interface Props {
  site: Site;
  config: SiteConfig;
}

type PlatformTab =
  | 'dashboard'
  | 'bot_builder'
  | 'charts'
  | 'tutorials'
  | 'free_bots'
  | 'analysis_tool'
  | 'd_trader'
  | 'signal_center'
  | 'money_management'
  | 'copy_trader'
  | 'fast_trader';

const MODULES: Array<{
  id: PlatformTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bot_builder', label: 'Bot Builder', icon: Bot },
  { id: 'charts', label: 'Charts', icon: CandlestickChart },
  { id: 'tutorials', label: 'Tutorials', icon: BookOpen },
  { id: 'free_bots', label: 'Free Bots', icon: Boxes },
  { id: 'analysis_tool', label: 'Analysis Tool', icon: ChartColumn },
  { id: 'd_trader', label: 'D-Trader', icon: ChartColumn },
  { id: 'signal_center', label: 'Signal Center', icon: BellRing },
  { id: 'money_management', label: 'Money Management', icon: WalletCards },
  { id: 'copy_trader', label: 'Copy Trader', icon: Copy },
  { id: 'fast_trader', label: 'FAST TRADER', icon: WalletCards },
];

function formatGmtClock(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} GMT`;
}

export function PlatformLayout({ site, config }: Props) {
  const oauthAttribution = React.useMemo(
    () => ({
      sidc: String(config?.deriv_referral_code || '').trim() || undefined,
      utm_source: String(config?.deriv_utm_source || '').trim() || undefined,
      utm_medium: String(config?.deriv_utm_medium || '').trim() || undefined,
      utm_campaign: String(config?.deriv_utm_campaign || '').trim() || undefined,
    }),
    [
      config?.deriv_referral_code,
      config?.deriv_utm_source,
      config?.deriv_utm_medium,
      config?.deriv_utm_campaign,
    ]
  );

  const {
    loading,
    session,
    error,
    isAuthenticated,
    login,
    signup,
    clearError,
  } = useDerivOAuth({
    siteId: site.id,
    attribution: oauthAttribution,
  });

  const [activeTab] = React.useState<PlatformTab>('bot_builder');
  const [clock, setClock] = React.useState(() => formatGmtClock(new Date()));

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(formatGmtClock(new Date()));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const primaryColor = config.primary_color || '#1128ff';
  const shellFontFamily = '"Segoe UI", Tahoma, Arial, sans-serif';
  const isOfficialDbotTab =
    activeTab === 'dashboard' ||
    activeTab === 'bot_builder' ||
    activeTab === 'charts' ||
    activeTab === 'tutorials';

  const renderTabContent = () => {
    if (isOfficialDbotTab) {
      return <OfficialDbotEmbed view={activeTab} />;
    }

    const activeModule = MODULES.find((item) => item.id === activeTab);

    return (
      <div className="flex h-full items-center justify-center bg-[#f5f5f7] px-6 py-12">
        <div className="w-full max-w-3xl rounded-[28px] border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {activeModule ? <activeModule.icon className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
          </div>
          <h2 className="mt-6 text-3xl font-semibold text-zinc-900">
            {activeModule?.label || 'Module'}
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-500">
            This module will be custom-built in your platform while keeping the WarrenFX-style shell and your Deriv OAuth flow.
          </p>
          {!isAuthenticated ? (
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void login()}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Log in with Deriv
              </button>
              <button
                type="button"
                onClick={() => void signup()}
                className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Sign up
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#ededee] text-zinc-950"
      style={{ fontFamily: shellFontFamily }}
    >
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {renderTabContent()}
      </main>

      {!isOfficialDbotTab ? (
      <footer className="flex items-center justify-end gap-5 border-t border-zinc-200 bg-[#f8f8f8] px-6 py-2.5 text-zinc-700">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full bg-[#2ab7b0]" />
          <span className="text-[13px]">{clock}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span>EN</span>
        </div>
      </footer>
      ) : null}

      {!isOfficialDbotTab && loading ? (
        <div className="fixed left-3 top-3 z-40 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-600 shadow-sm">
          Verifying Deriv session...
        </div>
      ) : null}

      {!isOfficialDbotTab && error ? (
        <div className="fixed inset-x-3 top-20 z-40 mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          <div>{error}</div>
          <button
            type="button"
            onClick={clearError}
            className="mt-2 text-rose-600 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
