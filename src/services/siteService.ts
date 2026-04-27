import { supabase, Site, Domain, SiteConfig, SiteType, DomainPurchaseRequest, DomainPricingRule, SiteDeployment } from '../lib/supabase';
import { DEFAULT_ENABLED_TOOLS } from '../lib/toolCatalog';

const DEFAULT_PLATFORM_A_RECORD = '76.76.21.21';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const DEFAULT_PLATFORM_ROOT_DOMAIN = String(import.meta.env.VITE_PLATFORM_ROOT_DOMAIN || '').trim();

export interface DomainWithSite extends Domain {
  sites: Pick<Site, 'id' | 'name' | 'user_id'>;
}

export interface SiteDeploymentWithSite extends SiteDeployment {
  sites: Pick<Site, 'id' | 'name' | 'user_id'>;
}

export interface DomainCheckoutResult {
  orderId: string;
  paymentReference: string;
  paymentProvider: 'mpesa' | 'paystack' | 'flutterwave' | 'manual';
  amount: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string;
  domainName: string;
  provider: 'namecheap' | 'namecheap_affiliate' | 'porkbun';
  checkoutUrl: string | null;
}

export interface DomainAvailabilityResult {
  domain: string;
  checked?: boolean;
  available: boolean;
  premium: boolean;
  message?: string;
  source?: string;
  priceSource?: 'live' | 'estimated' | null;
  providerPrice?: number | null;
  pricing: {
    years: number;
    currency: string;
    sellPrice: number;
    unitSellPrice: number;
    baseCost: number;
    margin: number;
    tld: string;
  } | null;
}

export interface CommissionIngestEventInput {
  site_id?: string;
  client_loginid: string;
  trade_reference?: string;
  referral_code?: string;
  currency?: string;
  gross_commission: number;
  total_commission_pct?: number;
  platform_share_pct?: number;
  client_share_pct?: number;
  platform_amount?: number;
  client_amount?: number;
  status?: 'pending' | 'confirmed' | 'reversed' | 'paid_out';
  occurred_at?: string;
  source?: string;
}

const DEFAULT_SEARCH_TLDS = ['com', 'net', 'org', 'io', 'co', 'app', 'ai', 'dev'];
const PORKBUN_CHECK_CACHE_TTL_MS = 12000;
const porkbunAvailabilityCache = new Map<string, { expiresAt: number; result: DomainAvailabilityResult }>();

function slugifySiteName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function makeDeploymentSlug(siteName: string, siteId: string) {
  const base = slugifySiteName(siteName) || 'site';
  const suffix = siteId.replace(/-/g, '').slice(0, 8).toLowerCase();
  return `${base}-${suffix}`;
}

function getPlatformRootDomain() {
  if (DEFAULT_PLATFORM_ROOT_DOMAIN) {
    return DEFAULT_PLATFORM_ROOT_DOMAIN.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1') return 'localhost';
    return host;
  }

  return 'dgait.vercel.app';
}

function shouldUsePathDeploymentUrl(rootDomain: string) {
  const normalized = String(rootDomain || '').toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === 'vercel.app'
    || normalized.endsWith('.vercel.app');
}

function buildPlatformSubdomainUrl(slug: string) {
  const rootDomain = getPlatformRootDomain();

  if (shouldUsePathDeploymentUrl(rootDomain)) {
    return `${window.location.origin}/deploy/${slug}`;
  }

  return `https://${slug}.${rootDomain}`;
}

function buildDomainSearchCandidates(rawInput: string) {
  const normalized = normalizeDomainInput(rawInput);
  const parts = normalized.split('.').filter(Boolean);

  const baseRaw = parts.length > 0 ? parts[0] : normalized;
  const base = baseRaw.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

  if (!base) return [] as string[];

  const candidates = new Set<string>();

  if (parts.length >= 2) {
    candidates.add(normalized);
  }

  for (const tld of DEFAULT_SEARCH_TLDS) {
    candidates.add(`${base}.${tld}`);
  }

  return Array.from(candidates).slice(0, 10);
}

