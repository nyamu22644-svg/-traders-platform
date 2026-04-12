import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { siteService } from '../services/siteService';
import { SiteType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

export default function CreateSite() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [type, setType] = useState<SiteType>('bot_platform');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const site = await siteService.createSite(name, type, user.id);
      navigate(`/sites/${site.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create site.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-50 mb-6 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Create New Site</h1>
        <p className="text-zinc-400 mt-1">Set up a new trading platform instance.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">
                Site Name
              </label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alpha Trading Bot"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">
                Platform Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SiteType)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 transition-colors appearance-none"
              >
                <option value="bot_platform">Bot Platform</option>
                <option value="smart_trader">Smart Trader</option>
                <option value="signal_site">Signal Site</option>
              </select>
              <p className="text-sm text-zinc-500">
                This determines the template and features available on your site.
              </p>
            </div>

            <div className="pt-6 border-t border-zinc-800 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={loading}
              >
                Create Site
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

