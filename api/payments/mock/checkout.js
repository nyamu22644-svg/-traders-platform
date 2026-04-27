import { DOMAIN_REGEX, generateReference, normalizeDomain } from '../../../server/lib/domain-utils.js';
import { checkDomainAvailability, getNamecheapAffiliateCheckoutUrl } from '../../../server/lib/namecheap.js';
import { checkPorkbunAvailability } from '../../../server/lib/porkbun.js';
import { getDomainPricing } from '../../../server/lib/pricing.js';
import { getSupabaseAdminClient, requireAuthenticatedUser } from '../../../server/lib/supabase-admin.js';

function normalizeProvider(rawProvider) {
  const provider = String(rawProvider || 'namecheap_affiliate').trim().toLowerCase();
  if (provider === 'porkbun') return 'porkbun';
  if (provider === 'namecheap') return 'namecheap';
  return 'namecheap_affiliate';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const adminClient = getSupabaseAdminClient();

    const siteId = String(req.body?.siteId || '').trim();
    const domain = normalizeDomain(req.body?.domain);
    const years = Math.max(1, Number(req.body?.years || 1));
    const registrantEmail = String(req.body?.registrantEmail || user.email || '').trim();
    const paymentProvider = String(req.body?.paymentProvider || 'manual').trim().toLowerCase();
    const provider = normalizeProvider(req.body?.provider);

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required.' });
    }

    if (!domain || !DOMAIN_REGEX.test(domain)) {
      return res.status(400).json({ error: 'Provide a valid domain like example.com.' });
    }

    const { data: ownedSite, error: siteError } = await adminClient
      .from('sites')
      .select('id, user_id, name')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (siteError) throw siteError;

    if (!ownedSite) {
      return res.status(403).json({ error: 'You do not own this site.' });
    }

    const availability =
      provider === 'porkbun'
        ? await checkPorkbunAvailability(domain)
        : await checkDomainAvailability(domain);

    if (!availability.available) {
      return res.status(409).json({ error: 'Domain is not available anymore.' });
    }

    const pricing = await getDomainPricing(adminClient, domain, years, {
      basePriceOverride: availability?.price,
    });
    const paymentReference = generateReference('pay');
    const checkoutUrl =
      provider === 'namecheap_affiliate'
        ? getNamecheapAffiliateCheckoutUrl(domain, years)
        : null;

    const { data: order, error: insertError } = await adminClient
      .from('domain_purchase_requests')
      .insert([
        {
          site_id: siteId,
          domain_name: domain,
          provider,
          years,
          registrant_email: registrantEmail,
          status: 'pending',
          payment_provider: ['mpesa', 'paystack', 'flutterwave', 'manual'].includes(paymentProvider)
            ? paymentProvider
            : 'manual',
          payment_reference: paymentReference,
          payment_status: 'pending',
          order_status: 'pending_payment',
          currency: pricing.currency,
          payment_amount: pricing.sellPrice,
          base_cost: pricing.baseCost,
          sell_price: pricing.sellPrice,
          platform_margin: pricing.margin,
          availability_snapshot: req.body?.availabilitySnapshot || availability,
          metadata: {
            checkout_source: 'mock',
            pricing_rule_id: pricing.rule?.id || null,
            provider_check_source: availability?.source || provider,
            affiliate_checkout_url: checkoutUrl,
          },
        },
      ])
      .select('*')
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      orderId: order.id,
      paymentReference,
      paymentProvider: order.payment_provider,
      amount: order.payment_amount,
      currency: order.currency,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      domainName: order.domain_name,
      provider,
      checkoutUrl,
      instructions:
        provider === 'namecheap_affiliate'
          ? 'Send user to checkoutUrl for Namecheap purchase, then confirm payment manually to continue processing.'
          : order.payment_provider === 'manual'
          ? 'Manual mode: call webhook endpoint with status=paid to simulate settlement.'
          : `Integrate real ${order.payment_provider} webhook using paymentReference.`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to initialize domain checkout.' });
  }
}

