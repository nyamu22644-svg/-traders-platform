import { createClient } from '@supabase/supabase-js';
import { getEnv, getRequiredEnv } from './env.js';

let cachedAdminClient = null;

export function getSupabaseUrl() {
  return getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));
}

export function getSupabaseAnonKey() {
  return getEnv('SUPABASE_ANON_KEY', getEnv('VITE_SUPABASE_ANON_KEY'));
}

export function getSupabaseAdminClient() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = getSupabaseUrl();
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) for server APIs.');
  }

  cachedAdminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

function getAuthHeader(req) {
  return req.headers?.authorization || req.headers?.Authorization || '';
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function requireAuthenticatedUser(req) {
  const authorization = getAuthHeader(req);

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw createHttpError(401, 'Missing bearer token.');
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error('Server auth validation requires SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw createHttpError(401, 'Unauthorized request.');
  }

  return response.json();
}

export async function getUserRole(adminClient, userId) {
  const { data, error } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data?.role || 'user';
}
