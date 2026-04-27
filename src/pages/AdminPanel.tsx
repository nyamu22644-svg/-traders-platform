import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Users, Globe, HandCoins, RefreshCw, Building2, Coins, ReceiptText, MapPin, Settings2, Truck } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { DomainPricingRule, supabase } from '../lib/supabase';
import { CommissionIngestEventInput, siteService } from '../services/siteService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

interface AdminUserRow {
  id: string;
  email: string;
  role: 'user' | 'admin';
  deriv_loginid: string | null;
  created_at: string;
}

interface AdminSiteRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
}

interface AdminPayoutRow {
  id: string;
  site_id: string;
  client_loginid: string | null;
  currency: string;
  total_client_amount: number;
  total_platform_amount: number;
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AdminDerivAttributionRow {
  id: string;
  user_id: string;
  site_id: string;
  client_loginid: string;
  referral_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

interface AdminPayoutDestinationRow {
  id: string;
  site_id: string;
  client_loginid: string;
  payout_method: 'manual' | 'crypto_wallet' | 'bank_account' | 'mobile_money';
  destination_label: string | null;
  destination_value: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdminDomainOrderRow {
  id: string;
  site_id: string;
  domain_name: string;
  provider: 'namecheap' | 'namecheap_affiliate' | 'porkbun';
  years: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payment_provider: 'mpesa' | 'paystack' | 'flutterwave' | 'manual' | null;
  payment_reference: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status:
    | 'pending_payment'
    | 'payment_confirmed'
    | 'registering'
    | 'dns_configuring'
    | 'vercel_linking'
    | 'verifying'
    | 'completed'
    | 'failed'
    | 'refunded';
  currency: string;
  payment_amount: number | null;
  platform_margin: number | null;
  last_error: string | null;
  created_at: string;
}

interface PricingRuleFormState {
  tld: string;
  currency: string;
  base_price: string;
  markup_type: 'flat' | 'percent';
  markup_value: string;
  service_fee: string;
  final_price_override: string;
  is_active: boolean;
  notes: string;
}

const EMPTY_PRICING_RULE_FORM: PricingRuleFormState = {
  tld: 'com',
  currency: 'USD',
  base_price: '11.99',
  markup_type: 'flat',
  markup_value: '3.00',
  service_fee: '0',
  final_price_override: '',
  is_active: true,
  notes: '',
};

const DEFAULT_COMMISSION_INGEST_JSON = JSON.stringify([
  {
    client_loginid: 'CR123456',
    trade_reference: 'trade-001',
    currency: 'USD',
    gross_commission: 1.25,
    status: 'confirmed',
  },
], null, 2);

function formatCurrency(value: number, currency = 'USD') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function paymentStatusVariant(status: AdminDomainOrderRow['payment_status']) {
  switch (status) {
    case 'paid':
      return 'success' as const;
    case 'pending':
      return 'warning' as const;
    case 'failed':
    case 'refunded':
      return 'danger' as const;
    default:
      return 'outline' as const;
  }
}

function orderStatusVariant(status: AdminDomainOrderRow['order_status']) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
    case 'refunded':
      return 'danger' as const;
    case 'pending_payment':
    case 'payment_confirmed':
    case 'registering':
    case 'dns_configuring':
    case 'vercel_linking':
    case 'verifying':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

function providerLabel(provider: AdminDomainOrderRow['provider']) {
  switch (provider) {
    case 'namecheap_affiliate':
      return 'Namecheap Affiliate';
    case 'porkbun':
      return 'Porkbun';
    case 'namecheap':
      return 'Namecheap API';
    default:
      return provider;
  }
}

function formatDestination(row: AdminPayoutDestinationRow | undefined) {
  if (!row) return '-';
  const label = String(row.destination_label || '').trim();
  const value = String(row.destination_value || '').trim();
  if (label && value) return `${label}: ${value}`;
  return label || value || row.payout_method;
}

type AdminTab = 'overview' | 'clients' | 'payouts' | 'commissions' | 'attributions' | 'destinations' | 'pricing' | 'orders';

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'payouts', label: 'Payout Queue', icon: HandCoins },
  { id: 'commissions', label: 'Commission Import', icon: ReceiptText },
  { id: 'attributions', label: 'Attribution Map', icon: MapPin },
  { id: 'destinations', label: 'Payout Destinations', icon: Coins },
  { id: 'pricing', label: 'Domain Pricing', icon: Settings2 },
  { id: 'orders', label: 'Domain Orders', icon: Truck },
];

export default function AdminPanel() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [savingPayoutId, setSavingPayoutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [sites, setSites] = useState<AdminSiteRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [attributions, setAttributions] = useState<AdminDerivAttributionRow[]>([]);
  const [payoutDestinations, setPayoutDestinations] = useState<AdminPayoutDestinationRow[]>([]);
  const [domainOrders, setDomainOrders] = useState<AdminDomainOrderRow[]>([]);
  const [pricingRules, setPricingRules] = useState<DomainPricingRule[]>([]);
  const [editingPricingRuleId, setEditingPricingRuleId] = useState<string | null>(null);
  const [pricingForm, setPricingForm] = useState<PricingRuleFormState>(EMPTY_PRICING_RULE_FORM);
  const [savingPricingRule, setSavingPricingRule] = useState(false);
  const [deletingPricingRuleId, setDeletingPricingRuleId] = useState<string | null>(null);
  const [capturingPaymentRef, setCapturingPaymentRef] = useState<string | null>(null);
  const [processingDomainOrderId, setProcessingDomainOrderId] = useState<string | null>(null);
  const [savingDestination, setSavingDestination] = useState(false);
  const [deletingDestinationId, setDeletingDestinationId] = useState<string | null>(null);
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [destinationForm, setDestinationForm] = useState({
    site_id: '',
    client_loginid: '',
    payout_method: 'manual' as AdminPayoutDestinationRow['payout_method'],
    destination_label: '',
    destination_value: '',
    notes: '',
    is_active: true,
  });
  const [ingestingCommissions, setIngestingCommissions] = useState(false);
  const [ingestDryRun, setIngestDryRun] = useState(true);
  const [ingestSiteId, setIngestSiteId] = useState('');
  const [ingestJson, setIngestJson] = useState(DEFAULT_COMMISSION_INGEST_JSON);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, sitesRes, payoutsRes, attributionsRes, destinationsRes, domainOrdersRes, pricingRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, role, deriv_loginid, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('sites')
          .select('id, user_id, name, type, status, created_at')
          .order('created_at', { ascending: false })
          .limit(400),
        supabase
          .from('commission_payouts')
          .select('id, site_id, client_loginid, currency, total_client_amount, total_platform_amount, status, period_start, period_end, paid_at, created_at')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('deriv_client_attributions')
          .select('id, user_id, site_id, client_loginid, referral_code, utm_source, utm_medium, utm_campaign, source, is_active, last_seen_at, created_at')
          .order('last_seen_at', { ascending: false })
          .limit(500),
        supabase
          .from('client_payout_destinations')
          .select('id, site_id, client_loginid, payout_method, destination_label, destination_value, notes, is_active, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('domain_purchase_requests')
          .select('id, site_id, domain_name, provider, years, status, payment_provider, payment_reference, payment_status, order_status, currency, payment_amount, platform_margin, last_error, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('domain_pricing_rules')
          .select('*')
          .order('tld', { ascending: true })
          .limit(200),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (payoutsRes.error) throw payoutsRes.error;
      if (attributionsRes.error && attributionsRes.error.code !== '42P01') throw attributionsRes.error;
      if (destinationsRes.error && destinationsRes.error.code !== '42P01') throw destinationsRes.error;
      if (domainOrdersRes.error && domainOrdersRes.error.code !== '42P01') throw domainOrdersRes.error;
      if (pricingRes.error && pricingRes.error.code !== '42P01') throw pricingRes.error;

      setUsers((usersRes.data || []) as AdminUserRow[]);
      setSites((sitesRes.data || []) as AdminSiteRow[]);
      setPayouts((payoutsRes.data || []) as AdminPayoutRow[]);
      setAttributions(attributionsRes.error?.code === '42P01' ? [] : ((attributionsRes.data || []) as AdminDerivAttributionRow[]));
      setPayoutDestinations(destinationsRes.error?.code === '42P01' ? [] : ((destinationsRes.data || []) as AdminPayoutDestinationRow[]));
      setDomainOrders(domainOrdersRes.error?.code === '42P01' ? [] : ((domainOrdersRes.data || []) as AdminDomainOrderRow[]));
      setPricingRules(pricingRes.error?.code === '42P01' ? [] : ((pricingRes.data || []) as DomainPricingRule[]));
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    loadAdminData();
  }, [profile?.role]);

  const userById = useMemo(() => {
    const map = new Map<string, AdminUserRow>();
    users.forEach((row) => map.set(row.id, row));
    return map;
  }, [users]);

  const siteById = useMemo(() => {
    const map = new Map<string, AdminSiteRow>();
    sites.forEach((row) => map.set(row.id, row));
    return map;
  }, [sites]);

  const destinationBySiteAndLogin = useMemo(() => {
    const map = new Map<string, AdminPayoutDestinationRow>();
    payoutDestinations.forEach((row) => {
      const key = `${row.site_id}:${String(row.client_loginid || '').trim().toUpperCase()}`;
      map.set(key, row);
    });
    return map;
  }, [payoutDestinations]);

  const clients = useMemo(() => users.filter((u) => u.role === 'user'), [users]);

  const pendingPayouts = useMemo(
    () => payouts.filter((p) => p.status === 'scheduled' || p.status === 'processing'),
    [payouts]
  );

  const totalClientLiability = useMemo(
    () => pendingPayouts.reduce((acc, p) => acc + Number(p.total_client_amount || 0), 0),
    [pendingPayouts]
  );

  const porkbunOrderCount = useMemo(
    () => domainOrders.filter((order) => order.provider === 'porkbun').length,
    [domainOrders]
  );

  const affiliateOrderCount = useMemo(
    () => domainOrders.filter((order) => order.provider === 'namecheap_affiliate').length,
    [domainOrders]
  );

  const pendingAffiliatePayments = useMemo(
    () => domainOrders.filter((order) => order.provider === 'namecheap_affiliate' && order.payment_status === 'pending').length,
    [domainOrders]
  );

  const resetDestinationForm = () => {
    setEditingDestinationId(null);
    setDestinationForm({
      site_id: '',
      client_loginid: '',
      payout_method: 'manual',
      destination_label: '',
      destination_value: '',
      notes: '',
      is_active: true,
    });
  };

  const handleEditDestination = (row: AdminPayoutDestinationRow) => {
    setEditingDestinationId(row.id);
    setDestinationForm({
      site_id: row.site_id,
      client_loginid: row.client_loginid,
      payout_method: row.payout_method,
      destination_label: row.destination_label || '',
      destination_value: row.destination_value || '',
      notes: row.notes || '',
      is_active: row.is_active,
    });
  };

  const handleSaveDestination = async () => {
    const siteId = destinationForm.site_id.trim();
    const clientLoginId = destinationForm.client_loginid.trim();

    if (!siteId || !clientLoginId) {
      setError('Site and client login ID are required for payout destination.');
      return;
    }

    setSavingDestination(true);
    setError(null);

    try {
      const { error: saveError } = await supabase
        .from('client_payout_destinations')
        .upsert([
          {
            id: editingDestinationId || undefined,
            site_id: siteId,
            client_loginid: clientLoginId,
            payout_method: destinationForm.payout_method,
            destination_label: destinationForm.destination_label.trim() || null,
            destination_value: destinationForm.destination_value.trim() || null,
            notes: destinationForm.notes.trim() || null,
            is_active: destinationForm.is_active,
          },
        ], {
          onConflict: 'site_id,client_loginid',
        });

      if (saveError) throw saveError;

      resetDestinationForm();
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save payout destination.');
    } finally {
      setSavingDestination(false);
    }
  };

  const handleDeleteDestination = async (destinationId: string) => {
    setDeletingDestinationId(destinationId);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('client_payout_destinations')
        .delete()
        .eq('id', destinationId);

      if (deleteError) throw deleteError;

      if (editingDestinationId === destinationId) {
        resetDestinationForm();
      }

      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete payout destination.');
    } finally {
      setDeletingDestinationId(null);
    }
  };

