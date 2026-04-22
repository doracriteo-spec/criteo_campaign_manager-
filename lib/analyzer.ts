export interface CampaignContext {
  account_name: string;
  region: string;
  currency: string;
  kpi: string;
  total_budget: number; // fallback/global
  start_date: string;
  end_date: string;
  ad_set_budgets: Record<string, number>; // key: "Advertiser|Campaign|AdSet", value: budget
}

export interface PacingAnalysis {
  elapsed_days: number;
  remaining_days: number;
  total_days: number;
  expected_spend: number;
  actual_spend: number;
  pacing_ratio: number;
  pacing_status: 'On Track' | 'Underpacing' | 'Overpacing' | 'Critical Underpacing' | 'Critical Overpacing' | 'No Budget Set';
  projected_total_spend: number;
  projected_underspend: number;
  has_budget: boolean;
}

export interface KPIPerformance {
  kpi_name: string;
  kpi_value: number;
  kpi_trend: 'Improving' | 'Stable' | 'Declining';
  secondary_metrics: Record<string, number>;
}

export interface Risk {
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface Recommendation {
  priority: number;
  action: string;
  reason: string;
  impact: 'High' | 'Medium' | 'Low';
  category?: 'pacing' | 'budget' | 'targeting' | 'creative' | 'general';
}

export interface AnalysisNode {
  id: string; // unique ID for selection
  level: 'advertiser' | 'campaign' | 'ad_set';
  name: string;
  advertiser_name: string;
  campaign_name?: string;
  parent_name?: string;
  
  health_summary: string;
  pacing: PacingAnalysis;
  kpi_performance: KPIPerformance;
  risks: Risk[];
  recommendations: Recommendation[];
  pacing_recommendations: Recommendation[];
  daily_data: { date: string; spend: number; kpi_value: number }[];
  optimizer_type: string;
  row_count: number;
  
