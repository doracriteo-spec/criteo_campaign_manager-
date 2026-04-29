import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../lib/supabase-server';

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const accountId = req.nextUrl.searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const { data, error } = await client
    .from('account_notes')
    .select('*')
    .eq('account_id', accountId)
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
  const { account_id, portfolio_id, content, type, owner, status, due_date } = body;

  if (!account_id || !content?.trim()) {
    return NextResponse.json({ error: 'account_id and content required' }, { status: 400 });
  }

  const { data, error } = await client
    .from('account_notes')
    .insert({
      account_id,
      portfolio_id,
      user_id: userId,
      content: content.trim(),
      type: type || 'note',
      owner,
      status: status || 'open',
      due_date: due_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await client
    .from('account_notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await client
    .from('account_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