  const handleCommissionIngest = async () => {
    setIngestingCommissions(true);
    setError(null);
    setIngestResult(null);

    try {
      const parsed = JSON.parse(ingestJson);
      const events = (Array.isArray(parsed) ? parsed : [parsed]) as CommissionIngestEventInput[];
      if (!events.length) {
        throw new Error('At least one commission event is required.');
      }

      const payload = await siteService.ingestCommissionEvents({
        events,
        siteId: ingestSiteId.trim() || undefined,
        dryRun: ingestDryRun,
      });

      const summary = `Processed: ${payload?.processed ?? 0}, Failed: ${payload?.failed ?? 0}, Dry run: ${payload?.dryRun ? 'yes' : 'no'}`;
      setIngestResult(summary);
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to ingest commission events.');
    } finally {
      setIngestingCommissions(false);
    }
  };

  const pricingPreview = useMemo(() => {
    const basePrice = Number(pricingForm.base_price || 0);
    const markupValue = Number(pricingForm.markup_value || 0);
    const serviceFee = Number(pricingForm.service_fee || 0);
    const override = pricingForm.final_price_override.trim() ? Number(pricingForm.final_price_override) : null;

    if (override != null && Number.isFinite(override)) {
      return override;
    }

    if (pricingForm.markup_type === 'percent') {
      return basePrice + (basePrice * markupValue) / 100 + serviceFee;
    }

    return basePrice + markupValue + serviceFee;
  }, [pricingForm]);

