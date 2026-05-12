/**
 * lib/glean-context.ts
 * Stores a structured CSV data summary in localStorage so the Glean agent
 * can be initialised with full campaign context on every chat open.
 */

export const GLEAN_CONTEXT_KEY = 'glean_csv_context';

export interface GleanCsvContext {
  uploadedAt: string;        // ISO timestamp
  filename: string;
  rowCount: number;
  dateRange: { from: string; to: string };
  accounts: string[];
  campaigns: string[];
  totals: {
    spend: number;
    budget: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    visits: number;
  };
  derived: {
    ctr: string;
    cpc: string;
    cpa: string;
    roas: string;
  };
  topSpenders: Array<{ name: string; spend: number }>;
  currency: string;
}

/** Build a context object from raw CSV rows */
export function buildGleanContext(
  rows: Record<string, unknown>[],
  filename: string,
  colMap: Record<string, string | null>
): GleanCsvContext {
  const g = (row: Record<string, unknown>, col: string | null) =>
    col ? row[col] : undefined;

  const parseNum = (v: unknown) => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[$,€£%\s]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  const accountSet = new Set<string>();
  const campaignSet = new Set<string>();
  const dates: string[] = [];
  const spendByAccount: Record<string, number> = {};

  let spend = 0, budget = 0, impressions = 0, clicks = 0,
    conversions = 0, revenue = 0, visits = 0;

  for (const row of rows) {
    const acct = String(g(row, colMap.advertiser) ?? 'Unknown').trim();
    const camp = String(g(row, colMap.campaign) ?? 'Unknown').trim();
    const date = String(g(row, colMap.date) ?? '').trim();

    accountSet.add(acct);
    campaignSet.add(camp);
    if (date) dates.push(date);

    const s = parseNum(g(row, colMap.spend));
    spend += s;
    budget += parseNum(g(row, colMap.budget));
    impressions += parseNum(g(row, colMap.impressions));
    clicks += parseNum(g(row, colMap.clicks));
    conversions += parseNum(g(row, colMap.conversions));
    revenue += parseNum(g(row, colMap.revenue));
    visits += parseNum(g(row, colMap.visits));
    spendByAccount[acct] = (spendByAccount[acct] ?? 0) + s;
  }

  dates.sort();
  const topSpenders = Object.entries(spendByAccount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, s]) => ({ name, spend: Math.round(s) }));

  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : 'N/A';
  const cpc = clicks > 0 ? '$' + (spend / clicks).toFixed(2) : 'N/A';
  const cpa = conversions > 0 ? '$' + (spend / conversions).toFixed(2) : 'N/A';
  const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : 'N/A';

  return {
    uploadedAt: new Date().toISOString(),
    filename,
    rowCount: rows.length,
    dateRange: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
    accounts: [...accountSet].slice(0, 20),
    campaigns: [...campaignSet].slice(0, 30),
    totals: {
      spend: Math.round(spend),
      budget: Math.round(budget),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      revenue: Math.round(revenue),
      visits: Math.round(visits),
    },
    derived: { ctr, cpc, cpa, roas },
    topSpenders,
    currency: 'USD',
  };
}

/** Save context to localStorage */
export function saveGleanContext(ctx: GleanCsvContext) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GLEAN_CONTEXT_KEY, JSON.stringify(ctx));
}

/** Load context from localStorage */
export function loadGleanContext(): GleanCsvContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GLEAN_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Render the context as a human-readable prompt string for the Glean agent */
export function formatContextAsPrompt(ctx: GleanCsvContext): string {
  const t = ctx.totals;
  const fmt = (n: number) => n.toLocaleString();

  const lines = [
    `## Campaign Data Context (uploaded: ${new Date(ctx.uploadedAt).toLocaleDateString()})`,
    `**File:** ${ctx.filename} · **Rows:** ${fmt(ctx.rowCount)}`,
    `**Date Range:** ${ctx.dateRange.from} to ${ctx.dateRange.to}`,
    `**Accounts (${ctx.accounts.length}):** ${ctx.accounts.slice(0, 8).join(', ')}${ctx.accounts.length > 8 ? '…' : ''}`,
    `**Campaigns (${ctx.campaigns.length}):** ${ctx.campaigns.slice(0, 6).join(', ')}${ctx.campaigns.length > 6 ? '…' : ''}`,
    ``,
    `### Aggregate Performance`,
    `- Total Spend: $${fmt(t.spend)}`,
    `- Total Budget: ${t.budget > 0 ? '$' + fmt(t.budget) : 'Not in file'}`,
    `- Impressions: ${fmt(t.impressions)}`,
    `- Clicks: ${fmt(t.clicks)}`,
    `- Conversions: ${fmt(t.conversions)}`,
    `- Revenue: $${fmt(t.revenue)}`,
    `- Visits: ${fmt(t.visits)}`,
    ``,
    `### Key Metrics`,
    `- CTR: ${ctx.derived.ctr}`,
    `- CPC: ${ctx.derived.cpc}`,
    `- CPA: ${ctx.derived.cpa}`,
    `- ROAS: ${ctx.derived.roas}`,
    ``,
    `### Top Spenders`,
    ...ctx.topSpenders.map((s, i) => `${i + 1}. ${s.name}: $${fmt(s.spend)}`),
    ``,
    `Please use the data above to answer questions about this campaign. Prioritise insights from this dataset.`,
  ];

  return lines.join('\n');
}
