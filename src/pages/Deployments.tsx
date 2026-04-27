import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Rocket, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { SiteDeploymentWithSite, siteService } from '../services/siteService';

function deploymentStatusVariant(status: SiteDeploymentWithSite['status']) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'building':
      return 'warning' as const;
    case 'failed':
      return 'danger' as const;
    default:
      return 'outline' as const;
  }
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<SiteDeploymentWithSite[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningSiteId, setActioningSiteId] = useState<string | null>(null);
  const [copiedDeploymentId, setCopiedDeploymentId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [deploymentRows, activityRows] = await Promise.all([
        siteService.getMySiteDeployments(),
        siteService.getMyDeploymentActivities(30),
      ]);

      setDeployments(deploymentRows);
      setActivities(activityRows || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load deployments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRedeploy = async (siteId: string) => {
    setActioningSiteId(siteId);
    setError(null);

    try {
      await siteService.redeploySite(siteId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Redeploy action failed.');
    } finally {
      setActioningSiteId(null);
    }
  };

  const handleCopyUrl = async (deployment: SiteDeploymentWithSite) => {
    try {
      await navigator.clipboard.writeText(deployment.deployment_url);
      setCopiedDeploymentId(deployment.id);
      window.setTimeout(() => setCopiedDeploymentId(null), 1600);
    } catch (err) {
      console.error('Failed to copy deployment URL', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[360px] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Deployments</h1>
          <p className="text-zinc-400 mt-1">
            Monitor deployment activity and manage automatic platform subdomain links.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Site Deployments</CardTitle>
          <CardDescription>
            Each site gets a generated deployment URL automatically and can be re-deployed from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
              No deployment records yet. Create a site to auto-assign deployment links.
              <div className="mt-3">
                <Link to="/sites/new">
                  <Button size="sm">Create Site</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((deployment) => {
                const fallbackUrl = deployment.metadata?.fallback_preview_url as string | undefined;
                return (
                  <div key={deployment.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="text-zinc-100 font-medium">{deployment.sites?.name || deployment.site_id}</div>
                        <div className="text-xs text-zinc-500 mt-1">Slug: {deployment.deployment_slug}</div>
                        <div className="text-xs text-zinc-400 mt-2 break-all">{deployment.deployment_url}</div>
                        {fallbackUrl && (
                          <div className="text-xs text-zinc-500 mt-1">Fallback preview: {fallbackUrl}</div>
                        )}
                        {deployment.last_error && (
                          <div className="text-xs text-red-300 mt-2">{deployment.last_error}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={deploymentStatusVariant(deployment.status)} className="capitalize">
                          {deployment.status}
                        </Badge>
                        <Badge variant="outline" className="capitalize">{deployment.provider}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleCopyUrl(deployment)}
                        >
                          {copiedDeploymentId === deployment.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedDeploymentId === deployment.id ? 'Copied' : 'Copy URL'}
                        </Button>
                        <a href={deployment.deployment_url} target="_blank" rel="noreferrer noopener">
                          <Button size="sm" variant="secondary" className="gap-1">
                            Open
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => handleRedeploy(deployment.site_id)}
                          isLoading={actioningSiteId === deployment.site_id}
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          Redeploy
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 mt-3">
                      Last deployed: {new Date(deployment.last_deployed_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Activity</CardTitle>
          <CardDescription>Recent deployment and related site/domain actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
              No deployment activity yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="text-sm text-zinc-200 capitalize">{activity.action.replace('_', ' ')} • {activity.entity_type.replace('_', ' ')}</div>
                  <div className="text-xs text-zinc-500 mt-1">{new Date(activity.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