  const handlePayoutStatus = async (
    payoutId: string,
    status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled'
  ) => {
    setSavingPayoutId(payoutId);
    try {
      const updates: Partial<AdminPayoutRow> & { paid_at?: string | null } = { status };
      updates.paid_at = status === 'paid' ? new Date().toISOString() : null;

      const { error: updateError } = await supabase
        .from('commission_payouts')
        .update(updates)
        .eq('id', payoutId);

      if (updateError) throw updateError;

      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update payout status.');
    } finally {
      setSavingPayoutId(null);
    }
  };

  const handlePricingFormChange = <K extends keyof PricingRuleFormState>(key: K, value: PricingRuleFormState[K]) => {
    setPricingForm((current) => ({ ...current, [key]: value }));
  };

  const handleEditPricingRule = (rule: DomainPricingRule) => {
    setEditingPricingRuleId(rule.id);
    setPricingForm({
      tld: rule.tld,
      currency: rule.currency,
      base_price: rule.base_price == null ? '' : String(rule.base_price),
      markup_type: rule.markup_type,
      markup_value: String(rule.markup_value),
      service_fee: String(rule.service_fee),
      final_price_override: rule.final_price_override == null ? '' : String(rule.final_price_override),
      is_active: rule.is_active,
      notes: rule.notes || '',
    });
  };

