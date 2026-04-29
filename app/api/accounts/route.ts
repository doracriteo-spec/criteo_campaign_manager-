import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get('portfolioId');
  let query = supabase
    .from('accounts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('name');

  if (portfolioId) query = query.eq('portfolio_id', portfolioId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { portfolio_id, name, global_account, market, owner_as, currency,
          notes, goals, kpi_target, kpi_metric, client_context } = body;

  if (!portfolio_id || !name?.trim()) {
    return NextResponse.json({ error: 'portfolio_id and name are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('accounts')
    .upsert({
      portfolio_id,
      user_id: session.user.id,
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
