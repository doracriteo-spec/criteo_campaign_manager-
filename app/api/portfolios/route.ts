import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../lib/supabase-server';

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const { data, error } = await client
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const body = await req.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Portfolio name is required' }, { status: 400 });
  }

  const { data, error } = await client
    .from('portfolios')
    .insert({ user_id: userId, name: name.trim(), description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