  const resetPricingForm = () => {
    setEditingPricingRuleId(null);
    setPricingForm(EMPTY_PRICING_RULE_FORM);
  };

  const parseOptionalNumber = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSavePricingRule = async () => {
    setSavingPricingRule(true);
    setError(null);

    try {
      const tld = pricingForm.tld.trim().toLowerCase().replace(/^\./, '');
      if (!tld) {
        throw new Error('TLD is required (example: com).');
      }

      const basePrice = parseOptionalNumber(pricingForm.base_price);
      const markupValue = Number(pricingForm.markup_value);
      const serviceFee = Number(pricingForm.service_fee);
      const override = parseOptionalNumber(pricingForm.final_price_override);

      if (!Number.isFinite(markupValue) || !Number.isFinite(serviceFee)) {
        throw new Error('Markup value and service fee must be valid numbers.');
      }

      await siteService.upsertDomainPricingRule({
        id: editingPricingRuleId || undefined,
        tld,
        currency: pricingForm.currency.trim().toUpperCase() || 'USD',
        base_price: basePrice,
        markup_type: pricingForm.markup_type,
        markup_value: markupValue,
        service_fee: serviceFee,
        final_price_override: override,
        is_active: pricingForm.is_active,
        notes: pricingForm.notes.trim() || null,
      });

      resetPricingForm();
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pricing rule.');
    } finally {
      setSavingPricingRule(false);
    }
  };

