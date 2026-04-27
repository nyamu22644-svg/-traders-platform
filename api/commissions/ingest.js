import { getSupabaseAdminClient, getUserRole, requireAuthenticatedUser } from '../../server/lib/supabase-admin.js';

const EVENT_STATUSES = new Set(['pending', 'confirmed', 'reversed', 'paid_out']);

function normalizeText(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function parseNumeric(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toAmount(value) {
  const parsed = parseNumeric(value, null);
  if (parsed == null) return null;
  return Number(parsed.toFixed(8));
}

function toPct(value, fallback) {
  const parsed = parseNumeric(value, fallback);
  if (parsed == null) return fallback;
  return Number(parsed.toFixed(2));
}

function normalizeStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'pending';
  return EVENT_STATUSES.has(normalized) ? normalized : 'pending';
}

function normalizeCurrency(value) {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || 'USD';
}

function normalizeEventsPayload(body) {
  if (Array.isArray(body?.events)) return body.events;
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') return [body];
  return [];
}

function readEventValue(event, keys) {
  for (const key of keys) {
    if (event[key] !== undefined && event[key] !== null) {
      return event[key];
    }
  }
  return undefined;
}

async function getOwnedSiteIds(adminClient, userId) {
  const { data, error } = await adminClient
    .from('sites')
    .select('id')
    .eq('user_id', userId)
    .limit(2000);

  if (error) throw error;
  return new Set((data || []).map((row) => row.id));
}

async function resolveAttribution(adminClient, input) {
  const { clientLoginId, referralCode, ownerSiteIds, isAdmin } = input;

  const runLookup = async (useReferral) => {
    let query = adminClient
      .from('deriv_client_attributions')
      .select('id, site_id, referral_code, last_seen_at')
      .eq('client_loginid', clientLoginId)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(20);

    if (useReferral && referralCode) {
      query = query.eq('referral_code', referralCode);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).filter((row) => {
      if (isAdmin) return true;
      return ownerSiteIds.has(row.site_id);
    });

    return rows[0] || null;
  };

  const withReferral = await runLookup(true);
  if (withReferral) return withReferral;
  return runLookup(false);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const adminClient = getSupabaseAdminClient();
    const role = await getUserRole(adminClient, user.id);
    const isAdmin = role === 'admin';
    const ownerSiteIds = isAdmin ? new Set() : await getOwnedSiteIds(adminClient, user.id);

    const requestSiteId = normalizeText(req.body?.siteId || req.body?.site_id);
    const dryRun = req.body?.dryRun === true;
    const events = normalizeEventsPayload(req.body);

    if (!events.length) {
      return res.status(400).json({ error: 'At least one commission event is required.' });
    }

    if (!isAdmin && requestSiteId && !ownerSiteIds.has(requestSiteId)) {
      return res.status(403).json({ error: 'You cannot ingest commissions for this site.' });
    }

    const siteConfigCache = new Map();
    const results = [];
    const failures = [];

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index] || {};

      try {
        const clientLoginId = normalizeText(readEventValue(event, ['client_loginid', 'clientLoginid', 'loginid']));
        if (!clientLoginId) {
          throw new Error('client_loginid is required.');
        }

        const referralCode = normalizeText(readEventValue(event, ['referral_code', 'referralCode', 'sidc']));
        const tradeReference = normalizeText(readEventValue(event, ['trade_reference', 'tradeReference', 'reference'])) || null;

        let siteId = normalizeText(readEventValue(event, ['site_id', 'siteId'])) || requestSiteId;
        let attributionId = null;

        if (!siteId) {
          const attribution = await resolveAttribution(adminClient, {
            clientLoginId,
            referralCode,
            ownerSiteIds,
            isAdmin,
          });

          if (!attribution?.site_id) {
            throw new Error('Could not resolve site_id from deriv_client_attributions. Provide site_id or ingest attribution first.');
          }

          siteId = attribution.site_id;
          attributionId = attribution.id;
        }

        if (!isAdmin && !ownerSiteIds.has(siteId)) {
          throw new Error('Unauthorized site_id for this user.');
        }

        if (!siteConfigCache.has(siteId)) {
          const { data: cfg, error: cfgError } = await adminClient
            .from('site_configs')
            .select('total_commission_pct, platform_commission_pct, client_commission_pct')
            .eq('site_id', siteId)
            .maybeSingle();

          if (cfgError && cfgError.code !== 'PGRST116') throw cfgError;

          siteConfigCache.set(siteId, {
            total_commission_pct: parseNumeric(cfg?.total_commission_pct, 3),
            platform_commission_pct: parseNumeric(cfg?.platform_commission_pct, 20),
            client_commission_pct: parseNumeric(cfg?.client_commission_pct, 80),
          });
        }

        const config = siteConfigCache.get(siteId);

        const grossCommission = toAmount(readEventValue(event, ['gross_commission', 'grossCommission', 'commission_amount', 'amount']));
        if (grossCommission == null || grossCommission < 0) {
          throw new Error('gross_commission must be a non-negative number.');
        }

        const totalCommissionPct = toPct(
          readEventValue(event, ['total_commission_pct', 'totalCommissionPct']),
          config.total_commission_pct
        );

        const platformSharePct = toPct(
          readEventValue(event, ['platform_share_pct', 'platformSharePct']),
          config.platform_commission_pct
        );

        const clientSharePct = toPct(
          readEventValue(event, ['client_share_pct', 'clientSharePct']),
          config.client_commission_pct
        );

        const explicitPlatformAmount = toAmount(readEventValue(event, ['platform_amount', 'platformAmount']));
        const explicitClientAmount = toAmount(readEventValue(event, ['client_amount', 'clientAmount']));

        const computedPlatformAmount = Number(((grossCommission * platformSharePct) / 100).toFixed(8));
        const platformAmount = explicitPlatformAmount == null ? computedPlatformAmount : explicitPlatformAmount;
        const clientAmount = explicitClientAmount == null
          ? Number((grossCommission - platformAmount).toFixed(8))
          : explicitClientAmount;

        const occurredAtRaw = readEventValue(event, ['occurred_at', 'occurredAt']);
        const occurredAt = normalizeText(occurredAtRaw) || new Date().toISOString();

        const row = {
          site_id: siteId,
          client_loginid: clientLoginId,
          trade_reference: tradeReference,
          referral_code: referralCode || null,
          attribution_id: attributionId,
          source: normalizeText(readEventValue(event, ['source'])) || 'deriv_partner_import',
          currency: normalizeCurrency(readEventValue(event, ['currency'])),
          gross_commission: grossCommission,
          total_commission_pct: totalCommissionPct,
          platform_share_pct: platformSharePct,
          client_share_pct: clientSharePct,
          platform_amount: platformAmount,
          client_amount: clientAmount,
          status: normalizeStatus(readEventValue(event, ['status'])),
          occurred_at: occurredAt,
        };

        if (!dryRun) {
          if (tradeReference) {
            const { error: upsertError } = await adminClient
              .from('commission_events')
              .upsert([row], { onConflict: 'site_id,trade_reference' });

            if (upsertError) throw upsertError;
          } else {
            const { error: insertError } = await adminClient
              .from('commission_events')
              .insert([row]);

            if (insertError) throw insertError;
          }
        }

        results.push({
          index,
          site_id: siteId,
          client_loginid: clientLoginId,
          trade_reference: tradeReference,
          gross_commission: grossCommission,
          platform_amount: platformAmount,
          client_amount: clientAmount,
          dry_run: dryRun,
        });
      } catch (error) {
        failures.push({
          index,
          error: error?.message || 'Failed to process event.',
        });
      }
    }

    return res.status(failures.length ? 207 : 200).json({
      ok: failures.length === 0,
      dryRun,
      processed: results.length,
      failed: failures.length,
      results,
      failures,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || 'Failed to ingest commission events.',
    });
  }
}
