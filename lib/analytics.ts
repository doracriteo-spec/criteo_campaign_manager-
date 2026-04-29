/**
 * lib/analytics.ts
 * Centralized, pure pacing / KPI calculation functions.
 * No UI imports. No side effects. Fully testable.
 */

export type PacingStatus =
  | 'On Track'
  | 'Underpacing'
  | 'Overpacing'
  | 'Critical Underpacing'
  | 'Critical Overpacing'
  | 'No Budget Set'
  | 'Flight Ended';

export interface PacingResult {
  status: PacingStatus;
  ratio: number;           // actual / expected  (1.0 = perfect)
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
  expectedSpend: number;   // what should have been spent by now
  actualSpend: number;
  projectedSpend: number;  // run-rate extrapolated to end of flight
  projectedVariance: number; // projectedSpend - budget  (negative = underspend)
  dailyRunRate: number;
  dailyBudgetRequired: number; // to exhaust remaining budget in remaining days
  hasBudget: boolean;
  flightProgress: number;  // 0-1
}

export interface MoMResult {
  current: number;
  previous: number;
  absoluteChange: number;
  percentChange: number;
  trend: 'up' | 'down' | 'flat';
}

export interface AdSetPacingRow {
  id: string;
  name: string;
  campaignName: string;
  status: string;
  startDate: string;
  endDate: string;
  budget: number;
  totalSpend: number;
  yesterdaySpend: number;
  pacing: PacingResult;
  kpiMetrics: Record<string, number>;
  comments: string;
  optimizer: string;
  campaignType: string;
  channel: string;
}

// ─── Core pacing calculation ────────────────────────────────────────────────

export function calculatePacing(
  budget: number,
  actualSpend: number,
  startDate: string,
  endDate: string,
  today: Date = new Date()
): PacingResult {
  const hasBudget = budget > 0;

  let elapsedDays = 0;
  let remainingDays = 0;
  let totalDays = 1;
  let flightProgress = 0;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const todayMs = today.getTime();

    totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    elapsedDays = Math.max(0, Math.min(totalDays, Math.round((todayMs - start.getTime()) / 86_400_000)));
    remainingDays = Math.max(0, totalDays - elapsedDays);
    flightProgress = elapsedDays / totalDays;
  }

  const dailyRunRate = elapsedDays > 0 ? actualSpend / elapsedDays : 0;
  const projectedSpend = dailyRunRate * totalDays;
  const projectedVariance = hasBudget ? projectedSpend - budget : 0;

  const expectedSpend = hasBudget && totalDays > 0
    ? (elapsedDays / totalDays) * budget
    : 0;

  const ratio = hasBudget && expectedSpend > 0 ? actualSpend / expectedSpend : 0;

  const dailyBudgetRequired =
    hasBudget && remainingDays > 0
      ? Math.max(0, (budget - actualSpend) / remainingDays)
      : 0;

  let status: PacingStatus = 'No Budget Set';
  if (hasBudget) {
    if (remainingDays === 0 && elapsedDays >= totalDays) {
      status = 'Flight Ended';
    } else if (ratio < 0.7) {
      status = 'Critical Underpacing';
    } else if (ratio < 0.9) {
      status = 'Underpacing';
    } else if (ratio > 1.3) {
      status = 'Critical Overpacing';
    } else if (ratio > 1.1) {
      status = 'Overpacing';
    } else {
      status = 'On Track';
    }
  }

  return {
    status,
    ratio: round2(ratio),
    elapsedDays,
    remainingDays,
    totalDays,
    expectedSpend: round2(expectedSpend),
    actualSpend: round2(actualSpend),
    projectedSpend: round2(projectedSpend),
    projectedVariance: round2(projectedVariance),
    dailyRunRate: round2(dailyRunRate),
    dailyBudgetRequired: round2(dailyBudgetRequired),
    hasBudget,
    flightProgress: round2(flightProgress),
  };
}

export function getPacingColor(status: PacingStatus): string {
  switch (status) {
    case 'On Track':              return 'success';
    case 'Underpacing':           return 'warning';
    case 'Critical Underpacing':  return 'danger';
    case 'Overpacing':            return 'warning';
    case 'Critical Overpacing':   return 'danger';
    case 'Flight Ended':          return 'info';
    default:                      return 'info';
  }
}

// ─── Period-over-period comparison ──────────────────────────────────────────