  const handleDeletePricingRule = async (ruleId: string) => {
    setDeletingPricingRuleId(ruleId);
    setError(null);

    try {
      await siteService.deleteDomainPricingRule(ruleId);
      if (editingPricingRuleId === ruleId) {
        resetPricingForm();
      }
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete pricing rule.');
    } finally {
      setDeletingPricingRuleId(null);
    }
  };

  const handleCaptureOrderPayment = async (order: AdminDomainOrderRow, status: 'paid' | 'failed' | 'refunded' = 'paid') => {
    if (!order.payment_reference) {
      setError('This order has no payment reference to update.');
      return;
    }

    setCapturingPaymentRef(order.payment_reference);
    setError(null);

    try {
      await siteService.captureDomainOrderPayment(order.payment_reference, status);
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update domain order payment status.');
    } finally {
      setCapturingPaymentRef(null);
    }
  };

  const handleProcessDomainOrder = async (orderId: string) => {
    setProcessingDomainOrderId(orderId);
    setError(null);

    try {
      await siteService.processDomainOrder(orderId);
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to process domain order.');
    } finally {
      setProcessingDomainOrderId(null);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="w-7 h-7 text-zinc-500" />
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
            Owner Admin Panel
          </h1>
          <p className="text-zinc-400 mt-1">Manage clients, client sites, commissions, and payout approvals.</p>
        </div>
        <Button variant="secondary" className="gap-2" onClick={loadAdminData} isLoading={loading}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-100'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {(activeTab === 'overview' || activeTab === 'clients' || activeTab === 'payouts') && (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Client Sites</CardTitle>
            <Globe className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{sites.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Pending Payouts</CardTitle>
            <HandCoins className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{pendingPayouts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Client Liability</CardTitle>
            <HandCoins className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{formatCurrency(totalClientLiability)}</div>
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Porkbun Orders</CardTitle>
            <Globe className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{porkbunOrderCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Namecheap Affiliate Orders</CardTitle>
            <Globe className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{affiliateOrderCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Pending Affiliate Payments</CardTitle>
            <HandCoins className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{pendingAffiliatePayments}</div>
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'clients' && (
      <Card>
        <CardHeader>
          <CardTitle>Client Accounts</CardTitle>
          <CardDescription>All clients registered on your TradeSaaS platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-sm text-zinc-500">No client accounts found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Sites</th>
                    <th className="py-2 pr-3">Deriv Login ID</th>
                    <th className="py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const siteCount = sites.filter((site) => site.user_id === client.id).length;

                    return (
                      <tr key={client.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                        <td className="py-2 pr-3">{client.email}</td>
                        <td className="py-2 pr-3">{siteCount}</td>
                        <td className="py-2 pr-3">{client.deriv_loginid || '-'}</td>
                        <td className="py-2">{new Date(client.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'payouts' && (
      <Card>
        <CardHeader>
          <CardTitle>Payout Queue</CardTitle>
          <CardDescription>Approve and mark client settlements from your master commission pool.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-sm text-zinc-500">No payout records found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Payout Destination</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.slice(0, 50).map((payout) => {
                    const site = siteById.get(payout.site_id);
                    const owner = site ? userById.get(site.user_id) : null;
                    const destinationKey = `${payout.site_id}:${String(payout.client_loginid || '').trim().toUpperCase()}`;
                    const payoutDestination = destinationBySiteAndLogin.get(destinationKey);
                    const period =
                      payout.period_start && payout.period_end
                        ? `${payout.period_start} to ${payout.period_end}`
                        : '-';

                    return (
                      <tr key={payout.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0 align-top">
                        <td className="py-2 pr-3">{owner?.email || 'Unknown client'}</td>
                        <td className="py-2 pr-3">{site?.name || 'Unknown site'}</td>
                        <td className="py-2 pr-3">{period}</td>
                        <td className="py-2 pr-3">{formatCurrency(payout.total_client_amount, payout.currency)}</td>
                        <td className="py-2 pr-3">{formatDestination(payoutDestination)}</td>
                        <td className="py-2 pr-3 capitalize">{payout.status}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingPayoutId === payout.id || payout.status === 'processing'}
                              onClick={() => handlePayoutStatus(payout.id, 'processing')}
                            >
                              Processing
                            </Button>
                            <Button
                              size="sm"
                              disabled={savingPayoutId === payout.id || payout.status === 'paid'}
                              onClick={() => handlePayoutStatus(payout.id, 'paid')}
                            >
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={savingPayoutId === payout.id || payout.status === 'failed'}
                              onClick={() => handlePayoutStatus(payout.id, 'failed')}
                            >
                              Mark Failed
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'commissions' && (
      <Card>
        <CardHeader>
          <CardTitle>Commission Import</CardTitle>
          <CardDescription>
            Import partner commission events as JSON. Use dry run first to validate site mapping before writing records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Default Site</label>
              <select
                value={ingestSiteId}
                onChange={(event) => setIngestSiteId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="">Auto-resolve from attribution map</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Dry Run</label>
              <select
                value={ingestDryRun ? 'true' : 'false'}
                onChange={(event) => setIngestDryRun(event.target.value === 'true')}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="true">Yes (validate only)</option>
                <option value="false">No (write to DB)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-zinc-400">Commission Events JSON</label>
            <textarea
              value={ingestJson}
              onChange={(event) => setIngestJson(event.target.value)}
              rows={10}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500 focus:ring-2"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCommissionIngest} isLoading={ingestingCommissions}>
              {ingestDryRun ? 'Validate Import' : 'Import Commissions'}
            </Button>
            <Button variant="outline" onClick={() => setIngestJson(DEFAULT_COMMISSION_INGEST_JSON)}>
              Reset Example
            </Button>
          </div>

          {ingestResult ? (
            <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
              {ingestResult}
            </div>
          ) : null}
        </CardContent>
      </Card>
      )}

      {activeTab === 'attributions' && (
      <Card>
        <CardHeader>
          <CardTitle>Deriv Attribution Map</CardTitle>
          <CardDescription>
            Tracks which client login ID is attributed to which site for commission resolution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : attributions.length === 0 ? (
            <div className="text-sm text-zinc-500">No attribution links yet. The first Deriv OAuth sign-in per site will create them.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Client Login</th>
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Referral</th>
                    <th className="py-2 pr-3">UTM</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {attributions.slice(0, 100).map((row) => {
                    const site = siteById.get(row.site_id);
                    const utm = [row.utm_source, row.utm_medium, row.utm_campaign]
                      .filter(Boolean)
                      .join(' / ');

                    return (
                      <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                        <td className="py-2 pr-3">{row.client_loginid}</td>
                        <td className="py-2 pr-3">{site?.name || row.site_id}</td>
                        <td className="py-2 pr-3">{row.referral_code || '-'}</td>
                        <td className="py-2 pr-3">{utm || '-'}</td>
                        <td className="py-2 pr-3">{row.source || '-'}</td>
                        <td className="py-2">{new Date(row.last_seen_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'destinations' && (
      <Card>
        <CardHeader>
          <CardTitle>Payout Destinations</CardTitle>
          <CardDescription>
            Save where each site/client payout should be sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Site</label>
              <select
                value={destinationForm.site_id}
                onChange={(event) => setDestinationForm((current) => ({ ...current, site_id: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Client Login ID</label>
              <Input
                value={destinationForm.client_loginid}
                onChange={(event) => setDestinationForm((current) => ({ ...current, client_loginid: event.target.value }))}
                placeholder="CR123456"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Payout Method</label>
              <select
                value={destinationForm.payout_method}
                onChange={(event) => setDestinationForm((current) => ({ ...current, payout_method: event.target.value as AdminPayoutDestinationRow['payout_method'] }))}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="manual">Manual</option>
                <option value="crypto_wallet">Crypto Wallet</option>
                <option value="bank_account">Bank Account</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Status</label>
              <select
                value={destinationForm.is_active ? 'true' : 'false'}
                onChange={(event) => setDestinationForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Label</label>
              <Input
                value={destinationForm.destination_label}
                onChange={(event) => setDestinationForm((current) => ({ ...current, destination_label: event.target.value }))}
                placeholder="USDT Wallet"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Destination Value</label>
              <Input
                value={destinationForm.destination_value}
                onChange={(event) => setDestinationForm((current) => ({ ...current, destination_value: event.target.value }))}
                placeholder="Wallet address / account number / phone"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Notes</label>
              <Input
                value={destinationForm.notes}
                onChange={(event) => setDestinationForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional payout instructions"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveDestination} isLoading={savingDestination}>
              {editingDestinationId ? 'Update Destination' : 'Create Destination'}
            </Button>
            {editingDestinationId && (
              <Button variant="outline" onClick={resetDestinationForm}>
                Cancel Edit
              </Button>
            )}
          </div>

          {payoutDestinations.length === 0 ? (
            <div className="text-sm text-zinc-500">No payout destinations configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Client Login</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Destination</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutDestinations.slice(0, 100).map((row) => {
                    const site = siteById.get(row.site_id);

                    return (
                      <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                        <td className="py-2 pr-3">{site?.name || row.site_id}</td>
                        <td className="py-2 pr-3">{row.client_loginid}</td>
                        <td className="py-2 pr-3">{row.payout_method}</td>
                        <td className="py-2 pr-3">{formatDestination(row)}</td>
                        <td className="py-2 pr-3">{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditDestination(row)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteDestination(row.id)}
                              isLoading={deletingDestinationId === row.id}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'pricing' && (
      <Card>
        <CardHeader>
          <CardTitle>Domain Pricing Controls</CardTitle>
          <CardDescription>Set per-TLD pricing rules used by checkout and order processing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">TLD</label>
              <Input value={pricingForm.tld} onChange={(event) => handlePricingFormChange('tld', event.target.value)} placeholder="com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Currency</label>
              <Input value={pricingForm.currency} onChange={(event) => handlePricingFormChange('currency', event.target.value)} placeholder="USD" maxLength={5} />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Base Price</label>
              <Input type="number" step="0.01" value={pricingForm.base_price} onChange={(event) => handlePricingFormChange('base_price', event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Markup Type</label>
              <select
                value={pricingForm.markup_type}
                onChange={(event) => handlePricingFormChange('markup_type', event.target.value as 'flat' | 'percent')}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Markup Value</label>
              <Input type="number" step="0.01" value={pricingForm.markup_value} onChange={(event) => handlePricingFormChange('markup_value', event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Service Fee</label>
              <Input type="number" step="0.01" value={pricingForm.service_fee} onChange={(event) => handlePricingFormChange('service_fee', event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Final Override</label>
              <Input type="number" step="0.01" value={pricingForm.final_price_override} onChange={(event) => handlePricingFormChange('final_price_override', event.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-400">Active</label>
              <select
                value={pricingForm.is_active ? 'true' : 'false'}
                onChange={(event) => handlePricingFormChange('is_active', event.target.value === 'true')}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-zinc-400">Notes</label>
            <Input value={pricingForm.notes} onChange={(event) => handlePricingFormChange('notes', event.target.value)} placeholder="Optional internal notes" />
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
            Estimated unit sell price: <span className="text-zinc-100 font-medium">{formatCurrency(pricingPreview, pricingForm.currency.trim().toUpperCase() || 'USD')}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSavePricingRule} isLoading={savingPricingRule}>
              {editingPricingRuleId ? 'Update Rule' : 'Create Rule'}
            </Button>
            {editingPricingRuleId && (
              <Button variant="outline" onClick={resetPricingForm}>
                Cancel Edit
              </Button>
            )}
          </div>

          {pricingRules.length === 0 ? (
            <div className="text-sm text-zinc-500">No pricing rules found. Add one to override defaults.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">TLD</th>
                    <th className="py-2 pr-3">Currency</th>
                    <th className="py-2 pr-3">Markup</th>
                    <th className="py-2 pr-3">Fee</th>
                    <th className="py-2 pr-3">Override</th>
                    <th className="py-2 pr-3">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0">
                      <td className="py-2 pr-3">.{rule.tld}</td>
                      <td className="py-2 pr-3">{rule.currency}</td>
                      <td className="py-2 pr-3">{rule.markup_value} {rule.markup_type === 'percent' ? '%' : rule.currency}</td>
                      <td className="py-2 pr-3">{formatCurrency(rule.service_fee, rule.currency)}</td>
                      <td className="py-2 pr-3">{rule.final_price_override == null ? '-' : formatCurrency(rule.final_price_override, rule.currency)}</td>
                      <td className="py-2 pr-3">{rule.is_active ? 'Yes' : 'No'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditPricingRule(rule)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeletePricingRule(rule.id)}
                            isLoading={deletingPricingRuleId === rule.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'orders' && (
      <Card>
        <CardHeader>
          <CardTitle>Domain Orders Operations</CardTitle>
          <CardDescription>Manage both Namecheap affiliate and Porkbun orders across all client sites.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-zinc-500" />
            </div>
          ) : domainOrders.length === 0 ? (
            <div className="text-sm text-zinc-500">No domain orders found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Domain</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Payment</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domainOrders.slice(0, 120).map((order) => {
                    const site = siteById.get(order.site_id);
                    const owner = site ? userById.get(site.user_id) : null;
                    const canProcess = order.payment_status === 'paid' && !['completed', 'failed', 'refunded'].includes(order.order_status);

                    return (
                      <tr key={order.id} className="border-b border-zinc-900/80 text-zinc-200 last:border-0 align-top">
                        <td className="py-2 pr-3">{owner?.email || 'Unknown client'}</td>
                        <td className="py-2 pr-3">{site?.name || 'Unknown site'}</td>
                        <td className="py-2 pr-3">
                          <div>{order.domain_name}</div>
                          <div className="text-xs text-zinc-500">{order.years} year(s)</div>
                          {order.last_error && <div className="text-xs text-red-300 mt-1">{order.last_error}</div>}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{providerLabel(order.provider)}</Badge>
                        </td>
                        <td className="py-2 pr-3">{formatCurrency(Number(order.payment_amount || 0), order.currency)}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={paymentStatusVariant(order.payment_status)}>{order.payment_status}</Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={orderStatusVariant(order.order_status)}>{order.order_status.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            {order.payment_status === 'pending' && order.payment_reference && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCaptureOrderPayment(order, 'paid')}
                                isLoading={capturingPaymentRef === order.payment_reference}
                              >
                                Mark Paid
                              </Button>
                            )}

                            {order.payment_status === 'pending' && order.payment_reference && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleCaptureOrderPayment(order, 'failed')}
                                isLoading={capturingPaymentRef === order.payment_reference}
                              >
                                Mark Failed
                              </Button>
                            )}

                            {canProcess && (
                              <Button
                                size="sm"
                                onClick={() => handleProcessDomainOrder(order.id)}
                                isLoading={processingDomainOrderId === order.id}
                              >
                                Process
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
