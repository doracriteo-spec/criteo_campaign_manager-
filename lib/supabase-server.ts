import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gjbnxjvumokctckkxuvh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a Supabase client authenticated as the requesting user.
 * Extracts the JWT from the Authorization header, validates it,
 * and returns a client + userId, or an error response.
 */
export async function getAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Use service role to validate the user's JWT
  const adminClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey || '');
  const { data: { user }, error } = await adminClient.auth.getUser(token);

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  // Create a client acting as this user (uses their RLS context)
  const userClient = createClient(supabaseUrl, supabaseAnonKey || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { client: userClient, userId: user.id };
}
