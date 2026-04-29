import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../../lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const { data, error } = await client
    .from('portfolios')
    .select(`
      *,
      accounts (
        id, name, global_account, market, owner_as, currency,
        kpi_target, kpi_metric, goals,
        daily_metrics ( spend, budget, date )
      )
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const body = await req.json();
  const { data, error } = await client
    .from('portfolios')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const { error } = await client
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