function normalizeDomainInput(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

function normalizeDomainCheckError(
  rawMessage: string | undefined,
  provider: 'namecheap_affiliate' | 'porkbun'
) {
  const fallback = provider === 'porkbun'
    ? 'Porkbun domain check is temporarily unavailable. Please retry in a few seconds.'
    : 'Namecheap domain check is temporarily unavailable. Please retry in a few seconds.';

  if (!rawMessage) return fallback;

  const lower = rawMessage.toLowerCase();
  if (lower.includes('within 10 seconds')) {
    return 'Domain provider rate limit reached. Please wait a few seconds, then check again.';
  }

  if (lower.includes('unexpected token') || lower.includes('not valid json') || lower.includes('<html')) {
    return fallback;
  }

  return rawMessage;
}

function generateVerificationToken() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function getAuthBearerHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('You must be signed in to perform this action.');
  }

  return `Bearer ${token}`;
}

async function fetchJsonWithTimeout(url: string, options: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestUrl = buildApiUrl(url);

  try {
    const response = await fetch(requestUrl, {
      ...options,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { error: raw };
      }
    }

    return { response, payload };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out while waiting for domain services. Please retry in a few seconds.');
    }

    throw new Error('Could not reach domain API. Start both frontend and API with `npm run dev:full`.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildDefaultSiteConfig(siteId: string, siteName: string): SiteConfig {
  const now = new Date().toISOString();

  return {
    id: `fallback-${siteId}`,
    site_id: siteId,
    theme_color: '#0f172a',
    primary_color: '#06b6d4',
    secondary_color: '#020617',
    site_title: siteName,
    description: null,
    logo_url: null,
    enabled_modules: [],
    enabled_tools: DEFAULT_ENABLED_TOOLS,
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
    created_at: now,
    updated_at: now,
  };
}

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
      supabase.from('site_configs').select('*').eq('site_id', id).maybeSingle(),
    ]);

    if (siteRes.error) throw siteRes.error;

    if (configRes.error) {
      throw configRes.error;
    }

    let siteConfig = configRes.data as SiteConfig | null;

    // Self-heal missing config rows for legacy/orphaned sites.
    if (!siteConfig) {
      const { data: createdConfig, error: createConfigError } = await supabase
        .from('site_configs')
        .insert([
          {
            site_id: id,
            enabled_tools: DEFAULT_ENABLED_TOOLS,
            total_commission_pct: 3,
            platform_commission_pct: 20,
            client_commission_pct: 80,
            payout_model: 'platform_collects_and_pays_clients',
            payout_cycle: 'monthly',
            payout_minimum: 10,
          },
        ])
        .select()
        .single();

      if (createConfigError) {
        // If another request created it first, read it back.
        if (createConfigError.code === '23505') {
          const { data: existingConfig, error: existingConfigError } = await supabase
            .from('site_configs')
            .select('*')
            .eq('site_id', id)
            .single();

          if (existingConfigError) throw existingConfigError;
          siteConfig = existingConfig as SiteConfig;
        } else {
          throw createConfigError;
        }
      } else {
        siteConfig = createdConfig as SiteConfig;
      }
    }

    return {
      site: siteRes.data as Site,
      domain: domainRes.data as Domain | null,
      config: siteConfig,
    };
  },

  async getSiteByDeploymentSlug(slug: string) {
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (!normalizedSlug) {
      throw new Error('Deployment slug is required.');
    }

    const { data: deploymentRow, error: deploymentError } = await supabase
      .from('site_deployments')
      .select('site_id')
      .eq('deployment_slug', normalizedSlug)
      .maybeSingle();

    if (deploymentError) throw deploymentError;
    if (!deploymentRow?.site_id) {
      throw new Error('Deployment not found.');
    }

    const { site, config } = await siteService.getSiteDetails(deploymentRow.site_id);
    return { site, config };
  },

  async getPublicSiteById(siteId: string) {
    const normalizedId = String(siteId || '').trim();
    if (!normalizedId) {
      throw new Error('Site id is required.');
    }

    const { data: siteRow, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', normalizedId)
      .eq('is_public', true)
      .maybeSingle();

    if (siteError) throw siteError;
    if (!siteRow) {
      throw new Error('Site not found or not public.');
    }

    const { data: configRow, error: configError } = await supabase
      .from('site_configs')
      .select('*')
      .eq('site_id', normalizedId)
      .maybeSingle();

    if (configError) throw configError;

    return {
      site: siteRow as Site,
      config: (configRow as SiteConfig | null) || buildDefaultSiteConfig(siteRow.id, siteRow.name),
    };
  },

  async getPublicSiteByDeploymentSlug(slug: string) {
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (!normalizedSlug) {
      throw new Error('Deployment slug is required.');
    }

    const { response, payload } = await fetchJsonWithTimeout(
      `/api/deployments/public-site?slug=${encodeURIComponent(normalizedSlug)}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error(payload?.error || 'Deployment not accessible.');
    }

    return {
      site: payload.site as Site,
      config: payload.config as SiteConfig,
      deployment: payload.deployment as SiteDeployment,
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
      .insert([
        {
          site_id: site.id,
          enabled_tools: DEFAULT_ENABLED_TOOLS,
          total_commission_pct: 3,
          platform_commission_pct: 20,
          client_commission_pct: 80,
          payout_model: 'platform_collects_and_pays_clients',
          payout_cycle: 'monthly',
          payout_minimum: 10,
        },
      ]);

    if (configError) throw configError;

    await logAction('create', 'site', site.id, { name, type });

    // Automatically assign a platform subdomain record for deployment tracking.
    try {
      const deploymentSlug = makeDeploymentSlug(site.name, site.id);
      const deploymentUrl = buildPlatformSubdomainUrl(deploymentSlug);

      const { data: deploymentRow, error: deploymentError } = await supabase
        .from('site_deployments')
        .upsert([
          {
            site_id: site.id,
            user_id: userId,
            deployment_slug: deploymentSlug,
            deployment_url: deploymentUrl,
            status: 'active',
            provider: 'vercel',
            environment: 'production',
            last_deployed_at: new Date().toISOString(),
            metadata: {
              auto_assigned: true,
              fallback_preview_url: `${window.location.origin}/deploy/${deploymentSlug}`,
            },
          },
        ], { onConflict: 'site_id' })
        .select()
        .single();

      if (!deploymentError && deploymentRow) {
        await logAction('create', 'site_deployment', deploymentRow.id, {
          site_id: site.id,
          deployment_slug: deploymentSlug,
          deployment_url: deploymentUrl,
        });

        try {
          await siteService.redeploySite(site.id);
        } catch (actionErr) {
          console.error('Automatic deployment action failed:', actionErr);
        }
      }
    } catch (deploymentErr: any) {
      if (deploymentErr?.code !== '42P01') {
        console.error('Failed to auto-create deployment record:', deploymentErr);
      }
    }

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
    const normalizedDomain = normalizeDomainInput(domainName);
    const verificationToken = generateVerificationToken();
    const updatePayload = {
      domain: normalizedDomain,
      verified: false,
      provider: 'manual' as const,
      status: 'pending_verification' as const,
      verification_token: verificationToken,
      verification_record_type: 'TXT' as const,
      verification_record_name: '_tradesaas-challenge',
      verification_record_value: `tradesaas-verification=${verificationToken}`,
      dns_record_type: 'A' as const,
      dns_record_name: '@',
      dns_record_value: DEFAULT_PLATFORM_A_RECORD,
      provisioning_error: null,
      last_verified_at: null,
    };

    if (existingDomainId) {
      const { data, error } = await supabase
        .from('domains')
        .update(updatePayload)
        .eq('id', existingDomainId)
        .eq('site_id', siteId) // Extra safety check
        .select()
        .single();
      if (error) throw error;
      
      await logAction('update', 'domain', data.id, { domain: normalizedDomain });
      return data as Domain;
    } else {
      const { data, error } = await supabase
        .from('domains')
        .insert([{ site_id: siteId, ...updatePayload }])
        .select()
        .single();
      if (error) throw error;
      
      await logAction('create', 'domain', data.id, { domain: normalizedDomain });
      return data as Domain;
    }
  },

  async deleteDomain(domainId: string) {
    const { error } = await supabase
      .from('domains')
      .delete()
      .eq('id', domainId);
    if (error) throw error;

    await logAction('delete', 'domain', domainId);
  },

  async getMyDomains() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [] as DomainWithSite[];

    const { data, error } = await supabase
      .from('domains')
      .select('*, sites!inner(id, name, user_id)')
      .eq('sites.user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as DomainWithSite[];
  },

  async verifyDomain(domain: Domain) {
    const response = await fetch(buildApiUrl('/api/domains/verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domain.domain,
        verificationToken: domain.verification_token,
        verificationRecordName: domain.verification_record_name,
        expectedARecordValue: domain.dns_record_value,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to verify domain DNS records.');
    }

    const now = new Date().toISOString();
    const verified = Boolean(payload.verified);
    const { data, error } = await supabase
      .from('domains')
      .update({
        verified,
        status: verified ? 'active' : 'pending_verification',
        last_verified_at: now,
        provisioning_error: verified ? null : payload?.reason || 'Verification checks did not pass.',
      })
      .eq('id', domain.id)
      .select()
      .single();

    if (error) throw error;

    await logAction('verify', 'domain', domain.id, {
      verified,
      checks: payload?.checks,
    });

    return data as Domain;
  },

  async checkDomainAvailability(
    domainName: string,
    years = 1,
    provider: 'namecheap_affiliate' | 'porkbun' = 'namecheap_affiliate'
  ) {
    const domain = normalizeDomainInput(domainName);
    const endpoint = provider === 'porkbun' ? '/api/porkbun/check' : '/api/namecheap/check';

    if (provider === 'porkbun') {
      const cacheKey = `${domain}|${years}`;
      const cached = porkbunAvailabilityCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    const { response: request, payload } = await fetchJsonWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain, years }),
    });

    if (!request.ok) {
      throw new Error(normalizeDomainCheckError(payload?.error, provider));
    }

    const result = {
      domain,
      checked: true,
      available: Boolean(payload.available),
      premium: Boolean(payload.premium),
      message: payload.message as string | undefined,
      source: payload.source as string | undefined,
      priceSource: (payload.priceSource as 'live' | 'estimated' | null | undefined) ?? null,
      providerPrice: payload.providerPrice ?? null,
      pricing: payload.pricing || null,
    } as DomainAvailabilityResult;

    if (provider === 'porkbun') {
      const cacheKey = `${domain}|${years}`;
      porkbunAvailabilityCache.set(cacheKey, {
        expiresAt: Date.now() + PORKBUN_CHECK_CACHE_TTL_MS,
        result,
      });
    }

    return result;
  },

  async searchDomainAvailabilityOptions(
    domainQuery: string,
    years = 1,
    provider: 'namecheap_affiliate' | 'porkbun' = 'namecheap_affiliate'
  ) {
    const candidates = buildDomainSearchCandidates(domainQuery);

    if (candidates.length === 0) {
      throw new Error('Enter a valid domain name or keyword.');
    }

    if (provider === 'porkbun') {
      const { response: request, payload } = await fetchJsonWithTimeout('/api/porkbun/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: candidates,
          years,
        }),
      });

      if (!request.ok) {
        throw new Error(normalizeDomainCheckError(payload?.error, provider));
      }

      const options = Array.isArray(payload?.options) ? payload.options : [];
      if (!options.length) {
        throw new Error('No domain suggestions returned from Porkbun. Please retry.');
      }

      const normalized = options.map((option: any) => ({
        domain: option.domain,
        checked: option.checked !== false,
        available: Boolean(option.available),
        premium: Boolean(option.premium),
        message: option.message as string | undefined,
        source: option.source as string | undefined,
        priceSource: (option.priceSource as 'live' | 'estimated' | null | undefined) ?? null,
        providerPrice: option.providerPrice ?? null,
        pricing: option.pricing || null,
      } as DomainAvailabilityResult));

      return normalized.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        if ((a.checked !== false) !== (b.checked !== false)) return a.checked === false ? 1 : -1;
        const aPrice = a.pricing?.sellPrice ?? Number.POSITIVE_INFINITY;
        const bPrice = b.pricing?.sellPrice ?? Number.POSITIVE_INFINITY;
        if (aPrice !== bPrice) return aPrice - bPrice;
        return a.domain.localeCompare(b.domain);
      });
    }

    const results = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          return await siteService.checkDomainAvailability(candidate, years, provider);
        } catch (err: any) {
          return {
            domain: candidate,
            checked: true,
            available: false,
            premium: false,
            message: err?.message || 'Check failed.',
            source: provider,
            priceSource: null,
            providerPrice: null,
            pricing: null,
          } as DomainAvailabilityResult;
        }
      })
    );

    const unavailableWithErrors = results.filter((item) => !item.available && item.message);
    if (unavailableWithErrors.length === results.length) {
      throw new Error(unavailableWithErrors[0].message || 'All domain checks failed.');
    }

    const rankTld = (domain: string) => {
      if (domain.endsWith('.com')) return 0;
      if (domain.endsWith('.net')) return 1;
      if (domain.endsWith('.org')) return 2;
      return 3;
    };

    return results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return rankTld(a.domain) - rankTld(b.domain);
    });
  },

  async createDomainPurchaseRequest(input: {
    siteId: string;
    domainName: string;
    years: number;
    registrantEmail: string;
    availabilitySnapshot?: any;
    paymentProvider?: 'mpesa' | 'paystack' | 'flutterwave' | 'manual';
    provider?: 'namecheap' | 'namecheap_affiliate' | 'porkbun';
    autoCapture?: boolean;
  }) {
    const normalizedDomain = normalizeDomainInput(input.domainName);

    const authHeader = await getAuthBearerHeader();
    const { response: checkoutResponse, payload: checkoutPayload } = await fetchJsonWithTimeout('/api/payments/mock/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        siteId: input.siteId,
        domain: normalizedDomain,
        years: input.years,
        registrantEmail: input.registrantEmail,
        paymentProvider: input.paymentProvider || 'manual',
        provider: input.provider || 'namecheap_affiliate',
        availabilitySnapshot: input.availabilitySnapshot || {},
      }),
    });

    if (!checkoutResponse.ok) {
      throw new Error(checkoutPayload?.error || 'Failed to create domain checkout.');
    }

    if (input.autoCapture !== false) {
      const { response: webhookResponse, payload: webhookPayload } = await fetchJsonWithTimeout('/api/payments/mock/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentReference: checkoutPayload.paymentReference,
          status: 'paid',
        }),
      });
      if (!webhookResponse.ok) {
        throw new Error(webhookPayload?.error || 'Payment capture completed but order processing failed.');
      }
    }

    await logAction('create', 'domain_purchase_request', checkoutPayload.orderId, {
      site_id: input.siteId,
      domain_name: normalizedDomain,
      years: input.years,
    });

    return checkoutPayload as DomainCheckoutResult;
  },

  async captureDomainOrderPayment(paymentReference: string, status: 'paid' | 'failed' | 'refunded' = 'paid') {
    const { response, payload } = await fetchJsonWithTimeout('/api/payments/mock/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentReference,
        status,
      }),
    });

    if (!response.ok) {
      throw new Error(payload?.error || 'Could not capture payment status.');
    }

    return payload;
  },

  async getMyDomainPurchaseRequests() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [] as (DomainPurchaseRequest & { sites: Pick<Site, 'id' | 'name' | 'user_id'> })[];

    const { data, error } = await supabase
      .from('domain_purchase_requests')
      .select('*, sites!inner(id, name, user_id)')
      .eq('sites.user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as (DomainPurchaseRequest & { sites: Pick<Site, 'id' | 'name' | 'user_id'> })[];
  },

  async getDomainPricingRules() {
    const { data, error } = await supabase
      .from('domain_pricing_rules')
      .select('*')
      .order('tld', { ascending: true });

    if (error) throw error;
    return (data || []) as DomainPricingRule[];
  },

  async upsertDomainPricingRule(input: {
    id?: string;
    tld: string;
    currency: string;
    base_price: number | null;
    markup_type: 'flat' | 'percent';
    markup_value: number;
    service_fee: number;
    final_price_override: number | null;
    is_active: boolean;
    notes: string | null;
  }) {
    const payload = {
      tld: input.tld.trim().toLowerCase(),
      currency: input.currency.trim().toUpperCase(),
      base_price: input.base_price,
      markup_type: input.markup_type,
      markup_value: input.markup_value,
      service_fee: input.service_fee,
      final_price_override: input.final_price_override,
      is_active: input.is_active,
      notes: input.notes,
    };

    const query = supabase.from('domain_pricing_rules');

    if (input.id) {
      const { data, error } = await query
        .update(payload)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data as DomainPricingRule;
    }

    const { data, error } = await query
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data as DomainPricingRule;
  },

  async deleteDomainPricingRule(id: string) {
    const { error } = await supabase
      .from('domain_pricing_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async processDomainOrder(orderId: string) {
    const authHeader = await getAuthBearerHeader();

    const { response, payload } = await fetchJsonWithTimeout('/api/domain-orders/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
      throw new Error(payload?.error || 'Could not process domain order.');
    }

    return payload;
  },

  async ingestCommissionEvents(input: {
    events: CommissionIngestEventInput[];
    siteId?: string;
    dryRun?: boolean;
  }) {
    const authHeader = await getAuthBearerHeader();

    const { response, payload } = await fetchJsonWithTimeout('/api/commissions/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        events: input.events,
        siteId: input.siteId,
        dryRun: input.dryRun === true,
      }),
    }, 25000);

    if (!response.ok && response.status !== 207) {
      throw new Error(payload?.error || 'Failed to ingest commission events.');
    }

    return payload;
  },

  async ensureMySitesHaveDeployments() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [] as SiteDeployment[];

    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, name, user_id')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (sitesError) throw sitesError;

    const { data: existingRows, error: existingError } = await supabase
      .from('site_deployments')
      .select('id, site_id, deployment_slug, deployment_url, metadata')
      .eq('user_id', authData.user.id);

    if (existingError) {
      if (existingError.code === '42P01') return [] as SiteDeployment[];
      throw existingError;
    }

    const deploymentRows = existingRows || [];

    const rowsNeedingUrlRepair = deploymentRows.filter((row: any) => {
      const slug = String(row.deployment_slug || '').trim();
      if (!slug) return false;
      const expectedUrl = buildPlatformSubdomainUrl(slug);
      return String(row.deployment_url || '').trim() !== expectedUrl;
    });

    for (const row of rowsNeedingUrlRepair) {
      const expectedUrl = buildPlatformSubdomainUrl(row.deployment_slug);
      await supabase
        .from('site_deployments')
        .update({
          deployment_url: expectedUrl,
          metadata: {
            ...(row.metadata || {}),
            fallback_preview_url: `${window.location.origin}/deploy/${row.deployment_slug}`,
          },
        })
        .eq('id', row.id)
        .eq('user_id', authData.user.id);
    }

    const existingSiteIds = new Set(deploymentRows.map((row: any) => row.site_id));
    const missingSites = (sites || []).filter((site: any) => !existingSiteIds.has(site.id));

    if (missingSites.length === 0) {
      return [] as SiteDeployment[];
    }

    const now = new Date().toISOString();
    const rowsToInsert = missingSites.map((site: any) => {
      const slug = makeDeploymentSlug(site.name, site.id);
      return {
        site_id: site.id,
        user_id: authData.user.id,
        deployment_slug: slug,
        deployment_url: buildPlatformSubdomainUrl(slug),
        status: 'active',
        provider: 'vercel',
        environment: 'production',
        last_deployed_at: now,
        metadata: {
          auto_assigned: true,
          fallback_preview_url: `${window.location.origin}/deploy/${slug}`,
        },
      };
    });

    const { data, error } = await supabase
      .from('site_deployments')
      .upsert(rowsToInsert, { onConflict: 'site_id' })
      .select('*');

    if (error) throw error;

    for (const row of data || []) {
      await logAction('create', 'site_deployment', row.id, {
        site_id: row.site_id,
        deployment_slug: row.deployment_slug,
        deployment_url: row.deployment_url,
      });
    }

    return (data || []) as SiteDeployment[];
  },

  async getMySiteDeployments() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [] as SiteDeploymentWithSite[];

    try {
      await siteService.ensureMySitesHaveDeployments();
    } catch (err: any) {
      if (err?.code !== '42P01') {
        throw err;
      }
      return [] as SiteDeploymentWithSite[];
    }

    const { data, error } = await supabase
      .from('site_deployments')
      .select('*, sites!inner(id, name, user_id)')
      .eq('user_id', authData.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return [] as SiteDeploymentWithSite[];
      throw error;
    }

    return (data || []) as SiteDeploymentWithSite[];
  },

  async getMyDeploymentActivities(limit = 25) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [] as any[];

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', authData.user.id)
      .in('entity_type', ['site_deployment', 'site', 'domain', 'domain_purchase_request'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async redeploySite(siteId: string) {
    const authHeader = await getAuthBearerHeader();

    const { response, payload } = await fetchJsonWithTimeout('/api/deployments/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        siteId,
        action: 'redeploy',
      }),
    });

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to trigger deployment.');
    }

    return payload;
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

