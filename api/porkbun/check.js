import { DOMAIN_REGEX, normalizeDomain } from '../../server/lib/domain-utils.js';
import { getDomainPricing } from '../../server/lib/pricing.js';
import { checkPorkbunAvailability, getPorkbunTldPricingMap } from '../../server/lib/porkbun.js';
import { getSupabaseAdminClient } from '../../server/lib/supabase-admin.js';

function parseNumericPrice(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const domain = normalizeDomain(req.body?.domain);
  const years = Math.max(1, Number(req.body?.years || 1));

  if (!domain || !DOMAIN_REGEX.test(domain)) {
    return res.status(400).json({ error: 'Please provide a valid domain like example.com.' });
  }

  try {
    const result = await checkPorkbunAvailability(domain);

    let pricing = null;
    const liveProviderPrice = parseNumericPrice(result.price);
    let providerBasePrice = liveProviderPrice;
    let priceSource = liveProviderPrice != null ? 'live' : null;

    if (!(providerBasePrice != null && Number.isFinite(providerBasePrice))) {
      try {
        const parts = domain.split('.').filter(Boolean);
        const tld = parts.length > 1 ? parts.slice(1).join('.') : '';
        if (tld) {
          const tldPrices = await getPorkbunTldPricingMap([tld]);
          const tldPrice = tldPrices[tld];
          if (tldPrice != null && Number.isFinite(Number(tldPrice))) {
            providerBasePrice = Number(tldPrice);
            if (priceSource == null) {
              priceSource = 'estimated';
            }
          }
        }
      } catch {
        providerBasePrice = null;
        priceSource = null;
      }
    }

    if (providerBasePrice != null && Number.isFinite(providerBasePrice)) {
      try {
        const adminClient = getSupabaseAdminClient();
        pricing = await getDomainPricing(adminClient, domain, years, {
          basePriceOverride: providerBasePrice,
        });
      } catch {
        pricing = null;
      }
    }

    return res.status(200).json({
      domain,
      available: result.available,
      premium: result.premium,
      source: result.source || 'porkbun',
      message: result.message || null,
      providerPrice: providerBasePrice,
      priceSource,
      pricing: pricing
        ? {
            years: pricing.years,
            currency: pricing.currency,
            sellPrice: pricing.sellPrice,
            unitSellPrice: pricing.unitSellPrice,
            baseCost: pricing.baseCost,
            margin: pricing.margin,
            tld: pricing.tld,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Porkbun availability request failed.' });
  }
}

