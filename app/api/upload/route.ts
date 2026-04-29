import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { autoDetectColumns, parseNum, parseDate } from '../../../lib/analytics';

interface UploadRow {
  [key: string]: unknown;
}

interface ColumnMap {
  advertiser: string | null;
  campaign: string | null;
  campaign_id: string | null;
  ad_set: string | null;
  ad_set_id: string | null;
  date: string | null;
  spend: string | null;
  budget: string | null;
  impressions: string | null;
  clicks: string | null;
  ctr: string | null;
  conversions: string | null;
  revenue: string | null;
  roas: string | null;
  cpo: string | null;
  visits: string | null;
  cac: string | null;
  cpv: string | null;
}

export async function POST(req: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { portfolioId, rows, columnMap: providedMap, filename } = body as {
    portfolioId: string;
    rows: UploadRow[];
    columnMap?: Partial<ColumnMap>;
    filename?: string;
  };

  if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
  if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  // Verify portfolio belongs to user
  const { data: portfolio, error: portErr } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .eq('user_id', session.user.id)
    .single();

  if (portErr || !portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
  }

  // Auto-detect or use provided column map
  const headers = Object.keys(rows[0] || {});
  const detected = autoDetectColumns(headers);
  const colMap: ColumnMap = { ...detected, ...providedMap } as ColumnMap;

  // Create upload batch record
  const { data: batch, error: batchErr } = await supabase
    .from('upload_batches')
    .insert({
      user_id: session.user.id,
      portfolio_id: portfolioId,
      filename: filename || 'upload.csv',
      row_count: rows.length,
      status: 'processing',
      column_map: colMap,
    })
    .select('id')
    .single();

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });
  const batchId = batch.id;

  // ── Processing state ────────────────────────────────────────────────────
  const accountCache = new Map<string, string>(); // name → id
  const campaignCache = new Map<string, string>(); // accountId|name → id
  const adSetCache = new Map<string, string>();    // campaignId|name → id

  let accountsCreated = 0;
  let accountsUpdated = 0;
  let campaignsCreated = 0;
  let adSetsCreated = 0;
  let rowsProcessed = 0;
  let rowsSkipped = 0;
  const errors: string[] = [];

  const g = (row: UploadRow, col: string | null) =>
    col ? row[col] : undefined;

  for (const row of rows) {
    try {
      // ── Account ─────────────────────────────────────────────────────────
      const accountName = String(g(row, colMap.advertiser) || 'Default Account').trim();
      let accountId = accountCache.get(accountName);

      if (!accountId) {
        const { data: existing } = await supabase
          .from('accounts')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('user_id', session.user.id)
          .ilike('name', accountName)
          .maybeSingle();

        if (existing) {
          accountId = existing.id;
          accountsUpdated++;
        } else {
          const { data: created, error: createErr } = await supabase
            .from('accounts')
            .insert({
              portfolio_id: portfolioId,
              user_id: session.user.id,
              name: accountName,
              currency: 'USD',
            })
            .select('id')
            .single();

          if (createErr) throw new Error(`Account: ${createErr.message}`);
          accountId = created.id;
          accountsCreated++;
        }
        accountCache.set(accountName, accountId!);
      }

      // ── Campaign ─────────────────────────────────────────────────────────
      const campaignName = String(g(row, colMap.campaign) || 'Default Campaign').trim();
      const campaignExtId = colMap.campaign_id ? String(g(row, colMap.campaign_id) || '').trim() : '';
      const campaignKey = `${accountId}|${campaignName}`;
      let campaignId = campaignCache.get(campaignKey);

      if (!campaignId) {
        const { data: existingCamp } = await supabase
          .from('campaigns')
          .select('id')
          .eq('account_id', accountId)
          .ilike('name', campaignName)
          .maybeSingle();

        if (existingCamp) {
          campaignId = existingCamp.id;
        } else {
          const { data: created, error: cErr } = await supabase
            .from('campaigns')
            .insert({
              account_id: accountId,
              portfolio_id: portfolioId,
              user_id: session.user.id,
              name: campaignName,
              external_id: campaignExtId || null,
            })
            .select('id')
            .single();

          if (cErr) throw new Error(`Campaign: ${cErr.message}`);
          campaignId = created.id;
          campaignsCreated++;
        }
        campaignCache.set(campaignKey, campaignId!);
      }

      // ── Ad Set ───────────────────────────────────────────────────────────
      const adSetName = String(g(row, colMap.ad_set) || 'Default Ad Set').trim();
      const adSetExtId = colMap.ad_set_id ? String(g(row, colMap.ad_set_id) || '').trim() : '';
      const adSetKey = `${campaignId}|${adSetName}`;
      let adSetId = adSetCache.get(adSetKey);

      if (!adSetId) {
        const { data: existingAs } = await supabase
          .from('ad_sets')
          .select('id')
          .eq('campaign_id', campaignId)
          .ilike('name', adSetName)
          .maybeSingle();

        if (existingAs) {
          adSetId = existingAs.id;
        } else {
          const adSetBudget = colMap.budget ? parseNum(g(row, colMap.budget)) : 0;
          const { data: created, error: asErr } = await supabase
            .from('ad_sets')
            .insert({
              campaign_id: campaignId,
              account_id: accountId,
              portfolio_id: portfolioId,
              user_id: session.user.id,
              name: adSetName,
              external_id: adSetExtId || null,
              budget: adSetBudget || null,
            })
            .select('id')
            .single();

          if (asErr) throw new Error(`Ad Set: ${asErr.message}`);
          adSetId = created.id;
          adSetsCreated++;
        }
        adSetCache.set(adSetKey, adSetId!);
      }

      // ── Daily Metric ─────────────────────────────────────────────────────
      const rawDate = g(row, colMap.date);
      const rowDate = rawDate ? parseDate(rawDate) : new Date().toISOString().split('T')[0];

      if (!rowDate) {
        rowsSkipped++;
        continue;
      }

      const spend = parseNum(g(row, colMap.spend));
      const budget = parseNum(g(row, colMap.budget));
      const impressions = parseNum(g(row, colMap.impressions));
      const clicks = parseNum(g(row, colMap.clicks));
      const ctr = parseNum(g(row, colMap.ctr));
      const conversions = parseNum(g(row, colMap.conversions));
      const revenue = parseNum(g(row, colMap.revenue));
      const roas = parseNum(g(row, colMap.roas));
      const cpo = parseNum(g(row, colMap.cpo));
      const visits = parseNum(g(row, colMap.visits));
      const cac = parseNum(g(row, colMap.cac));
      const cpv = parseNum(g(row, colMap.cpv));

      const metricsPayload = {
        ad_set_id: adSetId,
        campaign_id: campaignId,
        account_id: accountId,
        portfolio_id: portfolioId,
        user_id: session.user.id,
        date: rowDate,
        spend, budget, impressions, clicks, ctr,
        conversions, revenue, roas, cpo, visits, cac, cpv,
        raw_data: row,
        upload_batch_id: batchId,
        updated_at: new Date().toISOString(),
      };

      // Upsert by (ad_set_id, date)
      const { error: metErr } = await supabase
        .from('daily_metrics')
        .upsert(metricsPayload, { onConflict: 'ad_set_id,date' });

      if (metErr) throw new Error(`Metrics: ${metErr.message}`);

      rowsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      rowsSkipped++;
      if (errors.length > 20) break; // cap error list
    }
  }

  // Mark batch done
  const summary = { accountsCreated, accountsUpdated, campaignsCreated, adSetsCreated, rowsProcessed, rowsSkipped, errors };
  await supabase
    .from('upload_batches')
    .update({ status: errors.length > 0 ? 'error' : 'done', summary })
    .eq('id', batchId);

  return NextResponse.json({ batchId, summary }, { status: 200 });
}

// GET — detect columns from a header list
export async function GET(req: NextRequest) {
  const headers = req.nextUrl.searchParams.get('headers');
  if (!headers) return NextResponse.json({ error: 'headers param required' }, { status: 400 });

  const headerList = headers.split(',').map(h => h.trim());
  const detected = autoDetectColumns(headerList);
  return NextResponse.json(detected);
}
