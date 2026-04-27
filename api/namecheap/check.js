import { DOMAIN_REGEX, normalizeDomain } from '../../server/lib/domain-utils.js';
import { checkDomainAvailability } from '../../server/lib/namecheap.js';
import { getDomainPricing } from '../../server/lib/pricing.js';
import { getSupabaseAdminClient } from '../../server/lib/supabase-admin.js';

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
    const result = await checkDomainAvailability(domain);

    let pricing = null;
    try {
      const adminClient = getSupabaseAdminClient();
      pricing = await getDomainPricing(adminClient, domain, years);
    } catch {
      pricing = null;
    }

    return res.status(200).json({
      domain,
      available: result.available,
      premium: result.premium,
      source: result.source || 'namecheap',
      message: result.message || null,
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
    return res.status(500).json({ error: error.message || 'Namecheap availability request failed.' });
  }
}