  children: AnalysisNode[];
}

export type AnalysisResult = AnalysisNode;

export interface BulkAnalysisResult {
  nodes: AnalysisNode[]; // Root level nodes (advertisers or fallback)
  summary: {
    total_accounts: number;
    total_spend: number;
    total_budget: number;
    overall_pacing: number;
    total_rows: number;
  };
}

export interface DetectedHierarchy {
  advertiser: string;
  campaign: string;
  ad_set: string;
  id: string;
}

function detectOptimizer(rows: Record<string, unknown>[]): string {
  const cols = Object.keys(rows[0] || {}).map(c => c.toLowerCase());
  if (cols.some(c => c.includes('roas') || c.includes('revenue'))) return 'Revenue / ROAS Optimizer';
  if (cols.some(c => c.includes('conversion') || c.includes('sale'))) return 'Conversion Optimizer (CPA)';
  if (cols.some(c => c.includes('visit'))) return 'Visit / Traffic Optimizer';
  if (cols.some(c => c.includes('cpm') || c.includes('impression'))) return 'Impression-based (CPM)';
  return 'Click Optimizer (CPC)';
}

function findColumn(cols: string[], patterns: string[]): string | null {
  for (const p of patterns) {
    const found = cols.find(c => c.toLowerCase().includes(p.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function num(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,€£¥%]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function detectHierarchy(rows: Record<string, unknown>[]): DetectedHierarchy[] {
  const cols = Object.keys(rows[0] || {});
  const advertiserCol = findColumn(cols, ['advertiser', 'account', 'client', 'customer']);
  const campaignCol = findColumn(cols, ['campaign', 'campaign_name', 'campaign name']);
  const adSetCol = findColumn(cols, ['ad set', 'adset', 'ad_set', 'adgroup', 'ad group']);

  const map = new Map<string, DetectedHierarchy>();

  for (const row of rows) {
    const adv = advertiserCol ? String(row[advertiserCol] || 'Unknown Advertiser').trim() : 'Default Advertiser';
    const camp = campaignCol ? String(row[campaignCol] || 'Unknown Campaign').trim() : 'Default Campaign';
    const adSet = adSetCol ? String(row[adSetCol] || 'Unknown Ad Set').trim() : 'Default Ad Set';

    // Only add if we actually have columns for them, to avoid creating fake hierarchy
    if (advertiserCol || campaignCol || adSetCol) {
       const id = `${adv}|${camp}|${adSet}`;
       if (!map.has(id)) {
         map.set(id, { advertiser: adv, campaign: camp, ad_set: adSet, id });
       }
    }
  }

  return Array.from(map.values());
}

function generatePacingRecommendations(
  pacingRatio: number,
  hasBudget: boolean,
  totalSpend: number,
  totalClicks: number,
  totalImps: number,
  totalConv: number,
  totalRevenue: number,
  kpiTrend: string,
  dailyRunRate: number,
  ctx: CampaignContext,
  level: string
): Recommendation[] {
  const recs: Recommendation[] = [];
  const entityName = level === 'ad_set' ? 'ad set' : level === 'campaign' ? 'campaign' : 'advertiser';

  if (hasBudget && pacingRatio < 0.9) {
    recs.push({
      priority: 1,
      action: `Increase daily budget caps by 20-30% for this ${entityName}`,
      reason: `Current pacing at ${Math.round(pacingRatio * 100)}% indicates significant underdelivery.`,
      impact: 'High',
      category: 'budget'
    });
    if (level === 'ad_set') {
      recs.push({
        priority: 2,
        action: 'Expand audience targeting or increase bid caps',
        reason: 'Narrow targeting or low bids limit inventory for this specific ad set.',
        impact: 'Medium',
        category: 'targeting'
      });
    } else {
      recs.push({
        priority: 2,
        action: 'Reallocate budget to under-pacing ad sets',
        reason: 'Shift funds to ad sets with room to scale.',
        impact: 'High',
        category: 'budget'
      });
    }
  } else if (hasBudget && pacingRatio > 1.1) {
    recs.push({
      priority: 1,
      action: `Reduce daily budget caps by 15-25% for this ${entityName}`,
      reason: `Overpacing at ${Math.round(pacingRatio * 100)}% will exhaust budget early.`,
      impact: 'High',
      category: 'budget'
    });
    if (level === 'ad_set') {
      recs.push({
        priority: 2,
        action: 'Tighten targeting to focus on highest-value users',
        reason: 'Reduce impression volume while improving efficiency.',
        impact: 'Medium',
        category: 'targeting'
      });
    }
  }

  if (totalImps > 0 && totalClicks / totalImps < 0.002) {
    recs.push({
      priority: recs.length + 1,
      action: `Refresh creatives in this ${entityName}`,
      reason: `CTR of ${((totalClicks / totalImps) * 100).toFixed(2)}% is below benchmark.`,
      impact: 'Medium',
      category: 'creative'
    });
  }

  if (totalConv > 0 && totalSpend > 0) {
    if (totalRevenue > 0 && totalRevenue / totalSpend < 1) {
      recs.push({
        priority: recs.length + 1,
        action: `Optimize ${entityName} toward higher-ROAS segments`,
        reason: `Current ROAS is ${(totalRevenue / totalSpend).toFixed(2)}x.`,
        impact: 'High',
        category: 'targeting'
      });
    }
  }

  if (!hasBudget) {
    recs.push({
      priority: 1,
      action: `Set a budget for this ${entityName} to enable pacing analysis`,
      reason: 'Pacing ratios and spend projections require a defined budget.',
      impact: 'Medium',
      category: 'budget'
    });
  }

  return recs;
}

function processNodeAnalysis(
  ctx: CampaignContext,
  rows: Record<string, unknown>[],
  level: 'advertiser' | 'campaign' | 'ad_set',
  name: string,
  id: string,
  advertiser_name: string,
  campaign_name?: string,
  parent_name?: string
): Omit<AnalysisNode, 'children'> {
  const cols = Object.keys(rows[0] || {});
  const optimizer = detectOptimizer(rows);

  const dateCol = findColumn(cols, ['date', 'day', 'period']);
  const spendCol = findColumn(cols, ['spend', 'cost', 'budget_spent', 'amount']);
  const clickCol = findColumn(cols, ['click', 'clicks']);
  const impCol = findColumn(cols, ['impression', 'impressions', 'imps']);
  const convCol = findColumn(cols, ['conversion', 'conversions', 'sale', 'sales', 'order', 'orders']);
  const revenueCol = findColumn(cols, ['revenue', 'rev', 'value', 'order_value']);
  const visitCol = findColumn(cols, ['visit', 'visits', 'session', 'sessions']);

  let totalSpend = 0, totalClicks = 0, totalImps = 0, totalConv = 0, totalRevenue = 0, totalVisits = 0;
  
  // Aggregate daily data
  const dateMap = new Map<string, { spend: number; kpi_value: number }>();

  for (const row of rows) {
    const spend = spendCol ? num(row[spendCol]) : 0;
    totalSpend += spend;
    totalClicks += clickCol ? num(row[clickCol]) : 0;
    totalImps += impCol ? num(row[impCol]) : 0;
    totalConv += convCol ? num(row[convCol]) : 0;
    totalRevenue += revenueCol ? num(row[revenueCol]) : 0;
    totalVisits += visitCol ? num(row[visitCol]) : 0;

    let kpiVal = 0;
    const kpiLower = ctx.kpi.toLowerCase();
    if (kpiLower.includes('roas') || kpiLower.includes('revenue')) kpiVal = revenueCol ? num(row[revenueCol]) : 0;
    else if (kpiLower.includes('sale') || kpiLower.includes('conversion')) kpiVal = convCol ? num(row[convCol]) : 0;
    else if (kpiLower.includes('visit')) kpiVal = visitCol ? num(row[visitCol]) : 0;
    else if (kpiLower.includes('click')) kpiVal = clickCol ? num(row[clickCol]) : 0;
    else kpiVal = spend;

    const date = dateCol ? String(row[dateCol]) : 'Unknown';
    if (!dateMap.has(date)) {
      dateMap.set(date, { spend: 0, kpi_value: 0 });
    }
    const d = dateMap.get(date)!;
    d.spend += spend;
    d.kpi_value += kpiVal;
  }

  const dailyData = Array.from(dateMap.entries()).map(([date, vals]) => ({ date, ...vals }));
  if (dateCol) dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine Budget
  let budget = 0;
  if (level === 'ad_set') {
    budget = ctx.ad_set_budgets[id] || 0;
  } else if (level === 'advertiser' && Object.keys(ctx.ad_set_budgets).length === 0) {
    budget = ctx.total_budget;
  } else if (level === 'advertiser' || level === 'campaign') {
    // sum up child ad set budgets if available
    budget = Object.entries(ctx.ad_set_budgets)
      .filter(([k]) => k.startsWith(id + '|') || (level==='advertiser' && k.startsWith(advertiser_name + '|')))
      .reduce((sum, [_, b]) => sum + b, 0);
    
    // If no ad set budgets were set, fallback to total_budget for advertiser
    if (budget === 0 && level === 'advertiser') budget = ctx.total_budget;
  }

  const hasBudget = budget > 0;
  const hasDates = !!ctx.start_date && !!ctx.end_date;
  
  let elapsedDays = 0, remainingDays = 0, totalDays = 0, expectedSpend = 0, pacingRatio = 0;
  
  if (hasDates) {
    const start = new Date(ctx.start_date);
    const end = new Date(ctx.end_date);
    const now = new Date();
    totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
    remainingDays = Math.max(0, totalDays - elapsedDays);
  } else if (dateCol && dailyData.length >= 2 && dailyData[0].date !== 'Unknown') {
    totalDays = dailyData.length;
    elapsedDays = dailyData.length;
    remainingDays = 0;
  } else {
    totalDays = 1;
    elapsedDays = 1;
  }

  if (hasBudget) {
    expectedSpend = totalDays > 0 ? (elapsedDays / totalDays) * budget : budget;
    pacingRatio = expectedSpend > 0 ? totalSpend / expectedSpend : 0;
  }

  let pacingStatus: PacingAnalysis['pacing_status'] = hasBudget ? 'On Track' : 'No Budget Set';
  if (hasBudget) {
    if (pacingRatio < 0.7) pacingStatus = 'Critical Underpacing';
    else if (pacingRatio < 0.9) pacingStatus = 'Underpacing';
    else if (pacingRatio > 1.3) pacingStatus = 'Critical Overpacing';
    else if (pacingRatio > 1.1) pacingStatus = 'Overpacing';
  }

  const dailyRunRate = elapsedDays > 0 ? totalSpend / elapsedDays : 0;
  const projectedTotalSpend = dailyRunRate * totalDays;
  const projectedUnderspend = hasBudget ? Math.max(0, budget - projectedTotalSpend) : 0;

  const pacing: PacingAnalysis = {
    elapsed_days: elapsedDays,
    remaining_days: remainingDays,
    total_days: totalDays,
    expected_spend: Math.round(expectedSpend * 100) / 100,
    actual_spend: Math.round(totalSpend * 100) / 100,
    pacing_ratio: Math.round(pacingRatio * 100) / 100,
    pacing_status: pacingStatus,
    projected_total_spend: Math.round(projectedTotalSpend * 100) / 100,
    projected_underspend: Math.round(projectedUnderspend * 100) / 100,
    has_budget: hasBudget,
  };

  // KPI
  const kpiLower = ctx.kpi.toLowerCase();
  let kpiValue = 0;
  const secondaryMetrics: Record<string, number> = {};

  if (kpiLower.includes('roas')) {
    kpiValue = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
    secondaryMetrics['Total Revenue'] = Math.round(totalRevenue * 100) / 100;
  } else if (kpiLower.includes('revenue')) {
    kpiValue = Math.round(totalRevenue * 100) / 100;
    secondaryMetrics['ROAS'] = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
  } else if (kpiLower.includes('sale') || kpiLower.includes('conversion')) {
    kpiValue = totalConv;
    secondaryMetrics['CPA'] = totalConv > 0 ? Math.round((totalSpend / totalConv) * 100) / 100 : 0;
  } else if (kpiLower.includes('visit')) {
    kpiValue = totalVisits;
    secondaryMetrics['Cost per Visit'] = totalVisits > 0 ? Math.round((totalSpend / totalVisits) * 100) / 100 : 0;
  } else if (kpiLower.includes('click')) {
    kpiValue = totalClicks;
    secondaryMetrics['CPC'] = totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0;
  } else {
    kpiValue = totalSpend;
  }

  secondaryMetrics['Impressions'] = totalImps;
  secondaryMetrics['Clicks'] = totalClicks;
  if (totalConv > 0) secondaryMetrics['Conversions'] = totalConv;
  if (!secondaryMetrics['CTR'] && totalImps > 0) secondaryMetrics['CTR'] = Math.round((totalClicks / totalImps) * 10000) / 100;

  // Trend
  const half = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, half);
  const secondHalf = dailyData.slice(half);
  const avgFirst = firstHalf.reduce((s, d) => s + d.kpi_value, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((s, d) => s + d.kpi_value, 0) / (secondHalf.length || 1);
  let kpiTrend: KPIPerformance['kpi_trend'] = 'Stable';
  if (avgSecond > avgFirst * 1.1) kpiTrend = 'Improving';
  else if (avgSecond < avgFirst * 0.9) kpiTrend = 'Declining';

  // Recommendations
  const pacingRecs = generatePacingRecommendations(
    pacingRatio, hasBudget, totalSpend, totalClicks, totalImps, totalConv, totalRevenue, kpiTrend, dailyRunRate, ctx, level
  );

  const risks: Risk[] = [];
  if (hasBudget && pacingStatus.includes('Underpacing')) risks.push({ severity: pacingStatus === 'Critical Underpacing' ? 'high' : 'medium', title: 'Underdelivery', description: `Pacing at ${Math.round(pacingRatio * 100)}%.` });
  if (hasBudget && pacingStatus.includes('Overpacing')) risks.push({ severity: pacingStatus === 'Critical Overpacing' ? 'high' : 'medium', title: 'Overdelivery', description: `Pacing at ${Math.round(pacingRatio * 100)}%.` });
  if (kpiTrend === 'Declining') risks.push({ severity: 'medium', title: 'KPI Declining', description: 'Performance trending down recently.' });

  return {
    id,
    level,
    name,
    advertiser_name,
    campaign_name,
    parent_name,
    health_summary: `${name} (${level}) has spent ${ctx.currency}${totalSpend.toLocaleString()} ${hasBudget ? `of ${ctx.currency}${budget.toLocaleString()}` : ''}.`,
    pacing,
    kpi_performance: { kpi_name: ctx.kpi, kpi_value: kpiValue, kpi_trend: kpiTrend, secondary_metrics: secondaryMetrics },
    risks,
    recommendations: [], // Can populate general ones here
    pacing_recommendations: pacingRecs,
    daily_data: dailyData,
    optimizer_type: optimizer,
    row_count: rows.length,
  };
}

export function bulkAnalyzeCampaigns(ctx: CampaignContext, rows: Record<string, unknown>[]): BulkAnalysisResult {
  const cols = Object.keys(rows[0] || {});
  const advertiserCol = findColumn(cols, ['advertiser', 'account', 'client', 'customer']);
  const campaignCol = findColumn(cols, ['campaign', 'campaign_name', 'campaign name']);
  const adSetCol = findColumn(cols, ['ad set', 'adset', 'ad_set', 'adgroup', 'ad group']);

  const nodes: AnalysisNode[] = [];
  let totalSpend = 0;

  // If no hierarchy columns, just do a single root node
  if (!advertiserCol && !campaignCol && !adSetCol) {
    const root = processNodeAnalysis(ctx, rows, 'advertiser', ctx.account_name || 'All Data', 'root', ctx.account_name || 'All Data');
    totalSpend = root.pacing.actual_spend;
    nodes.push({ ...root, children: [] });
  } else {
    // Group by Advertiser -> Campaign -> Ad Set
    const advMap = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const adv = advertiserCol ? String(row[advertiserCol]).trim() : 'Default Advertiser';
      if (!advMap.has(adv)) advMap.set(adv, []);
      advMap.get(adv)!.push(row);
    }

    for (const [advName, advRows] of advMap.entries()) {
      const advNodeData = processNodeAnalysis(ctx, advRows, 'advertiser', advName, advName, advName, undefined, undefined);
      const advNode: AnalysisNode = { ...advNodeData, children: [] };
      totalSpend += advNode.pacing.actual_spend;

      const campMap = new Map<string, Record<string, unknown>[]>();
      for (const row of advRows) {
        const camp = campaignCol ? String(row[campaignCol]).trim() : 'Default Campaign';
        if (!campMap.has(camp)) campMap.set(camp, []);
        campMap.get(camp)!.push(row);
      }

      for (const [campName, campRows] of campMap.entries()) {
        const campId = `${advName}|${campName}`;
        const campNodeData = processNodeAnalysis(ctx, campRows, 'campaign', campName, campId, advName, campName, advName);
        const campNode: AnalysisNode = { ...campNodeData, children: [] };

        const adSetMap = new Map<string, Record<string, unknown>[]>();
        for (const row of campRows) {
          const adSet = adSetCol ? String(row[adSetCol]).trim() : 'Default Ad Set';
          if (!adSetMap.has(adSet)) adSetMap.set(adSet, []);
          adSetMap.get(adSet)!.push(row);
        }

        // Only add ad sets if the column exists
        if (adSetCol) {
          for (const [adSetName, adSetRows] of adSetMap.entries()) {
            const adSetId = `${advName}|${campName}|${adSetName}`;
            const adSetNodeData = processNodeAnalysis(ctx, adSetRows, 'ad_set', adSetName, adSetId, advName, campName, campName);
            campNode.children.push({ ...adSetNodeData, children: [] });
          }
        }

        // Only add campaigns if column exists or we have ad sets
        if (campaignCol || adSetCol) {
          advNode.children.push(campNode);
        }
      }
      
      nodes.push(advNode);
    }
  }

  // Calculate total budget (sum of all ad set budgets if provided, otherwise ctx.total_budget)
  let totalBudget = 0;
  if (Object.keys(ctx.ad_set_budgets).length > 0) {
    totalBudget = Object.values(ctx.ad_set_budgets).reduce((a, b) => a + b, 0);
  } else {
    totalBudget = ctx.total_budget;
  }

  return {
    nodes,
    summary: {
      total_accounts: nodes.length,
      total_spend: totalSpend,
      total_budget: totalBudget,
      overall_pacing: totalBudget > 0 ? totalSpend / totalBudget : 0,
      total_rows: rows.length,
    }
  };
}
