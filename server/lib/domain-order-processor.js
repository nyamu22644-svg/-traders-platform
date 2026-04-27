import { randomUUID } from 'node:crypto';
import { checkDomainAvailability, registerDomain, setDomainDnsRecords } from './namecheap.js';
import { checkPorkbunAvailability, registerPorkbunDomain, setPorkbunDnsRecords } from './porkbun.js';
import { getSupabaseAdminClient } from './supabase-admin.js';
import { attachDomainToVercel } from './vercel.js';
import { verifyDomainDns } from './dns-verify.js';

const DEFAULT_A_RECORD = '76.76.21.21';

function normalizeProvider(rawProvider) {
  const provider = String(rawProvider || '').toLowerCase();
  if (provider === 'porkbun') return 'porkbun';
  if (provider === 'namecheap') return 'namecheap';
  return 'namecheap_affiliate';
}

async function updateOrder(adminClient, orderId, updates) {
  const { error } = await adminClient
    .from('domain_purchase_requests')
    .update(updates)
    .eq('id', orderId);

  if (error) throw error;
}

export async function processDomainOrder(orderId) {
  const adminClient = getSupabaseAdminClient();

  const { data: order, error: orderError } = await adminClient
    .from('domain_purchase_requests')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  if (order.payment_status !== 'paid') {
    throw new Error('Order is not paid yet.');
  }

  if (order.order_status === 'completed') {
    return {
      order,
      alreadyCompleted: true,
    };
  }

  try {
    const provider = normalizeProvider(order.provider);

    await updateOrder(adminClient, orderId, {
      status: 'processing',
      order_status: 'registering',
      last_error: null,
    });

    const availability =
      provider === 'porkbun'
        ? await checkPorkbunAvailability(order.domain_name)
        : await checkDomainAvailability(order.domain_name);

    if (!availability.available) {
      throw new Error('Domain is no longer available.');
    }

    let registration = null;
    if (provider === 'porkbun') {
      registration = await registerPorkbunDomain({
        domain: order.domain_name,
        years: order.years,
        baseCost: order.base_cost,
      });
    } else if (provider === 'namecheap') {
      registration = await registerDomain({
        domain: order.domain_name,
        years: order.years,
        registrantEmail: order.registrant_email,
      });
    }

    const verificationToken = randomUUID().replace(/-/g, '');

    const domainPayload = {
      site_id: order.site_id,
      domain: order.domain_name,
      provider: provider === 'namecheap_affiliate' ? 'namecheap_affiliate' : provider,
      status: 'purchase_pending',
      verified: false,
      verification_token: verificationToken,
      verification_record_type: 'TXT',
      verification_record_name: '_tradesaas-challenge',
      verification_record_value: `tradesaas-verification=${verificationToken}`,
      dns_record_type: 'A',
      dns_record_name: '@',
      dns_record_value: DEFAULT_A_RECORD,
      provisioning_error: null,
      last_verified_at: null,
      purchase_price: order.base_cost,
    };

    const { data: domainRow, error: upsertDomainError } = await adminClient
      .from('domains')
      .upsert([domainPayload], { onConflict: 'site_id' })
      .select()
      .single();

    if (upsertDomainError) throw upsertDomainError;

    await updateOrder(adminClient, orderId, {
      domain_id: domainRow.id,
      namecheap_order_id: registration?.orderId || null,
      order_status: 'dns_configuring',
    });

    const desiredRecords = [
      {
        host: '@',
        type: 'A',
        value: DEFAULT_A_RECORD,
        ttl: 300,
      },
      {
        host: 'www',
        type: 'CNAME',
        value: 'cname.vercel-dns.com',
        ttl: 300,
      },
      {
        host: '_tradesaas-challenge',
        type: 'TXT',
        value: `tradesaas-verification=${verificationToken}`,
        ttl: 300,
      },
    ];

    if (provider === 'porkbun') {
      await setPorkbunDnsRecords({
        domain: order.domain_name,
        records: desiredRecords,
      });
    } else if (provider === 'namecheap') {
      await setDomainDnsRecords({
        domain: order.domain_name,
        records: desiredRecords,
      });
    } else {
      await updateOrder(adminClient, orderId, {
        status: 'processing',
        order_status: 'verifying',
        last_error:
          'Namecheap affiliate order: waiting for user DNS changes (A/CNAME/TXT) to propagate before auto verification.',
      });
    }

    await updateOrder(adminClient, orderId, {
      order_status: 'vercel_linking',
    });

    const vercelResult = await attachDomainToVercel(order.domain_name);

    await updateOrder(adminClient, orderId, {
      order_status: 'verifying',
      vercel_domain_verified: Boolean(vercelResult.verified),
    });

    const verification = await verifyDomainDns({
      domain: order.domain_name,
      verificationToken,
      verificationRecordName: '_tradesaas-challenge',
      expectedARecordValue: DEFAULT_A_RECORD,
    });

    const now = new Date().toISOString();

    if (verification.verified) {
      const { error: activateDomainError } = await adminClient
        .from('domains')
        .update({
          status: 'active',
          verified: true,
          last_verified_at: now,
          provisioning_error: null,
        })
        .eq('id', domainRow.id);

      if (activateDomainError) throw activateDomainError;

      await updateOrder(adminClient, orderId, {
        status: 'completed',
        order_status: 'completed',
        processed_at: now,
        last_error: null,
      });

      return {
        orderId,
        completed: true,
        verification,
        vercelResult,
      };
    }

    const { error: pendingDomainError } = await adminClient
      .from('domains')
      .update({
        status: 'pending_verification',
        verified: false,
        provisioning_error: verification.reason,
      })
      .eq('id', domainRow.id);

    if (pendingDomainError) throw pendingDomainError;

    await updateOrder(adminClient, orderId, {
      status: 'processing',
      order_status: 'verifying',
      processed_at: now,
      last_error: verification.reason,
    });

    return {
      orderId,
      completed: false,
      verification,
      vercelResult,
    };
  } catch (error) {
    await updateOrder(adminClient, orderId, {
      status: 'failed',
      order_status: 'failed',
      last_error: error.message || 'Order processing failed.',
      processed_at: new Date().toISOString(),
    });

    throw error;
  }
}
