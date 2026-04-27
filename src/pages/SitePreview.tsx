import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { siteService } from '../services/siteService';
import { Site, SiteConfig, supabase } from '../lib/supabase';
import { Spinner } from '../components/ui/Spinner';
import { PlatformLayout } from '../components/templates/PlatformLayout';

const DEMO_SITE: Site = {
  id: 'demo-site',
  user_id: 'demo-user',
  name: 'Deriv Auto Builder Demo',
  type: 'bot_platform',
  status: 'active',
  is_public: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_CONFIG: SiteConfig = {
  id: 'demo-config',
  site_id: 'demo-site',
  theme_color: '#0f172a',
  primary_color: '#06b6d4',
  secondary_color: '#020617',
  site_title: 'Deriv Smart Trade Hub',
  description: 'Automatic trading site builder with modular tools.',
  logo_url: null,
  enabled_modules: ['trading', 'bots', 'signals', 'analytics'],
  enabled_tools: [
    'bot_builder',
  ],
  layout_style: 'default',
  navigation_items: [],
  hero_content: {},
  cta_content: {},
  support_social_links: {},
  total_commission_pct: 3,
  platform_commission_pct: 20,
  client_commission_pct: 80,
  deriv_referral_code: null,
  deriv_utm_source: null,
  deriv_utm_medium: null,
  deriv_utm_campaign: null,
  payout_model: 'platform_collects_and_pays_clients',
  payout_cycle: 'monthly',
  payout_minimum: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function SitePreview() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadSite() {
      if (!id && !slug) return;

      if (id === 'demo') {
        setSite(DEMO_SITE);
        setConfig(DEMO_CONFIG);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (slug) {
          const data = await siteService.getPublicSiteByDeploymentSlug(slug);
          setSite(data.site);
          setConfig(data.config);
        } else if (id) {
          const { data: authData } = await supabase.auth.getUser();
          const data = authData.user
            ? await siteService.getSiteDetails(id)
            : await siteService.getPublicSiteById(id);
          setSite(data.site);
          setConfig(data.config);
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    loadSite();
  }, [id, slug]);

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
