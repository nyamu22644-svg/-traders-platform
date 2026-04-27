import React from 'react';
import {
  BellRing,
  Copy,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { Site, SiteConfig } from '../../lib/supabase';
import { OfficialDbotEmbed } from '../tools/OfficialDbotEmbed';
import { useDerivOAuth } from '../../hooks/useDerivOAuth';

interface Props {
  site: Site;
  config: SiteConfig;
}

function formatGmtClock(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} GMT`;
}

function getBrandInitials(name: string) {
  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!segments.length) return 'WF';
  return segments.map(segment => segment[0].toUpperCase()).join('');
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
    logout,
    clearError,
  } = useDerivOAuth({
    siteId: site.id,
    attribution: oauthAttribution,
  });

  const [clock, setClock] = React.useState(() => formatGmtClock(new Date()));

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(formatGmtClock(new Date()));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const primaryColor = config.primary_color || '#1128ff';
  const shellFontFamily = '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';
  const siteTitle = String(config.site_title || site.name || 'WarrenFX Hub').trim() || 'WarrenFX Hub';
  const brandInitials = React.useMemo(() => getBrandInitials(siteTitle), [siteTitle]);

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#ededee] text-zinc-950"
      style={{ fontFamily: shellFontFamily }}
    >
      <header className="border-b border-[#dbe2eb] bg-gradient-to-r from-[#edf1f6] via-[#f9fbfd] to-[#edf1f6] px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#b8c4d6] bg-[#d8e4f7] text-sm font-bold text-[#0b2f76]">
              {brandInitials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[22px] font-semibold leading-none text-[#23313f]">{siteTitle}</div>
              <div className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7a8d]">
                WarrenFX-inspired trading workspace
              </div>
            </div>
            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#b3c3de] bg-white text-[#1170ff] hover:bg-[#eef5ff] sm:inline-flex"
              aria-label="Open Telegram"
            >
              <Send className="h-4 w-4" />
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => void login()}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-[#1638ff] hover:bg-[#eaf0ff]"
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#c7cedb] bg-[#f5f7fb] px-4 py-2 text-sm font-semibold text-[#637081]"
                  disabled
                >
                  Token
                </button>
                <button
                  type="button"
                  onClick={() => void signup()}
                  className="rounded-md bg-[#1128ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(17,40,255,0.28)] hover:bg-[#0a22e1]"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                <div className="rounded-md border border-[#cfe0ff] bg-[#f2f7ff] px-3 py-2 text-sm font-semibold text-[#295bc2]">
                  {session?.loginid || 'Connected'}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-[#cad3e2] bg-white px-4 py-2 text-sm font-semibold text-[#485a72] hover:bg-[#f4f6fa]"
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden bg-[#f2f4f8]">
        <OfficialDbotEmbed view="bot_builder" suppressNativeChrome />
      </main>

      <footer className="flex items-center justify-end gap-5 border-t border-zinc-200 bg-[#f8f8f8] px-6 py-2.5 text-zinc-700">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full bg-[#2ab7b0]" />
          <span className="text-[13px]">{clock}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span>EN</span>
        </div>
      </footer>

      {loading ? (
        <div className="fixed left-3 top-3 z-40 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-600 shadow-sm">
          Verifying Deriv session...
        </div>
      ) : null}

      {error ? (
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
