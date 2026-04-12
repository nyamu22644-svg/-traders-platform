import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save, Eye, Globe } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { siteService } from '../services/siteService';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { TradingSettings } from '../components/site/TradingSettings';
import { BotSettings } from '../components/site/BotSettings';

type Tab = 'overview' | 'builder' | 'trading' | 'bots' | 'domain';

export default function SiteDetail() {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { site, domain, config, setSite, setDomain, setConfig } = useSiteContext();
  
  const [saving, setSaving] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  
  const [siteType, setSiteType] = useState<string>('');
  
  const [formData, setFormData] = useState({
    site_title: '',
    description: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    logo_url: '',
    enabled_modules: [] as string[],
    enabled_tools: ['dashboard', 'bot_builder', 'fast_trader'] as string[],
    layout_style: 'default',
    navigation_items: [] as any[],
    hero_content: {} as any,
    cta_content: {} as any,
    support_social_links: {} as any
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
        enabled_tools: config.enabled_tools || ['dashboard', 'bot_builder', 'fast_trader'],
        layout_style: config.layout_style || 'default',
        navigation_items: config.navigation_items || [],
        hero_content: config.hero_content || {},
        cta_content: config.cta_content || {},
        support_social_links: config.support_social_links || {}
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
                        <label className="text-xs text-zinc-400">Enabled Tools</label>
                        <Input 
                          placeholder='e.g. ["dashboard", "bot_builder", "fast_trader"]' 
                          value={JSON.stringify(formData.enabled_tools)}
                          onChange={(e) => {
                            try { setFormData({ ...formData, enabled_tools: JSON.parse(e.target.value) }); } catch(err) {}
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
                    </div>
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


