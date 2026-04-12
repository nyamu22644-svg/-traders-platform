import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Globe } from 'lucide-react';
import { useSites } from '../hooks/useSites';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';

export default function Sites() {
  const { sites, loading, error } = useSites();

  if (error) {
    return <div className="text-red-500">Failed to load sites.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">My Sites</h1>
          <p className="text-zinc-400 mt-1">Manage your trading platforms.</p>
        </div>
        <Link to="/sites/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create New Site
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-8 h-8 text-zinc-500" />
        </div>
      ) : sites.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed">
          <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <Globe className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-50 mb-2">No sites yet</h3>
          <p className="text-zinc-400 mb-6 max-w-sm">
            Get started by creating your first trading platform. It only takes a few seconds.
          </p>
          <Link to="/sites/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create New Site
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <Link key={site.id} to={`/sites/${site.id}`}>
              <Card className="p-6 hover:border-zinc-700 transition-all hover:shadow-md group cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                    <Globe className="w-5 h-5 text-zinc-300" />
                  </div>
                  <Badge 
                    variant={
                      site.status === 'active' ? 'success' : 
                      site.status === 'maintenance' ? 'warning' : 
                      site.status === 'suspended' ? 'danger' : 
                      site.status === 'offline' ? 'danger' : 'secondary'
                    }
                    className="capitalize"
                  >
                    {site.status}
                  </Badge>
                </div>
                <div className="mt-auto">
                  <h3 className="text-lg font-semibold text-zinc-50 mb-1 truncate">{site.name}</h3>
                  <p className="text-sm text-zinc-400 capitalize">
                    {site.type.replace('_', ' ')}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

