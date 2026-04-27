import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  clearDerivAuthParamsFromUrl,
  clearDerivOauthStorage,
  clearDerivSession,
  createDerivOauthRequest,
  DERIV_OAUTH_CODE_VERIFIER_KEY,
  DERIV_OAUTH_RETURN_PATH_KEY,
  DERIV_OAUTH_STATE_KEY,
  DerivAuthSession,
  DerivOauthAttribution,
  exchangeDerivAuthorizationCode,
  getDerivAuthDebugInfo,
  readDerivSession,
  readDerivStorageItem,
  removeDerivStorageItem,
  resolveDerivSessionFromToken,
  saveDerivSession,
  writeDerivStorageItem,
} from '../lib/derivAuth';

interface UseDerivOAuthOptions {
  siteId?: string;
  attribution?: DerivOauthAttribution;
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
}

function normalizeOAuthError(errorCode: string, errorDescription: string) {
  const code = String(errorCode || '').trim().toLowerCase();
  const description = String(errorDescription || '').trim();

  if (code === 'access_denied') {
    return description || 'Deriv sign-in was cancelled.';
  }

  if (code === 'invalid_request') {
    return description || 'Deriv sign-in request was rejected.';
  }

  return description || `Deriv sign-in failed${code ? ` (${code})` : ''}.`;
}

export function useDerivOAuth(options: UseDerivOAuthOptions = {}) {
  const { siteId, attribution } = options;
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<DerivAuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState(() => getDerivAuthDebugInfo(window.location.origin));

  const syncDerivIdentity = useCallback(async (verified: DerivAuthSession) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) return;

      await supabase
        .from('users')
        .update({
          deriv_loginid: verified.loginid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (!siteId) return;

      await supabase.from('deriv_client_attributions').upsert(
        [
          {
            user_id: user.id,
            site_id: siteId,
            client_loginid: verified.loginid,
            referral_code: attribution?.sidc || null,
            utm_source: attribution?.utm_source || null,
            utm_medium: attribution?.utm_medium || null,
            utm_campaign: attribution?.utm_campaign || null,
            source: 'oauth_pkce',
            is_active: true,
            last_seen_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'site_id,client_loginid' }
      );
    } catch (syncError) {
      console.error('Failed to sync Deriv identity', syncError);
    }
  }, [attribution, siteId]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const origin = window.location.origin;
      setDebugInfo(getDerivAuthDebugInfo(origin));
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const errorCode = String(params.get('error') || hashParams.get('error') || '').trim();
      const errorDescription = String(params.get('error_description') || hashParams.get('error_description') || '').trim();
      const authorizationCode = String(params.get('code') || hashParams.get('code') || '').trim();
      const returnedState = String(params.get('state') || hashParams.get('state') || '').trim();

      if (errorCode) {
        clearDerivAuthParamsFromUrl();
        if (!cancelled) {
          setError(normalizeOAuthError(errorCode, errorDescription));
          setLoading(false);
        }
        return;
      }

      if (authorizationCode) {
        const storedState = String(readDerivStorageItem(DERIV_OAUTH_STATE_KEY) || '').trim();
        const codeVerifier = String(readDerivStorageItem(DERIV_OAUTH_CODE_VERIFIER_KEY) || '').trim();

        if (!storedState || !returnedState || storedState !== returnedState) {
          removeDerivStorageItem(DERIV_OAUTH_STATE_KEY);
          removeDerivStorageItem(DERIV_OAUTH_CODE_VERIFIER_KEY);
          clearDerivAuthParamsFromUrl();
          if (!cancelled) {
            setSession(null);
            setError('Deriv sign-in could not be verified because the OAuth state did not match.');
            setLoading(false);
          }
          return;
        }

        if (!codeVerifier) {
          removeDerivStorageItem(DERIV_OAUTH_STATE_KEY);
          clearDerivAuthParamsFromUrl();
          if (!cancelled) {
            setSession(null);
            setError('Deriv sign-in could not continue because the PKCE verifier is missing.');
            setLoading(false);
          }
          return;
        }

        try {
          const tokenResult = await exchangeDerivAuthorizationCode({
            code: authorizationCode,
            codeVerifier,
            redirectUri: debugInfo.redirectUri || getDerivAuthDebugInfo(origin).redirectUri,
          });

          const verified = await resolveDerivSessionFromToken({
            accessToken: tokenResult.accessToken,
            origin,
          });

          saveDerivSession(verified);
          removeDerivStorageItem(DERIV_OAUTH_STATE_KEY);
          removeDerivStorageItem(DERIV_OAUTH_CODE_VERIFIER_KEY);
          clearDerivAuthParamsFromUrl();

          if (!cancelled) {
            setSession(verified);
            setError(null);
            setLoading(false);
          }

          void syncDerivIdentity(verified);
          return;
        } catch (oauthError) {
          clearDerivSession();
          removeDerivStorageItem(DERIV_OAUTH_STATE_KEY);
          removeDerivStorageItem(DERIV_OAUTH_CODE_VERIFIER_KEY);
          clearDerivAuthParamsFromUrl();

          if (!cancelled) {
            setSession(null);
            setError(parseErrorMessage(oauthError, 'Failed to complete Deriv OAuth sign in.'));
            setLoading(false);
          }
          return;
        }
      }

      const cached = readDerivSession();
      if (cached) {
        try {
          const verified = await resolveDerivSessionFromToken({
            accessToken: cached.accessToken,
            origin,
          });

          saveDerivSession(verified);
          if (!cancelled) {
            setSession(verified);
            setError(null);
            setLoading(false);
          }

          void syncDerivIdentity(verified);
        } catch {
          clearDerivSession();
          if (!cancelled) {
            setSession(null);
            setError('Stored Deriv session expired. Please log in again.');
            setLoading(false);
          }
        }
      } else {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [syncDerivIdentity]);

  const startOauth = useCallback(async (mode: 'login' | 'signup') => {
    setError(null);

    try {
      const request = await createDerivOauthRequest({
        mode,
        origin: window.location.origin,
        attribution,
      });

      writeDerivStorageItem(
        DERIV_OAUTH_RETURN_PATH_KEY,
        window.location.pathname + window.location.search
      );

      window.location.assign(request.url);
    } catch (oauthError) {
      setError(parseErrorMessage(oauthError, 'Could not start Deriv OAuth flow.'));
    }
  }, [attribution]);

  const logout = useCallback(() => {
    clearDerivSession();
    clearDerivOauthStorage();
    setSession(null);
    setError(null);
  }, []);

  return {
    loading,
    session,
    error,
    debugInfo,
    isAuthenticated: useMemo(() => Boolean(session?.loginid), [session]),
    login: useCallback(() => startOauth('login'), [startOauth]),
    signup: useCallback(() => startOauth('signup'), [startOauth]),
    logout,
    clearError: useCallback(() => setError(null), []),
  };
}
