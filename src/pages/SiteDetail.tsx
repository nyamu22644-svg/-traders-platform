import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save, Eye, Globe, Copy, Check } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { siteService } from '../services/siteService';
import { cn } from '../lib/utils';
import { DEFAULT_ENABLED_TOOLS, normalizeToolIds, TOOL_DEFINITIONS, ToolId } from '../lib/toolCatalog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { TradingSettings } from '../components/site/TradingSettings';
import { BotSettings } from '../components/site/BotSettings';
import { ToolConfigurator } from '../components/site/ToolConfigurator';

type Tab = 'overview' | 'builder' | 'trading' | 'bots' | 'domain';

export default function SiteDetail() {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { site, domain, config, setSite, setDomain, setConfig } = useSiteContext();
  
  const [saving, setSaving] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [copiedPlatformUrl, setCopiedPlatformUrl] = useState(false);
  
  const [siteType, setSiteType] = useState<string>('');
  
  const [formData, setFormData] = useState({
    site_title: '',
    description: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    logo_url: '',
    enabled_modules: [] as string[],
    enabled_tools: [...DEFAULT_ENABLED_TOOLS] as ToolId[],
    layout_style: 'default',
    navigation_items: [] as any[],
    hero_content: {} as any,
    cta_content: {} as any,
    support_social_links: {} as any,
    total_commission_pct: 3,
    platform_commission_pct: 20,
    client_commission_pct: 80,
    payout_model: 'platform_collects_and_pays_clients' as 'platform_collects_and_pays_clients' | 'deriv_direct_split_if_supported',
    payout_cycle: 'monthly' as 'weekly' | 'monthly',
    payout_minimum: 10,
  });

  useEffect(() => {
    if (site) setSiteType(site.type);
    if (domain) setDomainInput(domain.domain);
    if (config) {
      setFormData({
        site_title: config.site_title || '',
        description: config.description || '',
        primary_color: config.primary_color || config.theme_color || '#000000',
        secondary_color: config.secondary_color || '#ffffff',
        logo_url: config.logo_url || '',
        enabled_modules: config.enabled_modules || [],
        enabled_tools: normalizeToolIds(config.enabled_tools, { fallbackToDefault: true }),
        layout_style: config.layout_style || 'default',
        navigation_items: config.navigation_items || [],
        hero_content: config.hero_content || {},
        cta_content: config.cta_content || {},
        support_social_links: config.support_social_links || {},
        total_commission_pct: typeof config.total_commission_pct === 'number' ? config.total_commission_pct : 3,
        platform_commission_pct: typeof config.platform_commission_pct === 'number' ? config.platform_commission_pct : 20,
        client_commission_pct: typeof config.client_commission_pct === 'number' ? config.client_commission_pct : 80,
        payout_model: config.payout_model || 'platform_collects_and_pays_clients',
        payout_cycle: config.payout_cycle || 'monthly',
        payout_minimum: typeof config.payout_minimum === 'number' ? config.payout_minimum : 10,
      });
    }
  }, [site, domain, config]);

  const handleSaveDomain = async () => {
    if (!site || !domainInput) return;
    setSaving(true);
    try {
      const updatedDomain = await siteService.updateDomain(site.id, domainInput, domain?.id);
      setDomain(updatedDomain);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config || !site) return;
    setSaving(true);
    try {
      if (siteType !== site.type) {
        const updatedSite = await siteService.updateSite(site.id, { type: siteType as any });
        setSite(updatedSite);
      }
      const updatedConfig = await siteService.updateConfig(config.id, site.id, formData);
      setConfig(updatedConfig);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!site) return;
    setTogglingPublic(true);
    try {
      const updatedSite = await siteService.updateSite(site.id, { is_public: !site.is_public });
      setSite(updatedSite);
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingPublic(false);
    }
  };

  const enabledTools = normalizeToolIds(formData.enabled_tools);
  const platformSiteUrl = `${window.location.origin}/preview/${site.id}`;

  const handleToggleTool = (toolId: ToolId) => {
    setFormData((prev) => {
      const current = normalizeToolIds(prev.enabled_tools);
      const next = current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId];

      return { ...prev, enabled_tools: next };
    });
  };

  const handleMoveTool = (toolId: ToolId, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const current = normalizeToolIds(prev.enabled_tools);
      const currentIndex = current.indexOf(toolId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return prev;

      const next = [...current];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

      return { ...prev, enabled_tools: next };
    });
  };

  const handlePlatformCommissionChange = (value: string) => {
    const parsed = Number(value);
    const nextPlatform = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    const nextClient = Number((100 - nextPlatform).toFixed(2));

    setFormData((prev) => ({
      ...prev,
      platform_commission_pct: nextPlatform,
      client_commission_pct: nextClient,
    }));
  };

  const handleClientCommissionChange = (value: string) => {
    const parsed = Number(value);
    const nextClient = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    const nextPlatform = Number((100 - nextClient).toFixed(2));

    setFormData((prev) => ({
      ...prev,
      platform_commission_pct: nextPlatform,
      client_commission_pct: nextClient,
    }));
  };

  const handleTotalCommissionChange = (value: string) => {
    const parsed = Number(value);
    const nextTotal = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;

    setFormData((prev) => ({
      ...prev,
      total_commission_pct: nextTotal,
    }));
  };

  const handleCopyPlatformUrl = async () => {
    try {
      await navigator.clipboard.writeText(platformSiteUrl);
      setCopiedPlatformUrl(true);
      window.setTimeout(() => setCopiedPlatformUrl(false), 1800);
    } catch (err) {
      console.error('Failed to copy platform URL', err);
    }
  };

  const updateHeroField = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      hero_content: {
        ...(prev.hero_content || {}),
        [key]: value,
      },
    }));
  };

  const getDashboardFeatures = () => {
    const features = Array.isArray(formData.cta_content?.features) ? [...formData.cta_content.features] : [];
    while (features.length < 3) {
      features.push({ title: '', description: '' });
    }

    return features.slice(0, 3);
  };

  const updateDashboardFeature = (index: number, field: 'title' | 'description', value: string) => {
    const nextFeatures = getDashboardFeatures().map((item, i) => {
      if (i !== index) return item;
      return {
        ...item,
        [field]: value,
      };
    });

    setFormData((prev) => ({
      ...prev,
      cta_content: {
        ...(prev.cta_content || {}),
        features: nextFeatures,
      },
    }));
  };

  const dashboardFeatures = getDashboardFeatures();

  if (!site) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <button
          onClick={() => navigate('/sites')}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-50 mb-6 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sites
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">{site.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-zinc-400 text-sm capitalize">{site.type.replace('_', ' ')}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              <Badge 
                variant={
                  site.status === 'active' ? 'success' : 
                  site.status === 'maintenance' ? 'warning' : 
                  site.status === 'suspended' ? 'danger' : 
                  site.status === 'offline' ? 'danger' : 'secondary'
                }
              >
                {site.status}
              </Badge>
              {site.is_public && (
                <Badge variant="secondary" className="gap-1 bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  <Globe className="w-3 h-3" />
                  Public
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => window.open(`/preview/${site.id}`, '_blank')}
            >
              <Eye className="w-4 h-4" />
              Preview Site
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleCopyPlatformUrl}
            >
              {copiedPlatformUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedPlatformUrl ? 'Copied' : 'Copy Platform URL'}
            </Button>
            {domain?.verified && (
              <a
                href={`https://${domain.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="gap-2">
                  Visit Site
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-800">
        <nav className="flex gap-6">
          {(['overview', 'builder', 'trading', 'bots', 'domain'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-zinc-50 text-zinc-50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <Card className="min-h-[400px]">
        <CardContent className="pt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold text-zinc-50">Site Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-400">Created At</p>
                  <p className="font-medium text-zinc-200">{new Date(site.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-400">Last Updated</p>
                  <p className="font-medium text-zinc-200">{new Date(site.updated_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-400">Site ID</p>
                  <p className="font-mono text-sm text-zinc-300 bg-zinc-900 p-2 rounded-md inline-block">{site.id}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm text-zinc-400">Assigned Platform URL</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="font-mono text-sm text-zinc-300 bg-zinc-900 p-2 rounded-md break-all">{platformSiteUrl}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyPlatformUrl}>
                        {copiedPlatformUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedPlatformUrl ? 'Copied' : 'Copy'}
                      </Button>
                      <Button size="sm" variant="secondary" className="gap-2" onClick={() => window.open(platformSiteUrl, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    This link is assigned automatically by the platform. Add a verified custom domain in the Domain tab to replace it for public traffic.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'builder' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-zinc-50">Branding & Settings</h3>
                
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">Public Preview</h4>
                    <p className="text-xs text-zinc-500 mt-1">Allow anyone with the link to view the preview site.</p>
                  </div>
                  <button
                    onClick={handleTogglePublic}
                    disabled={togglingPublic}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative disabled:opacity-50", 
                      site.is_public ? "bg-indigo-500" : "bg-zinc-700"
                    )}
                  >
                    <span 
                      className={cn(
                        "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform", 
                        site.is_public ? "translate-x-5" : "translate-x-0"
                      )} 
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Site Template</label>
                    <select
                      value={siteType}
                      onChange={(e) => setSiteType(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 transition-colors appearance-none"
                    >
                      <option value="bot_platform">Bot Platform</option>
                      <option value="smart_trader">Smart Trader</option>
                      <option value="signal_site">Signal Site</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Site Title</label>
                    <Input
                      type="text"
                      value={formData.site_title}
                      onChange={(e) => setFormData({ ...formData, site_title: e.target.value })}
                      placeholder="My Trading Site"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full min-h-[100px] rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Welcome to the best trading platform..."
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-200">Dashboard Marketing Content</h4>
                    <p className="text-xs text-zinc-500">This controls the Dashboard body text shown to your site visitors.</p>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Kicker</label>
                      <Input
                        type="text"
                        value={String(formData.hero_content?.kicker || '')}
                        onChange={(e) => updateHeroField('kicker', e.target.value)}
                        placeholder="GAITED1"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Headline</label>
                      <Input
                        type="text"
                        value={String(formData.hero_content?.title || '')}
                        onChange={(e) => updateHeroField('title', e.target.value)}
                        placeholder="Trade with discipline. Scale with clarity."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Subtext</label>
                      <textarea
                        value={String(formData.hero_content?.subtitle || '')}
                        onChange={(e) => updateHeroField('subtitle', e.target.value)}
                        className="w-full min-h-[88px] rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
                        placeholder="Guide your clients with focused trading psychology messaging."
                      />
                    </div>

                    {dashboardFeatures.map((feature, index) => (
                      <div key={`feature-${index}`} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs text-zinc-400">Feature {index + 1} title</label>
                          <Input
                            type="text"
                            value={String(feature?.title || '')}
                            onChange={(e) => updateDashboardFeature(index, 'title', e.target.value)}
                            placeholder={index === 0 ? 'Psychology' : index === 1 ? 'Execution' : 'Consistency'}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-zinc-400">Feature {index + 1} description</label>
                          <Input
                            type="text"
                            value={String(feature?.description || '')}
                            onChange={(e) => updateDashboardFeature(index, 'description', e.target.value)}
                            placeholder="Short message for this feature card"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Logo URL</label>
                    <Input
                      type="url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-zinc-800 shrink-0">
                          <input
                            type="color"
                            value={formData.primary_color}
                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                          />
                        </div>
                        <Input
                          type="text"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="font-mono uppercase"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-zinc-800 shrink-0">
                          <input
                            type="color"
                            value={formData.secondary_color}
                            onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                          />
                        </div>
                        <Input
                          type="text"
                          value={formData.secondary_color}
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                          className="font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-200">Advanced Configuration</h4>
                    <p className="text-xs text-zinc-500 mb-2">Configure modules, navigation, and content (JSON format)</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-zinc-400">Enabled Modules</label>
                        <Input 
                          placeholder="e.g. ['trading', 'bots', 'analysis']" 
                          value={JSON.stringify(formData.enabled_modules)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, enabled_modules: JSON.parse(e.target.value) }); } catch(err) {}
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400">Navigation Items</label>
                        <Input 
                          placeholder='e.g. [{"label": "Home", "url": "/"}]'
                          value={JSON.stringify(formData.navigation_items)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, navigation_items: JSON.parse(e.target.value) }); } catch(err) {}
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400">Hero Content</label>
                        <Input 
                          placeholder='e.g. {"title": "Welcome", "subtitle": "..."}'
                          value={JSON.stringify(formData.hero_content)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, hero_content: JSON.parse(e.target.value) }); } catch(err) {}
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400">CTA Content</label>
                        <Input 
                          placeholder='e.g. {"text": "Join Now", "url": "/signup"}'
                          value={JSON.stringify(formData.cta_content)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, cta_content: JSON.parse(e.target.value) }); } catch(err) {}
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400">Support & Social Links</label>
                        <Input 
                          placeholder='e.g. {"twitter": "...", "support_email": "..."}'
                          value={JSON.stringify(formData.support_social_links)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, support_social_links: JSON.parse(e.target.value) }); } catch(err) {}
                          }}
                        />
                      </div>

                      <div className="pt-2 border-t border-zinc-800/70">
                        <label className="text-xs text-zinc-300 font-medium">Commission Split (Platform / Client)</label>
                        <p className="text-xs text-zinc-500 mt-1">Default model: total commission is 3% with 20% platform share and 80% client share.</p>
                        <div className="mt-3">
                          <label className="text-xs text-zinc-400">Total Commission %</label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={formData.total_commission_pct}
                            onChange={(e) => handleTotalCommissionChange(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-xs text-zinc-400">Platform %</label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={formData.platform_commission_pct}
                              onChange={(e) => handlePlatformCommissionChange(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-zinc-400">Client %</label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={formData.client_commission_pct}
                              onChange={(e) => handleClientCommissionChange(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          Effective split: Platform {(formData.total_commission_pct * formData.platform_commission_pct / 100).toFixed(2)}% | Client {(formData.total_commission_pct * formData.client_commission_pct / 100).toFixed(2)}%
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          <div>
                            <label className="text-xs text-zinc-400">Payout Model</label>
                            <select
                              value={formData.payout_model}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  payout_model: e.target.value as 'platform_collects_and_pays_clients' | 'deriv_direct_split_if_supported',
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 transition-colors appearance-none"
                            >
                              <option value="platform_collects_and_pays_clients">Platform collects and pays clients</option>
                              <option value="deriv_direct_split_if_supported">Deriv direct split (if supported)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-zinc-400">Payout Cycle</label>
                            <select
                              value={formData.payout_cycle}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  payout_cycle: e.target.value as 'weekly' | 'monthly',
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 transition-colors appearance-none"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="text-xs text-zinc-400">Payout Minimum (USD)</label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={formData.payout_minimum}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                payout_minimum: Number.isFinite(Number(e.target.value)) ? Math.max(0, Number(e.target.value)) : 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <ToolConfigurator
                      enabledTools={enabledTools}
                      onToggleTool={handleToggleTool}
                      onMoveTool={handleMoveTool}
                    />
                  </div>
                  
                  <Button
                    onClick={handleSaveConfig}
                    isLoading={saving}
                    className="gap-2 mt-4"
                  >
                    <Save className="w-4 h-4" />
                    Save Settings
                  </Button>
                </div>
              </div>

              {/* Live Preview Panel */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-zinc-50">Live Preview</h3>
                <div 
                  className="rounded-xl overflow-hidden border border-zinc-800 flex flex-col h-[400px] transition-colors duration-300"
                  style={{ backgroundColor: formData.secondary_color }}
                >
                  {/* Mock Browser Header */}
                  <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                      <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                      <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                    </div>
                    <div className="mx-auto bg-zinc-950 rounded-md px-3 py-1 text-xs text-zinc-500 font-mono w-1/2 text-center truncate">
                      {domain?.domain || 'your-site.com'}
                    </div>
                  </div>
                  
                  {/* Mock Site Content */}
                  <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div 
                      className="p-4 flex items-center gap-3 transition-colors duration-300"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      {formData.logo_url ? (
                        <img 
                          src={formData.logo_url} 
                          alt="Logo" 
                          className="h-8 w-auto object-contain" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 bg-white/20 rounded-md"></div>
                      )}
                      <span className="font-bold text-white text-lg">
                        {formData.site_title || site.name}
                      </span>
                    </div>

                    {/* Tool Navigation Preview */}
                    <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/70">
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {enabledTools.length > 0 ? (
                          enabledTools.map((toolId, index) => {
                            const tool = TOOL_DEFINITIONS.find((entry) => entry.id === toolId);
                            if (!tool) return null;

                            return (
                              <div
                                key={tool.id}
                                className={cn(
                                  'px-2.5 py-1 rounded-md text-xs whitespace-nowrap border',
                                  index === 0
                                    ? 'text-zinc-50 border-zinc-600'
                                    : 'text-zinc-400 border-zinc-800'
                                )}
                                style={index === 0 ? { backgroundColor: `${formData.primary_color}33` } : {}}
                              >
                                {tool.label}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-zinc-500 px-1 py-1">No tools enabled</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Hero */}
                    <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
                      <h1 
                        className="text-3xl font-bold mb-4 transition-colors duration-300"
                        style={{ color: formData.primary_color }}
                      >
                        {formData.site_title || site.name}
                      </h1>
                      <p className="text-zinc-600 max-w-sm">
                        {formData.description || 'Welcome to our platform. We provide the best tools for your success.'}
                      </p>
                      <button 
                        className="mt-6 px-6 py-2 rounded-md font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: formData.primary_color }}
                      >
                        Get Started
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trading' && (
            <TradingSettings />
          )}

          {activeTab === 'bots' && (
            <BotSettings />
          )}

          {activeTab === 'domain' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-zinc-50">Custom Domain</h3>
                <p className="text-sm text-zinc-400 max-w-xl">
                  Connect a custom domain to your site. After saving, configure your DNS settings to point to our servers.
                </p>
              </div>
              
              <div className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-200">
                    Domain Name
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-medium">https://</span>
                    <Input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="www.example.com"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleSaveDomain}
                  disabled={!domainInput}
                  isLoading={saving}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Domain
                </Button>

                {domain && !domain.verified && (
                  <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <h4 className="text-amber-500 font-semibold text-sm mb-2">DNS Configuration Required</h4>
                    <p className="text-sm text-zinc-400 mb-4">
                      Please add the following A record to your domain's DNS settings:
                    </p>
                    <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800 font-mono text-sm flex flex-col sm:flex-row sm:justify-between gap-2 text-zinc-300">
                      <span>Type: <strong className="text-zinc-100">A</strong></span>
                      <span>Name: <strong className="text-zinc-100">@</strong></span>
                      <span>Value: <strong className="text-zinc-100">76.76.21.21</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


