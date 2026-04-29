import { supabase } from './supabase';

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the current user's Supabase JWT
 * to the Authorization header so API routes can validate it.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  });
}
