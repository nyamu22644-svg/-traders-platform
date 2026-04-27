import { getSupabaseAdminClient, getUserRole, requireAuthenticatedUser } from '../../server/lib/supabase-admin.js';
import { processDomainOrder } from '../../server/lib/domain-order-processor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const adminClient = getSupabaseAdminClient();

    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required.' });
    }

    const { data: order, error: orderError } = await adminClient
      .from('domain_purchase_requests')
      .select('id, site_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const role = await getUserRole(adminClient, user.id);
    if (role !== 'admin') {
      const { data: ownedSite, error: siteError } = await adminClient
        .from('sites')
        .select('id')
        .eq('id', order.site_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (siteError) throw siteError;

      if (!ownedSite) {
        return res.status(403).json({ error: 'You cannot process this order.' });
      }
    }

    const result = await processDomainOrder(orderId);

    return res.status(200).json({
      ok: true,
      orderId,
      result,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to process order.' });
  }
}

