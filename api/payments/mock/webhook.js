import { getSupabaseAdminClient } from '../../../server/lib/supabase-admin.js';
import { processDomainOrder } from '../../../server/lib/domain-order-processor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymentReference = String(req.body?.paymentReference || '').trim();
  const status = String(req.body?.status || 'paid').trim().toLowerCase();

  if (!paymentReference) {
    return res.status(400).json({ error: 'paymentReference is required.' });
  }

  try {
    const adminClient = getSupabaseAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('domain_purchase_requests')
      .select('*')
      .eq('payment_reference', paymentReference)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({ error: 'Order not found for this payment reference.' });
    }

    if (status === 'paid') {
      const { error: markPaidError } = await adminClient
        .from('domain_purchase_requests')
        .update({
          payment_status: 'paid',
          order_status: 'payment_confirmed',
          status: 'processing',
          last_error: null,
        })
        .eq('id', order.id);

      if (markPaidError) throw markPaidError;

      const processingResult = await processDomainOrder(order.id);

      return res.status(200).json({
        ok: true,
        orderId: order.id,
        paymentReference,
        processingResult,
      });
    }

    if (status === 'failed') {
      const { error: markFailedError } = await adminClient
        .from('domain_purchase_requests')
        .update({
          payment_status: 'failed',
          order_status: 'failed',
          status: 'failed',
          last_error: 'Payment provider marked transaction as failed.',
        })
        .eq('id', order.id);

      if (markFailedError) throw markFailedError;

      return res.status(200).json({
        ok: true,
        orderId: order.id,
        paymentReference,
        status: 'failed',
      });
    }

    if (status === 'refunded') {
      const { error: markRefundedError } = await adminClient
        .from('domain_purchase_requests')
        .update({
          payment_status: 'refunded',
          order_status: 'refunded',
          status: 'cancelled',
          last_error: null,
        })
        .eq('id', order.id);

      if (markRefundedError) throw markRefundedError;

      return res.status(200).json({
        ok: true,
        orderId: order.id,
        paymentReference,
        status: 'refunded',
      });
    }

    return res.status(400).json({ error: 'Unsupported webhook status. Use paid, failed, or refunded.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Webhook handling failed.' });
  }
}

