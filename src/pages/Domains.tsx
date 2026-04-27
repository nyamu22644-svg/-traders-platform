import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Globe, Search, ShieldCheck, ShoppingCart, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSites } from '../hooks/useSites';
import { DomainPurchaseRequest } from '../lib/supabase';
import { DomainAvailabilityResult, DomainWithSite, siteService } from '../services/siteService';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';

function statusVariant(status: DomainWithSite['status']) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'pending_verification':
    case 'purchase_pending':
      return 'warning' as const;
    case 'failed':
      return 'danger' as const;
    default:
      return 'outline' as const;
  }
}

function requestStatusVariant(status: DomainPurchaseRequest['status']) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'pending':
    case 'processing':
      return 'warning' as const;
    case 'failed':
    case 'cancelled':
      return 'danger' as const;
    default:
      return 'outline' as const;
  }
}

function paymentStatusVariant(status: DomainPurchaseRequest['payment_status']) {
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

function orderStatusVariant(status: DomainPurchaseRequest['order_status']) {
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

function formatCurrency(value: number | null, currency = 'USD') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function getDomainRecommendation(
  option: DomainAvailabilityResult,
  allOptions: DomainAvailabilityResult[]
) {
  if (!option.available || option.checked === false) return null;

  const pricedAvailable = allOptions
    .filter((item) => item.available && item.pricing)
    .sort((a, b) => (a.pricing?.sellPrice || 0) - (b.pricing?.sellPrice || 0));

  if (pricedAvailable.length > 0 && pricedAvailable[0].domain === option.domain) {
    return { label: 'Best Value', variant: 'success' as const };
  }

  if (option.domain.endsWith('.com')) {
    return { label: 'Most Trusted', variant: 'outline' as const };
  }

  if (option.domain.endsWith('.ai') || option.domain.endsWith('.io') || option.domain.endsWith('.app')) {
    return { label: 'Brand Pick', variant: 'warning' as const };
  }

  return null;
}

function optionActionLabel(
  option: DomainAvailabilityResult,
  provider: 'namecheap_affiliate' | 'porkbun'
) {
  if (provider === 'porkbun') {
    if (option.checked === false) return 'Check Live';
    if (option.available && option.priceSource !== 'live') return 'Re-check Price';
    if (option.available) return 'Select';
    return 'Re-check';
  }

  return option.available ? 'Select' : 'Unavailable';
}

export default function Domains() {
  const { user } = useAuth();
  const { sites, loading: sitesLoading } = useSites();

  const [domains, setDomains] = useState<DomainWithSite[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<(DomainPurchaseRequest & { sites: { id: string; name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [connectSaving, setConnectSaving] = useState(false);

  const [buySiteId, setBuySiteId] = useState('');
  const [buyDomainInput, setBuyDomainInput] = useState('');
  const [buyYears, setBuyYears] = useState(1);
  const [domainProvider, setDomainProvider] = useState<'namecheap_affiliate' | 'porkbun'>('namecheap_affiliate');
  const [paymentProvider, setPaymentProvider] = useState<'mpesa' | 'paystack' | 'flutterwave' | 'manual'>('manual');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<DomainAvailabilityResult | null>(null);
  const [availabilityOptions, setAvailabilityOptions] = useState<DomainAvailabilityResult[]>([]);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [capturingPaymentReference, setCapturingPaymentReference] = useState<string | null>(null);
  const [checkingOptionDomain, setCheckingOptionDomain] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);
  const lastSuccessfulSearchKeyRef = useRef('');

  const [lastCheckout, setLastCheckout] = useState<{
    orderId: string;
    paymentReference: string;
    paymentProvider: string;
    provider: string;
    checkoutUrl: string | null;
  } | null>(null);

  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);

  const selectedDomain = useMemo(() => domains.find((item) => item.site_id === selectedSiteId), [domains, selectedSiteId]);
  const selectedBuySite = useMemo(() => sites.find((site) => site.id === buySiteId) || null, [sites, buySiteId]);
  const selectedAvailableOption = useMemo(
    () => availabilityOptions.find((item) => item.domain === availability?.domain && item.available) || null,
    [availabilityOptions, availability]
  );
  const modalPrimaryActionLabel = useMemo(() => {
    if (domainProvider === 'namecheap_affiliate') return 'Proceed to Affiliate Checkout';
    if (paymentProvider === 'manual') return 'Pay & Order Now';
    return 'Proceed to Payment Checkout';
  }, [domainProvider, paymentProvider]);

  useEffect(() => {
    if (!sitesLoading && sites.length > 0) {
      setSelectedSiteId((current) => current || sites[0].id);
      setBuySiteId((current) => current || sites[0].id);
    }
  }, [sites, sitesLoading]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [domainRows, requestRows] = await Promise.all([
        siteService.getMyDomains(),
        siteService.getMyDomainPurchaseRequests(),
      ]);

      setDomains(domainRows);
      setPurchaseRequests(requestRows as (DomainPurchaseRequest & { sites: { id: string; name: string } })[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load domain management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sitesLoading) {
      loadData();
    }
  }, [sitesLoading]);

  useEffect(() => {
    setAvailability(null);
    setAvailabilityOptions([]);
    setShowAvailabilityModal(false);
    setCheckingOptionDomain(null);
    lastSuccessfulSearchKeyRef.current = '';
  }, [buyYears, domainProvider]);

  const runDomainSearch = useCallback(
    async (query: string, silent = false) => {
      const trimmed = query.trim();
      if (!trimmed) return null;

      const searchKey = `${trimmed.toLowerCase()}|${buyYears}|${domainProvider}`;
      const requestId = ++searchRequestIdRef.current;

      try {
        const results = await siteService.searchDomainAvailabilityOptions(trimmed, buyYears, domainProvider);

        if (requestId !== searchRequestIdRef.current) {
          return null;
        }

        setAvailabilityOptions(results);
        setAvailability((current) => {
          if (current) {
            const stillPresent = results.find((item) => item.domain === current.domain);
            if (stillPresent && stillPresent.available) return stillPresent;
          }

          return results.find((item) => item.available) || null;
        });

        lastSuccessfulSearchKeyRef.current = searchKey;
        return results;
      } catch (err: any) {
        if (requestId !== searchRequestIdRef.current) {
          return null;
        }

        if (!silent) {
          setAvailability(null);
          setAvailabilityOptions([]);
          setError(err?.message || 'Failed to check domain availability.');
        }

        return null;
      }
    },
    [buyYears, domainProvider]
  );

  useEffect(() => {
    if (domainProvider === 'porkbun') {
      return;
    }

    const query = buyDomainInput.trim();
    if (!query) {
      setAvailability(null);
      setAvailabilityOptions([]);
      return;
    }

    const timer = setTimeout(() => {
      const searchKey = `${query.toLowerCase()}|${buyYears}|${domainProvider}`;
      if (searchKey === lastSuccessfulSearchKeyRef.current) {
        return;
      }

      runDomainSearch(query, true);
    }, 450);

    return () => clearTimeout(timer);
  }, [buyDomainInput, buyYears, domainProvider, runDomainSearch]);

  const handleConnectDomain = async () => {
    if (!selectedSiteId || !domainInput.trim()) return;

    setConnectSaving(true);
    setError(null);

    try {
      await siteService.updateDomain(selectedSiteId, domainInput, selectedDomain?.id);
      setDomainInput('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not connect this domain.');
    } finally {
      setConnectSaving(false);
    }
  };

  const handleVerifyDomain = async (domain: DomainWithSite) => {
    setVerifyingDomainId(domain.id);
    setError(null);

    try {
      await siteService.verifyDomain(domain);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Domain verification failed.');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    setDeletingDomainId(domainId);
    setError(null);

    try {
      await siteService.deleteDomain(domainId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not remove this domain.');
    } finally {
      setDeletingDomainId(null);
    }
  };

  const handleCheckAvailability = async () => {
    if (!buyDomainInput.trim()) return;

    setChecking(true);
    setError(null);
    setShowAvailabilityModal(true);

    try {
      await runDomainSearch(buyDomainInput, false);
    } catch (err: any) {
      setAvailability(null);
      setAvailabilityOptions([]);
      setError(err?.message || 'Failed to check domain availability.');
    } finally {
      setChecking(false);
    }
  };

  const handleSelectAvailability = async (domainName: string) => {
    const selected = availabilityOptions.find((item) => item.domain === domainName) || null;
    if (!selected) return;

    if (domainProvider === 'porkbun' && (selected.checked === false || !selected.available)) {
      setCheckingOptionDomain(domainName);
      setError(null);

      try {
        const liveResult = await siteService.checkDomainAvailability(domainName, buyYears, domainProvider);
        const mergedResult = {
          ...liveResult,
          priceSource: liveResult.priceSource ?? selected.priceSource ?? null,
          providerPrice: liveResult.providerPrice ?? selected.providerPrice,
          pricing: liveResult.pricing ?? selected.pricing,
          message: liveResult.message || selected.message,
        };

        setAvailabilityOptions((current) =>
          current.map((item) => {
            if (item.domain !== domainName) return item;

            return mergedResult;
          })
        );

        if (mergedResult.available) {
          setAvailability(mergedResult);
          setBuyDomainInput(mergedResult.domain);
        }
      } catch (err: any) {
        setAvailabilityOptions((current) =>
          current.map((item) =>
            item.domain === domainName
              ? {
                  ...item,
                  checked: true,
                  available: false,
                  pricing: null,
                  providerPrice: null,
                  message: err?.message || 'Live check failed. Please try again shortly.',
                }
              : item
          )
        );
      } finally {
        setCheckingOptionDomain(null);
      }

      return;
    }

    if (!selected || !selected.available) return;

    setAvailability(selected);

    setBuyDomainInput(selected.domain);
  };

  const handleCreatePurchaseRequest = async () => {
    if (!availability?.available || !buySiteId || !user?.email) return;

    setRequesting(true);
    setError(null);

    try {
      const checkout = await siteService.createDomainPurchaseRequest({
        siteId: buySiteId,
        domainName: availability.domain,
        years: buyYears,
        registrantEmail: user.email,
        availabilitySnapshot: availability,
        provider: domainProvider,
        paymentProvider,
        autoCapture: domainProvider !== 'namecheap_affiliate' && paymentProvider === 'manual',
      });

      setLastCheckout({
        orderId: checkout.orderId,
        paymentReference: checkout.paymentReference,
        paymentProvider: checkout.paymentProvider,
        provider: checkout.provider,
        checkoutUrl: checkout.checkoutUrl,
      });

      await loadData();
      setAvailability(null);
      setAvailabilityOptions([]);
      setShowAvailabilityModal(false);
      lastSuccessfulSearchKeyRef.current = '';
      setBuyDomainInput('');
    } catch (err: any) {
      setError(err?.message || 'Could not create purchase request.');
    } finally {
      setRequesting(false);
    }
  };

  const handleProcessOrder = async (orderId: string) => {
    setProcessingOrderId(orderId);
    setError(null);

    try {
      await siteService.processDomainOrder(orderId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Order processing failed.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCaptureAffiliatePayment = async (paymentReference: string) => {
    setCapturingPaymentReference(paymentReference);
    setError(null);

    try {
      await siteService.captureDomainOrderPayment(paymentReference, 'paid');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not capture affiliate payment.');
    } finally {
      setCapturingPaymentReference(null);
    }
  };

  if (sitesLoading || loading) {
    return (
      <div className="min-h-[360px] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Domains</h1>
          <p className="text-zinc-400 mt-1">Create a site first, then connect or buy domains here.</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <Link to="/sites/new">
              <Button>Create First Site</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Domains</h1>
        <p className="text-zinc-400 mt-1">
          Connect existing domains, verify DNS ownership, and submit Namecheap purchase requests from one secure workspace.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {lastCheckout && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Order {lastCheckout.orderId} created with payment reference {lastCheckout.paymentReference} ({lastCheckout.provider}).
          {lastCheckout.checkoutUrl && (
            <div className="mt-2">
              <a href={lastCheckout.checkoutUrl} target="_blank" rel="noreferrer noopener" className="underline">
                Open Namecheap affiliate checkout
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Connect Existing Domain
            </CardTitle>
            <CardDescription>
              Bring your own domain and map it to one of your trading sites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Site</label>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Domain</label>
              <Input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="example.com"
              />
            </div>

            <Button onClick={handleConnectDomain} isLoading={connectSaving} disabled={!selectedSiteId || !domainInput.trim()}>
              Save Domain Connection
            </Button>

            {selectedDomain && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-100">DNS Verification Instructions</div>
                  <Badge variant={statusVariant(selectedDomain.status)} className="capitalize">{selectedDomain.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-zinc-400">
                  Add this TXT record to prove ownership before activation.
                </div>
                <div className="rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 space-y-1">
                  <div>Type: {selectedDomain.verification_record_type || 'TXT'}</div>
                  <div>Name: {selectedDomain.verification_record_name || '_tradesaas-challenge'}</div>
                  <div>Value: {selectedDomain.verification_record_value || '-'}</div>
                </div>
                <div className="rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 space-y-1">
                  <div>Type: {selectedDomain.dns_record_type || 'A'}</div>
                  <div>Name: {selectedDomain.dns_record_name || '@'}</div>
                  <div>Value: {selectedDomain.dns_record_value || '76.76.21.21'}</div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleVerifyDomain(selectedDomain)}
                  isLoading={verifyingDomainId === selectedDomain.id}
                  className="gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verify DNS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Buy Domain
            </CardTitle>
            <CardDescription>
              Use Namecheap affiliate checkout or automated Porkbun processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Provider</label>
              <select
                value={domainProvider}
                onChange={(event) => setDomainProvider(event.target.value as 'namecheap_affiliate' | 'porkbun')}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="namecheap_affiliate">Namecheap (affiliate checkout)</option>
                <option value="porkbun">Porkbun (automatic)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Site</label>
              <select
                value={buySiteId}
                onChange={(event) => setBuySiteId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Domain to Buy</label>
              <div className="flex gap-2">
                <Input
                  value={buyDomainInput}
                  onChange={(event) => {
                    setBuyDomainInput(event.target.value);
                    setAvailability(null);
                    setAvailabilityOptions([]);
                    lastSuccessfulSearchKeyRef.current = '';
                  }}
                  placeholder="besttraderhub or besttraderhub.com"
                />
                <Button variant="outline" onClick={handleCheckAvailability} isLoading={checking} className="gap-2">
                  <Search className="w-4 h-4" />
                  Check
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Years</label>
              <select
                value={buyYears}
                onChange={(event) => setBuyYears(Number(event.target.value))}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                {[1, 2, 3, 5].map((year) => (
                  <option key={year} value={year}>{year} year{year > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Payment Provider</label>
              <select
                value={paymentProvider}
                onChange={(event) => setPaymentProvider(event.target.value as 'mpesa' | 'paystack' | 'flutterwave' | 'manual')}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              >
                <option value="manual">Manual (auto-capture for demo)</option>
                <option value="mpesa">M-Pesa</option>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </div>

            {availability && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-100">{availability.domain}</div>
                    <div className="text-xs text-zinc-500">Selected domain for checkout</div>
                  </div>
                  <Badge variant={availability.available ? 'success' : 'danger'}>
                    {availability.available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                {(domainProvider !== 'porkbun' || availability.priceSource === 'live') && availability.pricing && (
                  <div className="rounded border border-zinc-700 bg-zinc-950/80 p-3 text-xs space-y-1 text-zinc-300">
                    <div>Sell price: <span className="text-zinc-100">{formatCurrency(availability.pricing.sellPrice, availability.pricing.currency)}</span></div>
                    <div>Base cost: {formatCurrency(availability.pricing.baseCost, availability.pricing.currency)}</div>
                    <div>Platform margin: {formatCurrency(availability.pricing.margin, availability.pricing.currency)}</div>
                  </div>
                )}
                {domainProvider === 'porkbun' && availability.priceSource !== 'live' && (
                  <div className="text-xs text-zinc-500">Run a live row check to load exact Porkbun price.</div>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAvailabilityModal(true)} disabled={availabilityOptions.length === 0}>
                  Open suggestions
                </Button>
              </div>
            )}

            <p className="text-xs text-zinc-500">
              Click Check to open suggestions, select an available domain, then finish payment and order directly in the popup.
            </p>
          </CardContent>
        </Card>
      </div>

      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <div className="text-zinc-100 font-semibold">Domain Suggestions</div>
                <div className="text-xs text-zinc-500">Choose an available domain and continue checkout here.</div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAvailabilityModal(false)} className="gap-1">
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[62vh] space-y-3">
              {checking && (
                <div className="min-h-[160px] flex items-center justify-center">
                  <Spinner className="w-6 h-6 text-zinc-500" />
                </div>
              )}

              {!checking && availabilityOptions.length === 0 && (
                <div className="rounded border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-8 text-sm text-zinc-400 text-center">
                  No suggestions yet. Enter a domain keyword and click Check.
                </div>
              )}

              {!checking && availabilityOptions.length > 0 && (
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="hidden md:grid md:grid-cols-[1.8fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr] bg-zinc-900/70 border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-400">
                    <div>Domain</div>
                    <div>Status</div>
                    <div>Sell Price</div>
                    <div>Base Cost</div>
                    <div>Margin</div>
                    <div className="text-right">Action</div>
                  </div>

                  <div className="max-h-[54vh] overflow-y-auto">
                    {availabilityOptions.map((option) => {
                      const selected = availability?.domain === option.domain;
                      const recommendation = getDomainRecommendation(option, availabilityOptions);
                      const isOptionChecking = checkingOptionDomain === option.domain;
                      const canClick = domainProvider === 'porkbun' ? !isOptionChecking && !checking : option.available && !checking;
                      const showLivePricing = domainProvider !== 'porkbun' || option.priceSource === 'live';
                      const showEstimatedPricing = domainProvider === 'porkbun' && option.priceSource === 'estimated';

                      return (
                        <button
                          key={option.domain}
                          type="button"
                          onClick={() => void handleSelectAvailability(option.domain)}
                          disabled={!canClick}
                          className={`w-full border-b border-zinc-800 px-3 py-3 text-left transition-colors ${selected
                            ? 'bg-cyan-500/10'
                            : canClick
                              ? 'bg-zinc-950 hover:bg-zinc-900/80'
                              : 'bg-zinc-950/70'
                            }`}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-[1.8fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr] gap-2 items-start md:items-center">
                            <div>
                              <div className="font-medium text-zinc-100">{option.domain}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">Source: {option.source || domainProvider}</div>
                              {option.message && <div className="text-xs text-zinc-400 mt-1">{option.message}</div>}
                              {option.premium && <div className="text-xs text-amber-300 mt-1">Premium domain pricing applies.</div>}
                            </div>

                            <div className="md:pt-0.5">
                              {option.checked === false ? (
                                <Badge variant="outline">Not Checked</Badge>
                              ) : (
                                <Badge variant={option.available ? 'success' : 'danger'}>
                                  {option.available ? 'Available' : 'Unavailable'}
                                </Badge>
                              )}
                              {showEstimatedPricing && <Badge variant="outline" className="ml-2">Estimated</Badge>}
                              {recommendation && <Badge variant={recommendation.variant} className="ml-2">{recommendation.label}</Badge>}
                            </div>

                            <div className="text-sm text-zinc-200">
                              {showLivePricing && option.pricing
                                ? formatCurrency(option.pricing.sellPrice, option.pricing.currency)
                                : showEstimatedPricing
                                  ? 'Live check required'
                                  : '--'}
                            </div>
                            <div className="text-sm text-zinc-300">
                              {showLivePricing && option.pricing
                                ? formatCurrency(option.pricing.baseCost, option.pricing.currency)
                                : showEstimatedPricing
                                  ? 'Live check required'
                                  : '--'}
                            </div>
                            <div className="text-sm text-zinc-300">
                              {showLivePricing && option.pricing
                                ? formatCurrency(option.pricing.margin, option.pricing.currency)
                                : showEstimatedPricing
                                  ? 'Live check required'
                                  : '--'}
                            </div>
                            <div className="text-right">
                              <span className="inline-flex rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200">
                                {isOptionChecking ? 'Checking...' : optionActionLabel(option, domainProvider)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 px-4 py-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 bg-zinc-950/95">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Order Cart</div>

                {selectedAvailableOption ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-zinc-100">{selectedAvailableOption.domain}</div>
                      <Badge variant="success">Selected</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                      <div>Site: <span className="text-zinc-200">{selectedBuySite?.name || buySiteId}</span></div>
                      <div>Provider: <span className="text-zinc-200">{domainProvider === 'porkbun' ? 'Porkbun' : 'Namecheap Affiliate'}</span></div>
                      <div>Duration: <span className="text-zinc-200">{buyYears} year{buyYears > 1 ? 's' : ''}</span></div>
                      <div>Price Source: <span className="text-zinc-200">{selectedAvailableOption.priceSource === 'live' ? 'Live' : 'Estimated'}</span></div>
                    </div>

                    {(domainProvider !== 'porkbun' || selectedAvailableOption.priceSource === 'live') && selectedAvailableOption.pricing ? (
                      <div className="rounded border border-zinc-700 bg-zinc-950/80 p-2 text-xs text-zinc-300 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>Total: <span className="text-zinc-100">{formatCurrency(selectedAvailableOption.pricing.sellPrice, selectedAvailableOption.pricing.currency)}</span></div>
                        <div>Base: {formatCurrency(selectedAvailableOption.pricing.baseCost, selectedAvailableOption.pricing.currency)}</div>
                        <div>Margin: {formatCurrency(selectedAvailableOption.pricing.margin, selectedAvailableOption.pricing.currency)}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">Live price is not yet available for this domain.</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-zinc-400">
                    {domainProvider === 'porkbun'
                      ? 'Choose a row and run live check to load exact Porkbun pricing before ordering.'
                      : 'Select an available domain to continue.'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAvailabilityModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreatePurchaseRequest}
                  isLoading={requesting}
                  disabled={!selectedAvailableOption || !buySiteId || checking || Boolean(checkingOptionDomain)}
                >
                  {modalPrimaryActionLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connected Domains</CardTitle>
          <CardDescription>All domains connected to your sites and their current verification state.</CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
              No connected domains yet.
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="text-zinc-100 font-medium">{domain.domain}</div>
                      <div className="text-xs text-zinc-400 mt-1">Site: {domain.sites?.name || domain.site_id}</div>
                      {domain.provisioning_error && (
                        <div className="text-xs text-red-300 mt-2">{domain.provisioning_error}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(domain.status)} className="capitalize">{domain.status.replace('_', ' ')}</Badge>
                      {domain.verified && <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(domain)}
                        isLoading={verifyingDomainId === domain.id}
                      >
                        Verify
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                        isLoading={deletingDomainId === domain.id}
                        className="gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                      {domain.verified && (
                        <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer noopener">
                          <Button variant="secondary" size="sm" className="gap-1">
                            Visit
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Purchase Requests</CardTitle>
          <CardDescription>Track domain buying requests submitted through your platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {purchaseRequests.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
              No domain purchase requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
                  <div>
                    <div className="font-medium text-zinc-100">{request.domain_name}</div>
                    <div className="text-xs text-zinc-400 mt-1">Site: {request.sites?.name || request.site_id} • {request.years} year(s) • Provider: {request.provider.replace('_', ' ')}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Charge {formatCurrency(request.payment_amount, request.currency)} | Cost {formatCurrency(request.base_cost, request.currency)} | Margin {formatCurrency(request.platform_margin, request.currency)}
                    </div>
                    {request.payment_reference && (
                      <div className="text-xs text-zinc-500 mt-1">Payment Ref: {request.payment_reference}</div>
                    )}
                    {request.last_error && (
                      <div className="text-xs text-red-300 mt-2">{request.last_error}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={requestStatusVariant(request.status)} className="capitalize">{request.status}</Badge>
                    <Badge variant={paymentStatusVariant(request.payment_status)} className="capitalize">payment: {request.payment_status}</Badge>
                    <Badge variant={orderStatusVariant(request.order_status)} className="capitalize">order: {request.order_status.replace('_', ' ')}</Badge>
                    {request.provider === 'namecheap_affiliate' && request.payment_status === 'pending' && request.payment_reference && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCaptureAffiliatePayment(request.payment_reference as string)}
                        isLoading={capturingPaymentReference === request.payment_reference}
                      >
                        Mark Affiliate Payment Received
                      </Button>
                    )}
                    {request.payment_status === 'paid' && !['completed', 'failed', 'refunded'].includes(request.order_status) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleProcessOrder(request.id)}
                        isLoading={processingOrderId === request.id}
                      >
                        Run Processor
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
