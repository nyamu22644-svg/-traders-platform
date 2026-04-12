import { supabase, Site, Domain, SiteConfig, SiteType } from '../lib/supabase';

const logAction = async (action: string, entityType: string, entityId: string, details?: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('audit_logs').insert([{
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    }]);
  } catch (err) {
    console.error('Failed to log action:', err);
  }
};

export const siteService = {
  async getSites(userId: string) {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Site[];
  },

  async getSiteDetails(id: string) {
    const [siteRes, domainRes, configRes] = await Promise.all([
      supabase.from('sites').select('*').eq('id', id).single(),
      supabase.from('domains').select('*').eq('site_id', id).maybeSingle(),
      supabase.from('site_configs').select('*').eq('site_id', id).single(),
    ]);

    if (siteRes.error) throw siteRes.error;

    return {
      site: siteRes.data as Site,
      domain: domainRes.data as Domain | null,
      config: configRes.data as SiteConfig | null,
    };
  },

  async createSite(name: string, type: SiteType, userId: string) {
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert([{ name, type, user_id: userId, status: 'draft' }])
      .select()
      .single();

    if (siteError) throw siteError;

    const { error: configError } = await supabase
      .from('site_configs')
      .insert([{ site_id: site.id }]);

    if (configError) throw configError;

    await logAction('create', 'site', site.id, { name, type });

    return site as Site;
  },

  async updateSite(siteId: string, updates: Partial<Site>) {
    const { data, error } = await supabase
      .from('sites')
      .update(updates)
      .eq('id', siteId)
      .select()
      .single();
    if (error) throw error;
    
    await logAction('update', 'site', siteId, updates);
    
    return data as Site;
  },

  async updateDomain(siteId: string, domainName: string, existingDomainId?: string) {
    if (existingDomainId) {
      const { data, error } = await supabase
        .from('domains')
        .update({ domain: domainName })
        .eq('id', existingDomainId)
        .eq('site_id', siteId) // Extra safety check
        .select()
        .single();
      if (error) throw error;
      
      await logAction('update', 'domain', data.id, { domain: domainName });
      return data as Domain;
    } else {
      const { data, error } = await supabase
        .from('domains')
        .insert([{ site_id: siteId, domain: domainName }])
        .select()
        .single();
      if (error) throw error;
      
      await logAction('create', 'domain', data.id, { domain: domainName });
      return data as Domain;
    }
  },

  async updateConfig(configId: string, siteId: string, updates: Partial<SiteConfig>) {
    const { data, error } = await supabase
      .from('site_configs')
      .update(updates)
      .eq('id', configId)
      .eq('site_id', siteId) // Extra safety check
      .select()
      .single();
    if (error) throw error;
    
    await logAction('update', 'site_config', configId, updates);
    return data as SiteConfig;
  }
};

