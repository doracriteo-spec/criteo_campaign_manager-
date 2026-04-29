import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../../lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const { data, error } = await client
    .from('accounts')
    .select(`
      *,
      campaigns (
        id, name, status, kpi, total_budget, start_date, end_date,
        ad_sets ( id, name, budget, status, start_date, end_date, optimizer, campaign_type, channel )
      ),
      account_notes ( * ),
      daily_metrics ( spend, budget, date, clicks, impressions, conversions, revenue, visits )
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
    .from('accounts')
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
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
