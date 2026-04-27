import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Globe2, HandCoins, Wallet } from 'lucide-react';
import { useSites } from '../hooks/useSites';
import { useUserProfile } from '../hooks/useUserProfile';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';

interface CommissionEventRow {
  id: string;
  site_id: string;
  currency: string;
  gross_commission: number;
  platform_amount: number;
  client_amount: number;
  status: 'pending' | 'confirmed' | 'reversed' | 'paid_out';
  occurred_at: string;
}

interface CommissionPayoutRow {
  id: string;
  site_id: string;
  client_loginid: string | null;
  currency: string;
  total_client_amount: number;
  total_platform_amount: number;
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

interface SiteCommissionConfigRow {
  site_id: string;
  total_commission_pct: number;
  platform_commission_pct: number;
  client_commission_pct: number;
  payout_cycle: 'weekly' | 'monthly';
  payout_minimum: number;
}

function formatCurrency(value: number, currency = 'USD') {
  return `${value.toFixed(2)} ${currency}`;
}

function formatPercent(value: number | undefined) {
  if (typeof value !== 'number') return '-';
  return `${value.toFixed(2)}%`;
}

export default function Commissions() {
  const { sites, loading: sitesLoading, error: sitesError } = useSites();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CommissionEventRow[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayoutRow[]>([]);
  const [configs, setConfigs] = useState<SiteCommissionConfigRow[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (profile?.role === 'admin') {
        if (isMounted) {
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (sitesLoading) return;

      if (sitesError) {
        if (isMounted) {
          setError('Unable to load your sites.');
          setLoading(false);
        }
        return;
      }

      if (sites.length === 0) {
        if (isMounted) {
          setEvents([]);
          setPayouts([]);
          setConfigs([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const siteIds = sites.map((site) => site.id);

      try {
        const [eventsRes, payoutsRes, configsRes] = await Promise.all([
          supabase
            .from('commission_events')
            .select('id, site_id, currency, gross_commission, platform_amount, client_amount, status, occurred_at')
            .in('site_id', siteIds)
            .order('occurred_at', { ascending: false })
            .limit(2000),
          supabase
            .from('commission_payouts')
            .select('id, site_id, client_loginid, currency, total_client_amount, total_platform_amount, status, period_start, period_end, paid_at, created_at')
            .in('site_id', siteIds)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('site_configs')
            .select('site_id, total_commission_pct, platform_commission_pct, client_commission_pct, payout_cycle, payout_minimum')
            .in('site_id', siteIds),
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (payoutsRes.error) throw payoutsRes.error;
        if (configsRes.error) throw configsRes.error;

        if (!isMounted) return;

        setEvents((eventsRes.data || []) as CommissionEventRow[]);
        setPayouts((payoutsRes.data || []) as CommissionPayoutRow[]);
        setConfigs((configsRes.data || []) as SiteCommissionConfigRow[]);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load commission data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [profile?.role, sites, sitesError, sitesLoading]);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => {
      map.set(site.id, site.name);
    });
    return map;
  }, [sites]);

  const summary = useMemo(() => {
    const totals = {
      gross: 0,
      platform: 0,
      client: 0,
      pendingClient: 0,
      paidOut: 0,
    };

    events.forEach((event) => {
      totals.gross += Number(event.gross_commission || 0);
      totals.platform += Number(event.platform_amount || 0);
      totals.client += Number(event.client_amount || 0);
      if (event.status === 'pending' || event.status === 'confirmed') {
        totals.pendingClient += Number(event.client_amount || 0);
      }
    });

    payouts.forEach((payout) => {
      if (payout.status === 'paid') {
        totals.paidOut += Number(payout.total_client_amount || 0);
      }
    });

    return totals;
  }, [events, payouts]);

  const configBySiteId = useMemo(() => {
    const map = new Map<string, SiteCommissionConfigRow>();
    configs.forEach((config) => map.set(config.site_id, config));
    return map;
  }, [configs]);

  const eventsBySiteId = useMemo(() => {
    const map = new Map<string, CommissionEventRow[]>();
    events.forEach((event) => {
      const current = map.get(event.site_id) || [];
      current.push(event);
      map.set(event.site_id, current);
    });
    return map;
  }, [events]);

  const siteBreakdown = useMemo(() => {
    return sites
      .map((siteId) => {
        const siteEvents = eventsBySiteId.get(siteId.id) || [];
        const sitePayouts = payouts.filter((payout) => payout.site_id === siteId.id);

        const gross = siteEvents.reduce((acc, event) => acc + Number(event.gross_commission || 0), 0);
        const client = siteEvents.reduce((acc, event) => acc + Number(event.client_amount || 0), 0);
        const platform = siteEvents.reduce((acc, event) => acc + Number(event.platform_amount || 0), 0);
        const paid = sitePayouts
          .filter((payout) => payout.status === 'paid')
          .reduce((acc, payout) => acc + Number(payout.total_client_amount || 0), 0);

        return {
          siteId: siteId.id,
          siteName: siteId.name,
          gross,
          client,
          platform,
          paid,
          config: configBySiteId.get(siteId.id),
        };
      })
      .sort((a, b) => b.gross - a.gross);
  }, [configBySiteId, eventsBySiteId, payouts, sites]);

  if (sitesError) {
    return <div className="text-red-500">Failed to load commissions.</div>;
  }

  if (profile?.role === 'admin') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Platform Commissions</h1>
          <p className="text-zinc-400 mt-1">Master-account commission governance and client distribution live in the Owner Admin panel.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Owner Workflow</CardTitle>
            <CardDescription>Review client liabilities, approve payouts, and monitor all client sites from one place.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin">
              <Button>Open Owner Admin Panel</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Commissions</h1>
        <p className="text-zinc-400 mt-1">Cross-site commission visibility for every site in your TradeSaaS account.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Gross Ledger</CardTitle>
            <HandCoins className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{formatCurrency(summary.gross)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Client Earned</CardTitle>
            <Wallet className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{formatCurrency(summary.client)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Pending Client Payout</CardTitle>
            <CalendarClock className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{formatCurrency(summary.pendingClient)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Paid to Clients</CardTitle>
            <Globe2 className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{formatCurrency(summary.paidOut)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site-Level Commission Splits</CardTitle>
          <CardDescription>Configured split and realized amounts across all your sites.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || sitesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : siteBreakdown.length === 0 ? (
            <div className="text-sm text-zinc-500">No sites available yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Total Rate</th>
                    <th className="py-2 pr-3">Split</th>
                    <th className="py-2 pr-3">Client Earned</th>
                    <th className="py-2">Platform Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {siteBreakdown.map((row) => (
                    <tr key={row.siteId} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                      <td className="py-2 pr-3">{row.siteName}</td>
                      <td className="py-2 pr-3">{formatPercent(row.config?.total_commission_pct)}</td>
                      <td className="py-2 pr-3">
                        {formatPercent(row.config?.platform_commission_pct)} / {formatPercent(row.config?.client_commission_pct)}
                      </td>
                      <td className="py-2 pr-3">{formatCurrency(row.client)}</td>
                      <td className="py-2">{formatCurrency(row.platform)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Payout Statements</CardTitle>
          <CardDescription>Recent payout records across all your sites.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || sitesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : payouts.length === 0 ? (
            <div className="text-sm text-zinc-500">No payout statements found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.slice(0, 12).map((row) => (
                    <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                      <td className="py-2 pr-3">{siteNameById.get(row.site_id) || 'Unknown Site'}</td>
                      <td className="py-2 pr-3">{row.client_loginid || 'N/A'}</td>
                      <td className="py-2 pr-3">
                        {row.period_start && row.period_end ? `${row.period_start} to ${row.period_end}` : '-'}
                      </td>
                      <td className="py-2 pr-3">{formatCurrency(row.total_client_amount, row.currency)}</td>
                      <td className="py-2 pr-3 capitalize">{row.status}</td>
                      <td className="py-2">{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
