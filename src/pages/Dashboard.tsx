import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Activity, Globe, CheckCircle2, ArrowRight, ShieldCheck, WalletCards, PlugZap } from 'lucide-react';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { supabase, AuditLog } from '../lib/supabase';

export default function Dashboard() {
  const { sites, loading, error } = useSites();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      if (!user) {
        setLogsLoading(false);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (data) setLogs(data);
      } catch (err) {
        console.error('Failed to fetch audit logs', err);
      } finally {
        setLogsLoading(false);
      }
    }
    fetchLogs();
  }, [user]);

  const stats = {
    totalSites: sites.length,
    activeSites: sites.filter(s => s.status === 'active').length,
  };

  const isAdmin = profile?.role === 'admin';
  const primarySite = sites[0] || null;
  const onboardingSteps = [
    {
      id: 'create-site',
      label: 'Create your first site',
      done: sites.length > 0,
      action: '/sites/new',
      actionLabel: sites.length > 0 ? 'Create another site' : 'Create site',
      description: 'This creates the client portal shell and commission workspace automatically.',
    },
    {
      id: 'connect-deriv',
      label: 'Connect Deriv access',
      done: Boolean(profile?.deriv_loginid),
      action: primarySite ? `/sites/${primarySite.id}` : '/sites/new',
      actionLabel: 'Open site settings',
      description: 'Each client can connect their Deriv account themselves with OAuth consent.',
    },
    {
      id: 'add-domain',
      label: 'Add a domain',
      done: false,
      action: '/domains',
      actionLabel: 'Manage domains',
      description: 'Buy, verify, or connect a domain without waiting for manual onboarding.',
    },
    {
      id: 'review-commissions',
      label: 'Review commissions',
      done: false,
      action: '/commissions',
      actionLabel: 'Open commissions',
      description: 'Track commissions, payouts, and splits from the client portal.',
    },
  ];

  if (error) {
    return <div className="text-red-500">Failed to load dashboard data.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            {isAdmin ? 'Owner overview of clients, sites, and platform operations.' : 'Overview of your trading platforms.'}
          </p>
        </div>
        {isAdmin ? (
          <Link to="/admin">
            <Button className="gap-2">Open Owner Admin</Button>
          </Link>
        ) : (
          <Link to="/sites/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create New Site
            </Button>
          </Link>
        )}
      </div>

      {!isAdmin ? (
        <Card className="border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/80">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-zinc-50">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Client Onboarding
                </CardTitle>
                <p className="mt-1 text-sm text-zinc-400">Self-serve setup. No manual onboarding by staff is required.</p>
              </div>
              <Link to={primarySite ? `/sites/${primarySite.id}` : '/sites/new'}>
                <Button className="gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Continue Setup
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {onboardingSteps.map((step, index) => (
                <div key={step.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                        {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 text-[11px] text-zinc-400">{index + 1}</span>}
                        {step.label}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">{step.description}</p>
                    </div>
                    <Link to={step.action}>
                      <Button size="sm" variant={step.done ? 'outline' : 'secondary'} className="gap-1">
                        {step.actionLabel}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-400">
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-2 text-zinc-200"><PlugZap className="w-4 h-4 text-cyan-400" />Deriv self-onboarding</div>
                <div className="mt-1">OAuth consent flow is available for clients directly from the public site.</div>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-2 text-zinc-200"><WalletCards className="w-4 h-4 text-cyan-400" />Automatic commission tracking</div>
                <div className="mt-1">Commission mapping is persisted per site and client login.</div>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-2 text-zinc-200"><Globe className="w-4 h-4 text-cyan-400" />Public client sites</div>
                <div className="mt-1">Visitors can view public sites without a Deriv session.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Sites</CardTitle>
            <Globe className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">
              {loading ? <Spinner className="w-6 h-6 text-zinc-500" /> : stats.totalSites}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Active Sites</CardTitle>
            <Activity className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">
              {loading ? <Spinner className="w-6 h-6 text-zinc-500" /> : stats.activeSites}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No recent activity to show.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map(log => (
                <div key={log.id} className="flex justify-between items-center border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-200 capitalize">
                      {log.action} {log.entity_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  {log.entity_id && (
                    <div className="text-xs font-mono text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
                      {log.entity_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

