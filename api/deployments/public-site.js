import { getSupabaseAdminClient } from '../../server/lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const slugRaw = req.method === 'GET' ? req.query?.slug : req.body?.slug;
    const slug = String(slugRaw || '').trim().toLowerCase();

    if (!slug) {
      return res.status(400).json({ error: 'slug is required.' });
    }

    const adminClient = getSupabaseAdminClient();

    const { data: deploymentRow, error: deploymentError } = await adminClient
      .from('site_deployments')
      .select('site_id, deployment_slug, deployment_url, status')
      .eq('deployment_slug', slug)
      .maybeSingle();

    if (deploymentError) throw deploymentError;
    if (!deploymentRow?.site_id) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    const { data: siteRow, error: siteError } = await adminClient
      .from('sites')
      .select('id, user_id, name, type, status, is_public, created_at, updated_at')
      .eq('id', deploymentRow.site_id)
      .maybeSingle();

    if (siteError) throw siteError;
    if (!siteRow) {
      return res.status(404).json({ error: 'Site not found.' });
    }

    if (!siteRow.is_public) {
      return res.status(403).json({ error: 'This site is not public.' });
    }

    const { data: configRow, error: configError } = await adminClient
      .from('site_configs')
      .select('*')
      .eq('site_id', siteRow.id)
      .maybeSingle();

    if (configError) throw configError;
    if (!configRow) {
      return res.status(404).json({ error: 'Site config not found.' });
    }

    return res.status(200).json({
      site: siteRow,
      config: configRow,
      deployment: deploymentRow,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not resolve deployment.' });
  }
}

