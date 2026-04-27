import { DOMAIN_REGEX, extractTld, normalizeDomain } from '../../server/lib/domain-utils.js';
import { getDomainPricing } from '../../server/lib/pricing.js';
import { checkPorkbunAvailability, getPorkbunTldPricingMap } from '../../server/lib/porkbun.js';
import { getSupabaseAdminClient } from '../../server/lib/supabase-admin.js';

function parseNumericPrice(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCheckError(rawMessage) {
  const message = String(rawMessage || '').trim();
  const lower = message.toLowerCase();

  if (!message) {
    return 'Porkbun live check is temporarily unavailable. Please retry shortly.';
  }

  if (lower.includes('within 10 seconds') || lower.includes('rate limit')) {
    return 'Porkbun rate limit reached. Wait a few seconds and try this row again.';
  }

  return message;
}

function normalizeInputDomains(rawDomains) {
  if (!Array.isArray(rawDomains)) return [];

  const unique = new Set();
  for (const raw of rawDomains) {
    const domain = normalizeDomain(raw);
    if (!domain || !DOMAIN_REGEX.test(domain)) continue;
    unique.add(domain);
    if (unique.size >= 12) break;
  }

  return Array.from(unique);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const years = Math.max(1, Number(req.body?.years || 1));
  const domains = normalizeInputDomains(req.body?.domains);

  if (!domains.length) {
    return res.status(400).json({ error: 'Please provide at least one valid domain suggestion.' });
  }

  const primaryDomain = domains[0];

  const tlds = Array.from(new Set(domains.map((domain) => extractTld(domain)).filter(Boolean)));

  const [liveCheckResult, pricingResult] = await Promise.allSettled([
    checkPorkbunAvailability(primaryDomain),
    getPorkbunTldPricingMap(tlds),
  ]);

  let liveResult = null;
  let liveError = null;
  if (liveCheckResult.status === 'fulfilled') {
    liveResult = liveCheckResult.value;
  } else {
    liveError = normalizeCheckError(liveCheckResult.reason?.message);
  }

  const tldPrices = pricingResult.status === 'fulfilled' ? pricingResult.value : {};

  let adminClient = null;
  try {
    adminClient = getSupabaseAdminClient();
  } catch {
    adminClient = null;
  }

  const options = await Promise.all(
    domains.map(async (domain, index) => {
      const tld = extractTld(domain);
      const tldPrice = tld && tldPrices[tld] != null ? Number(tldPrices[tld]) : null;

      const isPrimary = index === 0;
      const checked = isPrimary;
      const available = isPrimary ? Boolean(liveResult?.available) : false;
      const premium = isPrimary ? Boolean(liveResult?.premium) : false;

      const livePrice = parseNumericPrice(liveResult?.price);

      const providerPrice = isPrimary
        ? livePrice ?? tldPrice
        : tldPrice;

      const priceSource = isPrimary
        ? livePrice != null
          ? 'live'
          : providerPrice != null
            ? 'estimated'
            : null
        : providerPrice != null
          ? 'estimated'
          : null;

      let pricing = null;
      if (adminClient && providerPrice != null && Number.isFinite(providerPrice)) {
        try {
          const calculated = await getDomainPricing(adminClient, domain, years, {
            basePriceOverride: providerPrice,
          });

          pricing = {
            years: calculated.years,
            currency: calculated.currency,
            sellPrice: calculated.sellPrice,
            unitSellPrice: calculated.unitSellPrice,
            baseCost: calculated.baseCost,
            margin: calculated.margin,
            tld: calculated.tld,
          };
        } catch {
          pricing = null;
        }
      }

      let message = null;
      if (isPrimary) {
        message = liveResult?.message || liveError;
      } else if (pricing) {
        message = 'Estimated from Porkbun TLD pricing. Click this row to run a live availability check.';
      } else {
        message = 'Click this row to run a live Porkbun availability check.';
      }

      return {
        domain,
        checked,
        available,
        premium,
        source: 'porkbun',
        priceSource,
        providerPrice: providerPrice != null && Number.isFinite(providerPrice) ? providerPrice : null,
        pricing,
        message,
      };
    })
  );

  return res.status(200).json({
    provider: 'porkbun',
    years,
    options,
  });
}

