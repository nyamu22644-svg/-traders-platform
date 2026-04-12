import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { siteService } from '../services/siteService';
import { Site, SiteConfig } from '../lib/supabase';
import { Spinner } from '../components/ui/Spinner';
import { PlatformLayout } from '../components/templates/PlatformLayout';

export default function SitePreview() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadSite() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await siteService.getSiteDetails(id);
        setSite(data.site);
        setConfig(data.config);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    loadSite();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  if (error || !site || !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-50">
        <h1 className="text-2xl font-bold mb-4">Site Not Found</h1>
        <p className="text-zinc-400 mb-8">This site doesn't exist or is not accessible.</p>
        <Link to="/" className="text-blue-500 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return <PlatformLayout site={site} config={config} />;
}
