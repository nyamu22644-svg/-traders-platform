import { extractTld } from './domain-utils.js';

const DEFAULT_BASE_PRICE = 11.99;

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function getDomainPricing(adminClient, domain, years = 1, options = {}) {
  const tld = extractTld(domain);

  const { data: rule, error } = await adminClient
    .from('domain_pricing_rules')
    .select('*')
    .eq('tld', tld)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;

  const basePriceFromProvider = options?.basePriceOverride;
  const basePrice = Number(
    basePriceFromProvider != null
      ? basePriceFromProvider
      : rule?.base_price ?? DEFAULT_BASE_PRICE
  );
  const markupType = rule?.markup_type || 'flat';
  const markupValue = Number(rule?.markup_value ?? 0);
  const serviceFee = Number(rule?.service_fee ?? 0);
  const override = rule?.final_price_override != null ? Number(rule.final_price_override) : null;

  const calculatedUnitPrice =
    override != null
      ? override
      : markupType === 'percent'
        ? basePrice + (basePrice * markupValue) / 100 + serviceFee
        : basePrice + markupValue + serviceFee;

  const yearsInt = Math.max(1, Number(years || 1));
  const unitSellPrice = round2(calculatedUnitPrice);
  const paymentAmount = round2(unitSellPrice * yearsInt);
  const baseCost = round2(basePrice * yearsInt);
  const margin = round2(paymentAmount - baseCost);

  return {
    tld,
    rule: rule || null,
    currency: rule?.currency || 'USD',
    years: yearsInt,
    baseCost,
    sellPrice: paymentAmount,
    margin,
    unitSellPrice,
  };
}
