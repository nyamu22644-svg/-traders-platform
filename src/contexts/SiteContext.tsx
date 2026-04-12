import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Site, Domain, SiteConfig } from '../lib/supabase';
import { siteService } from '../services/siteService';
import { Spinner } from '../components/ui/Spinner';

interface SiteContextType {
  site: Site;
  domain: Domain | null;
  config: SiteConfig | null;
  setSite: (site: Site) => void;
  setDomain: (domain: Domain) => void;
  setConfig: (config: SiteConfig) => void;
  refreshSite: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSite = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await siteService.getSiteDetails(id);
      setSite(data.site);
      setDomain(data.domain);
      setConfig(data.config);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-in fade-in">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
          <span className="text-red-500 font-bold text-xl">!</span>
        </div>
        <h2 className="text-xl font-semibold text-zinc-50">Site not found</h2>
        <p className="text-zinc-400 max-w-md text-center">
          This site doesn't exist or you don't have permission to view it. 
          Row-Level Security (RLS) ensures you can only access sites you own.
        </p>
      </div>
    );
  }

  return (
    <SiteContext.Provider value={{ site, domain, config, setSite, setDomain, setConfig, refreshSite: fetchSite }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext() {
  const context = useContext(SiteContext);
  if (context === undefined) {
    throw new Error('useSiteContext must be used within a SiteProvider');
  }
  return context;
}
