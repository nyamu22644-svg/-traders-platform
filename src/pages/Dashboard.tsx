import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Activity, Globe } from 'lucide-react';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { supabase, AuditLog } from '../lib/supabase';

export default function Dashboard() {
  const { sites, loading, error } = useSites();
  const { user } = useAuth();
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

  if (error) {
    return <div className="text-red-500">Failed to load dashboard data.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Overview of your trading platforms.</p>
        </div>
        <Link to="/sites/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create New Site
          </Button>
        </Link>
      </div>

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