export function comparePeriods(current: number, previous: number): MoMResult {
  const absoluteChange = current - previous;
  const percentChange = previous !== 0 ? (absoluteChange / Math.abs(previous)) * 100 : 0;
  const trend: 'up' | 'down' | 'flat' =
    percentChange > 2 ? 'up' : percentChange < -2 ? 'down' : 'flat';
  return {
    current: round2(current),
    previous: round2(previous),
    absoluteChange: round2(absoluteChange),
    percentChange: round2(percentChange),
    trend,
  };
}

// ─── Column detection (CSV mapping) ─────────────────────────────────────────

export const COLUMN_PATTERNS: Record<string, string[]> = {
  advertiser:   ['advertiser', 'account', 'client', 'customer'],
  campaign:     ['campaign name', 'campaign_name', 'campaign'],
  campaign_id:  ['campaign id', 'campaign_id'],
  ad_set:       ['ad set', 'adset', 'ad_set', 'adgroup', 'ad group', 'line item'],
  ad_set_id:    ['ad set id', 'adset_id', 'ad_set_id'],
  date:         ['date', 'day', 'period', 'report_date'],
  spend:        ['spend', 'cost', 'budget_spent', 'amount spent', 'total spend'],
  budget:       ['budget', 'daily budget', 'campaign budget'],
  impressions:  ['impression', 'impressions', 'imps', 'displays'],
  clicks:       ['click', 'clicks'],
  ctr:          ['ctr', 'click-through rate', 'click through'],
  conversions:  ['conversion', 'conversions', 'sale', 'sales', 'order', 'orders', 'purchase'],
  revenue:      ['revenue', 'rev', 'value', 'order_value', 'sales value'],
  roas:         ['roas', 'return on ad spend'],
  cpo:          ['cpo', 'cost per order', 'cost per purchase'],
  visits:       ['visit', 'visits', 'session', 'sessions', 'landing'],
  cac:          ['cac', 'cost per acquisition', 'customer acquisition'],
  cpv:          ['cpv', 'cost per view', 'cost per visit'],
};

export function autoDetectColumns(
  headers: string[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    let found: string | null = null;
    for (const pattern of patterns) {
      const idx = lowerHeaders.findIndex(
        h => h === pattern || h.includes(pattern)
      );
      if (idx !== -1) {
        found = headers[idx];
        break;
      }
    }
    result[field] = found;
  }
  return result;
}

// ─── Portfolio-level aggregation ─────────────────────────────────────────────

export interface PortfolioSummary {
  totalBudget: number;
  totalSpend: number;
  remainingBudget: number;
  spendPct: number;
  pacingStatus: PacingStatus;
  underpacingCount: number;
  overpacingCount: number;
  onTrackCount: number;
  noBudgetCount: number;
  accountCount: number;
}

export function summarizePortfolio(
  accounts: Array<{
    budget: number;
    spend: number;
    startDate: string;
    endDate: string;
  }>
): PortfolioSummary {
  let totalBudget = 0;
  let totalSpend = 0;
  let underpacingCount = 0;
  let overpacingCount = 0;
  let onTrackCount = 0;
  let noBudgetCount = 0;

  for (const acct of accounts) {
    totalBudget += acct.budget || 0;
    totalSpend += acct.spend || 0;
    const p = calculatePacing(acct.budget, acct.spend, acct.startDate, acct.endDate);
    if (!p.hasBudget) noBudgetCount++;
    else if (p.status.includes('Underpacing')) underpacingCount++;
    else if (p.status.includes('Overpacing')) overpacingCount++;
    else onTrackCount++;
  }

  const remainingBudget = totalBudget - totalSpend;
  const spendPct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  // Portfolio-level pacing (simplified)
  let pacingStatus: PacingStatus = 'No Budget Set';
  if (totalBudget > 0) {
    const ratio = spendPct / 100; // rough — real ratio needs dates
    if (underpacingCount > overpacingCount) pacingStatus = 'Underpacing';
    else if (overpacingCount > underpacingCount) pacingStatus = 'Overpacing';
    else pacingStatus = 'On Track';
  }

  return {
    totalBudget: round2(totalBudget),
    totalSpend: round2(totalSpend),
    remainingBudget: round2(remainingBudget),
    spendPct: round2(spendPct),
    pacingStatus,
    underpacingCount,
    overpacingCount,
    onTrackCount,
    noBudgetCount,
    accountCount: accounts.length,
  };
}

// ─── Number parsing ──────────────────────────────────────────────────────────

export function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,€£¥%\s]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function parseDate(val: unknown): string {
  if (!val) return '';
  try {
    const d = new Date(String(val));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return String(val);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export original analyzer types for backward compat
export type { BulkAnalysisResult, AnalysisNode, CampaignContext, DetectedHierarchy } from './analyzer';
export { bulkAnalyzeCampaigns, detectHierarchy } from './analyzer';
