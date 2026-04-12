import { useState, useEffect, useCallback } from 'react';
import { siteService } from '../services/siteService';
import { Site } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const fetchSites = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await siteService.getSites(user.id);
      setSites(data);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  return { sites, loading, error, refetch: fetchSites };
}

