import { getEnv } from '../../server/lib/env.js';
import { getSupabaseAdminClient, getUserRole, requireAuthenticatedUser } from '../../server/lib/supabase-admin.js';
import { attachDomainToVercel } from '../../server/lib/vercel.js';

function slugifySiteName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function makeDeploymentSlug(siteName, siteId) {
  const base = slugifySiteName(siteName) || 'site';
  const suffix = String(siteId || '').replace(/-/g, '').slice(0, 8).toLowerCase();
  return `${base}-${suffix}`;
}

function getPlatformRootDomain() {
  const configured = String(getEnv('PLATFORM_ROOT_DOMAIN', '') || '').trim();
  if (configured) {
    return configured.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  }

  const appUrl = String(getEnv('APP_URL', 'https://dgait.vercel.app') || '').trim();
  try {
    return new URL(appUrl).hostname;
  } catch {
    return 'dgait.vercel.app';
  }
}

function shouldUsePathDeploymentUrl(rootDomain) {
  const normalized = String(rootDomain || '').toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === 'vercel.app'
    || normalized.endsWith('.vercel.app');
}

function getFallbackPreviewUrl(deploymentSlug) {
  const appUrl = String(getEnv('APP_URL', 'https://dgait.vercel.app') || '').trim().replace(/\/$/, '');
  return `${appUrl}/deploy/${deploymentSlug}`;
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
    const action = String(req.body?.action || 'redeploy').trim().toLowerCase();

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required.' });
    }

    const { data: siteRow, error: siteError } = await adminClient
      .from('sites')
      .select('id, user_id, name, status')
      .eq('id', siteId)
      .maybeSingle();

    if (siteError) throw siteError;
    if (!siteRow) {
      return res.status(404).json({ error: 'Site not found.' });
    }

    const role = await getUserRole(adminClient, user.id);
    if (role !== 'admin' && siteRow.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this site.' });
    }

    // Automatically make the site public when deploying
    const { error: publishError } = await adminClient
      .from('sites')
      .update({ is_public: true })
      .eq('id', siteId);

    if (publishError) throw publishError;

    const { data: existingDeployment, error: existingError } = await adminClient
      .from('site_deployments')
      .select('*')
      .eq('site_id', siteId)
      .maybeSingle();

    if (existingError && existingError.code === '42P01') {
      return res.status(500).json({ error: 'site_deployments table missing. Run latest Supabase migrations first.' });
    }
    if (existingError) throw existingError;

    const deploymentSlug = existingDeployment?.deployment_slug || makeDeploymentSlug(siteRow.name, siteRow.id);
    const rootDomain = getPlatformRootDomain();
    const subdomain = `${deploymentSlug}.${rootDomain}`;
    const usePathDeploymentUrl = shouldUsePathDeploymentUrl(rootDomain);
    const deploymentUrl = usePathDeploymentUrl
      ? getFallbackPreviewUrl(deploymentSlug)
      : `https://${subdomain}`;
    const now = new Date().toISOString();

    const initialPayload = {
      site_id: siteId,
      user_id: siteRow.user_id,
      deployment_slug: deploymentSlug,
      deployment_url: deploymentUrl,
      status: 'building',
      provider: 'vercel',
      environment: 'production',
      last_deployed_at: now,
      last_error: null,
      metadata: {
        ...(existingDeployment?.metadata || {}),
        fallback_preview_url: getFallbackPreviewUrl(deploymentSlug),
        routing_mode: usePathDeploymentUrl ? 'path_preview' : 'subdomain',
      },
    };

    const { data: deploymentRow, error: upsertError } = await adminClient
      .from('site_deployments')
      .upsert([initialPayload], { onConflict: 'site_id' })
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    let attachResult = {
      attached: false,
      verified: false,
      skipped: true,
      reason: 'No deployment action executed.',
    };

    if (!usePathDeploymentUrl && (action === 'redeploy' || action === 'attach_subdomain')) {
      attachResult = await attachDomainToVercel(subdomain);
    } else if (usePathDeploymentUrl) {
      attachResult = {
        attached: false,
        verified: false,
        skipped: true,
        reason: 'Path-based deployment URL used for vercel.app host.',
      };
    }

    const finalStatus = attachResult.attached || attachResult.skipped ? 'active' : 'failed';

    const { data: updatedDeployment, error: finalizeError } = await adminClient
      .from('site_deployments')
      .update({
        deployment_url: deploymentUrl,
        status: finalStatus,
        last_error: finalStatus === 'failed' ? attachResult.reason || 'Subdomain attach failed.' : null,
        metadata: {
          ...(deploymentRow?.metadata || {}),
          fallback_preview_url: getFallbackPreviewUrl(deploymentSlug),
          routing_mode: usePathDeploymentUrl ? 'path_preview' : 'subdomain',
          attach_result: attachResult,
        },
      })
      .eq('id', deploymentRow.id)
      .select('*')
      .single();

    if (finalizeError) throw finalizeError;

    await adminClient.from('audit_logs').insert([
      {
        user_id: user.id,
        action: action === 'attach_subdomain' ? 'attach_subdomain' : 'redeploy',
        entity_type: 'site_deployment',
        entity_id: updatedDeployment.id,
        details: {
          site_id: siteId,
          deployment_slug: deploymentSlug,
          deployment_url: deploymentUrl,
          attach_result: attachResult,
        },
      },
    ]);

    return res.status(200).json({
      ok: true,
      action,
      deployment: updatedDeployment,
      attachResult,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message || 'Deployment action failed.' });
  }
}

