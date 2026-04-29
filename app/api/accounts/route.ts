import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../lib/supabase-server';

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const portfolioId = req.nextUrl.searchParams.get('portfolioId');
  let query = client
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (portfolioId) query = query.eq('portfolio_id', portfolioId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedClient(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  const body = await req.json();
  const { portfolio_id, name, global_account, market, owner_as, currency,
          notes, goals, kpi_target, kpi_metric, client_context } = body;

  if (!portfolio_id || !name?.trim()) {
    return NextResponse.json({ error: 'portfolio_id and name are required' }, { status: 400 });
  }

  const { data, error } = await client
    .from('accounts')
    .upsert({
      portfolio_id,
      user_id: userId,
      name: name.trim(),
      global_account, market, owner_as,
      currency: currency || 'USD',
      notes, goals, kpi_target, kpi_metric, client_context,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'portfolio_id,name' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
