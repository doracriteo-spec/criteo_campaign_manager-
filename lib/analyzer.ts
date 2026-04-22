export interface CampaignContext {
  account_name: string;
  region: string;
  currency: string;
  kpi: string;
  total_budget: number;
  start_date: string;
  end_date: string;
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

export interface AnalysisResult {
  account_name: string;
  health_summary: string;
  pacing: PacingAnalysis;
  kpi_performance: KPIPerformance;
  risks: Risk[];
  recommendations: Recommendation[];
  pacing_recommendations: Recommendation[];
  daily_data: { date: string; spend: number; kpi_value: number }[];
  optimizer_type: string;
  row_count: number;
  campaign_names: string[];
}

export interface BulkAnalysisResult {
  results: AnalysisResult[];
  summary: {
    total_accounts: number;
    total_spend: number;
    total_budget: number;
    overall_pacing: number;
    total_rows: number;
  };
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
  ctx: CampaignContext
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (hasBudget && pacingRatio < 0.9) {
    // Underpacing recommendations
    recs.push({
      priority: 1,
      action: 'Increase daily budget caps by 20-30%',
      reason: `Current pacing at ${Math.round(pacingRatio * 100)}% indicates significant underdelivery. Raising budget caps allows the algorithm to find more eligible impressions.`,
      impact: 'High',
      category: 'budget'
    });
    recs.push({
      priority: 2,
      action: 'Lower bid caps or switch to automatic bidding',
      reason: 'Restrictive bid caps can prevent the optimizer from winning enough auctions. Consider removing manual bid limits to increase delivery volume.',
      impact: 'High',
      category: 'pacing'
    });
    recs.push({
      priority: 3,
      action: 'Expand audience targeting or add new interest segments',
      reason: 'Narrow targeting limits the available inventory pool. Broaden geo, demographic, or interest targeting to increase reach.',
      impact: 'Medium',
      category: 'targeting'
    });
    recs.push({
      priority: 4,
      action: 'Review frequency capping settings',
      reason: 'Overly strict frequency caps may limit impressions per user. Consider relaxing caps from 1/day to 3/day to improve delivery.',
      impact: 'Medium',
      category: 'pacing'
    });
    if (pacingRatio < 0.5) {
      recs.push({
        priority: 5,
        action: 'Consider extending flight dates or reallocating budget',
        reason: `At ${Math.round(pacingRatio * 100)}% pacing, the campaign may not spend its full budget. Consider extending end date or shifting budget to higher-performing campaigns.`,
        impact: 'High',
        category: 'budget'
      });
    }
  } else if (hasBudget && pacingRatio > 1.1) {
    // Overpacing recommendations
    recs.push({
      priority: 1,
      action: 'Reduce daily budget caps by 15-25%',
      reason: `Overpacing at ${Math.round(pacingRatio * 100)}% will exhaust budget before flight end. Tighten daily caps to ensure even distribution.`,
      impact: 'High',
      category: 'budget'
    });
    recs.push({
      priority: 2,
      action: 'Tighten audience targeting to focus on highest-value segments',
      reason: 'Narrowing targeting reduces impression volume while potentially improving conversion quality.',
      impact: 'Medium',
      category: 'targeting'
    });
    recs.push({
      priority: 3,
      action: 'Implement or increase bid caps',
      reason: 'Adding manual bid limits prevents the optimizer from overbidding and controls overall spend velocity.',
      impact: 'Medium',
      category: 'pacing'
    });
  }

  // General pacing recommendations (always relevant)
  if (totalImps > 0 && totalClicks / totalImps < 0.002) {
    recs.push({
      priority: recs.length + 1,
      action: 'Refresh creatives to improve click-through rate',
      reason: `CTR of ${((totalClicks / totalImps) * 100).toFixed(2)}% is below industry benchmark. New creatives can unlock more efficient delivery.`,
      impact: 'Medium',
      category: 'creative'
    });
  }

  if (totalConv > 0 && totalSpend > 0) {
    const cpa = totalSpend / totalConv;
    if (totalRevenue > 0 && totalRevenue / totalSpend < 1) {
      recs.push({
        priority: recs.length + 1,
        action: 'Optimize toward higher-ROAS audience segments',
        reason: `Current ROAS of ${(totalRevenue / totalSpend).toFixed(2)}x is below breakeven. Focus spend on proven high-value cohorts.`,
        impact: 'High',
        category: 'targeting'
      });
    }
  }

  if (!hasBudget) {
    recs.push({
      priority: 1,
      action: 'Set a total budget to enable pacing analysis',
      reason: 'Without a defined budget, pacing ratios and spend projections cannot be calculated. Add a budget in the configuration to unlock full optimization insights.',
      impact: 'Medium',
      category: 'budget'
    });
    recs.push({
      priority: 2,
      action: 'Review daily spend trends for consistency',
      reason: `Current daily run rate is ${ctx.currency}${dailyRunRate.toFixed(2)}. Ensure this aligns with campaign goals and expected delivery.`,
      impact: 'Low',
      category: 'pacing'
    });
  }

  if (kpiTrend === 'Declining') {
    recs.push({
      priority: recs.length + 1,
      action: 'Implement A/B creative testing to reverse declining performance',
      reason: 'KPI trend is declining. Rotating in fresh creatives and testing different messaging can help reverse the trend.',
      impact: 'Medium',
      category: 'creative'
    });
  }

  // Always add a general monitoring recommendation
  recs.push({
    priority: recs.length + 1,
    action: 'Monitor campaign performance daily and adjust bids/budgets in 48-hour cycles',
    reason: 'Regular monitoring ensures optimizations take effect before making further changes. Allow 48 hours between adjustments for the algorithm to recalibrate.',
    impact: 'Low',
    category: 'general'
  });

  return recs;
}

export function analyzeCampaign(ctx: CampaignContext, rows: Record<string, unknown>[]): AnalysisResult {
  if (!rows.length) {
    return {
      account_name: ctx.account_name,
      health_summary: 'No data available for analysis.',
      pacing: { elapsed_days: 0, remaining_days: 0, total_days: 0, expected_spend: 0, actual_spend: 0, pacing_ratio: 0, pacing_status: 'No Budget Set', projected_total_spend: 0, projected_underspend: 0, has_budget: false },
      kpi_performance: { kpi_name: ctx.kpi, kpi_value: 0, kpi_trend: 'Stable', secondary_metrics: {} },
      risks: [{ severity: 'high', title: 'No Data', description: 'No campaign data was found in the uploaded CSV.' }],
      recommendations: [{ priority: 1, action: 'Upload valid campaign data', reason: 'Analysis requires at least one row of campaign data.', impact: 'High' }],
      pacing_recommendations: [],
      daily_data: [],
      optimizer_type: 'Unknown',
      row_count: 0,
      campaign_names: [],
    };
  }

  const cols = Object.keys(rows[0]);
  const optimizer = detectOptimizer(rows);

  // Find columns
  const dateCol = findColumn(cols, ['date', 'day', 'period']);
  const spendCol = findColumn(cols, ['spend', 'cost', 'budget_spent', 'amount']);
  const clickCol = findColumn(cols, ['click', 'clicks']);
  const impCol = findColumn(cols, ['impression', 'impressions', 'imps']);
  const convCol = findColumn(cols, ['conversion', 'conversions', 'sale', 'sales', 'order', 'orders']);
  const revenueCol = findColumn(cols, ['revenue', 'rev', 'value', 'order_value']);
  const visitCol = findColumn(cols, ['visit', 'visits', 'session', 'sessions']);
  const campaignCol = findColumn(cols, ['campaign', 'campaign_name', 'campaign name']);

  // Extract unique campaign names
  const campaignNames: string[] = [];
  if (campaignCol) {
    const uniqueCampaigns = new Set<string>();
    for (const row of rows) {
      const cn = String(row[campaignCol] || '').trim();
      if (cn && cn !== 'undefined' && cn !== 'null') uniqueCampaigns.add(cn);
    }
    campaignNames.push(...Array.from(uniqueCampaigns));
  }

  // Aggregate totals
  let totalSpend = 0, totalClicks = 0, totalImps = 0, totalConv = 0, totalRevenue = 0, totalVisits = 0;
  const dailyData: { date: string; spend: number; kpi_value: number }[] = [];

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

    dailyData.push({
      date: dateCol ? String(row[dateCol]) : `Row ${dailyData.length + 1}`,
      spend,
      kpi_value: kpiVal,
    });
  }

  // Pacing — works even if budget/dates are not set
  const hasBudget = ctx.total_budget > 0;
  const hasDates = !!ctx.start_date && !!ctx.end_date;
  
  let elapsedDays = 0, remainingDays = 0, totalDays = 0, expectedSpend = 0, pacingRatio = 0;
  
  if (hasDates) {
    const start = new Date(ctx.start_date);
    const end = new Date(ctx.end_date);
    const now = new Date();
    totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
    remainingDays = Math.max(0, totalDays - elapsedDays);
  } else if (dateCol) {
    // Try to infer from data
    const dates = rows.map(r => new Date(String(r[dateCol]))).filter(d => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
    if (dates.length >= 2) {
      totalDays = Math.max(1, Math.ceil((dates[dates.length - 1].getTime() - dates[0].getTime()) / 86400000));
      elapsedDays = totalDays;
      remainingDays = 0;
    } else {
      totalDays = rows.length;
      elapsedDays = rows.length;
    }
  } else {
    totalDays = rows.length;
    elapsedDays = rows.length;
  }

  if (hasBudget) {
    expectedSpend = totalDays > 0 ? (elapsedDays / totalDays) * ctx.total_budget : ctx.total_budget;
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
  const projectedUnderspend = hasBudget ? Math.max(0, ctx.total_budget - projectedTotalSpend) : 0;

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
    secondaryMetrics['Total Spend'] = Math.round(totalSpend * 100) / 100;
  } else if (kpiLower.includes('revenue')) {
    kpiValue = Math.round(totalRevenue * 100) / 100;
    secondaryMetrics['ROAS'] = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
  } else if (kpiLower.includes('sale') || kpiLower.includes('conversion')) {
    kpiValue = totalConv;
    secondaryMetrics['CPA'] = totalConv > 0 ? Math.round((totalSpend / totalConv) * 100) / 100 : 0;
    secondaryMetrics['Conv. Rate'] = totalClicks > 0 ? Math.round((totalConv / totalClicks) * 10000) / 100 : 0;
  } else if (kpiLower.includes('visit')) {
    kpiValue = totalVisits;
    secondaryMetrics['Cost per Visit'] = totalVisits > 0 ? Math.round((totalSpend / totalVisits) * 100) / 100 : 0;
  } else if (kpiLower.includes('click')) {
    kpiValue = totalClicks;
    secondaryMetrics['CPC'] = totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0;
    secondaryMetrics['CTR'] = totalImps > 0 ? Math.round((totalClicks / totalImps) * 10000) / 100 : 0;
  } else {
    kpiValue = totalSpend;
  }

  secondaryMetrics['Impressions'] = totalImps;
  secondaryMetrics['Clicks'] = totalClicks;
  if (totalConv > 0) secondaryMetrics['Conversions'] = totalConv;
  if (totalRevenue > 0) secondaryMetrics['Revenue'] = Math.round(totalRevenue * 100) / 100;
  if (!secondaryMetrics['CTR'] && totalImps > 0) secondaryMetrics['CTR'] = Math.round((totalClicks / totalImps) * 10000) / 100;
  secondaryMetrics['Avg. Daily Spend'] = Math.round(dailyRunRate * 100) / 100;

  // Trend
  const half = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, half);
  const secondHalf = dailyData.slice(half);
  const avgFirst = firstHalf.reduce((s, d) => s + d.kpi_value, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((s, d) => s + d.kpi_value, 0) / (secondHalf.length || 1);
  let kpiTrend: KPIPerformance['kpi_trend'] = 'Stable';
  if (avgSecond > avgFirst * 1.1) kpiTrend = 'Improving';
  else if (avgSecond < avgFirst * 0.9) kpiTrend = 'Declining';

  // Risks
  const risks: Risk[] = [];
  if (hasBudget && pacingStatus.includes('Underpacing')) {
    risks.push({ severity: pacingStatus === 'Critical Underpacing' ? 'high' : 'medium', title: 'Budget Underdelivery', description: `Campaign is pacing at ${Math.round(pacingRatio * 100)}% of expected spend. Projected underspend: ${ctx.currency}${projectedUnderspend.toLocaleString()}.` });
  }
  if (hasBudget && pacingStatus.includes('Overpacing')) {
    risks.push({ severity: pacingStatus === 'Critical Overpacing' ? 'high' : 'medium', title: 'Budget Overdelivery', description: `Campaign is overspending at ${Math.round(pacingRatio * 100)}% of expected spend.` });
  }
  if (kpiTrend === 'Declining') {
    risks.push({ severity: 'medium', title: 'KPI Declining', description: `${ctx.kpi} performance is trending downward in the second half of the flight.` });
  }
  if (totalImps > 0 && totalClicks / totalImps < 0.001) {
    risks.push({ severity: 'low', title: 'Low CTR', description: 'Click-through rate is below 0.1%, indicating weak creative engagement.' });
  }
  if (hasDates && remainingDays <= 3 && remainingDays > 0) {
    risks.push({ severity: 'high', title: 'Flight Ending Soon', description: `Only ${remainingDays} day(s) remaining in this campaign flight.` });
  }
  if (!hasBudget) {
    risks.push({ severity: 'low', title: 'No Budget Defined', description: 'Total budget not set. Pacing analysis is limited. Add a budget for full optimization insights.' });
  }
  if (risks.length === 0) {
    risks.push({ severity: 'low', title: 'No Major Risks Detected', description: 'Campaign appears to be performing within acceptable parameters.' });
  }

  // General Recommendations
  const recommendations: Recommendation[] = [];
  if (hasBudget && pacingRatio < 0.9) {
    recommendations.push({ priority: 1, action: 'Increase daily spend caps or broaden audience targeting', reason: `Current pacing at ${Math.round(pacingRatio * 100)}% risks significant underspend by flight end.`, impact: 'High' });
  }
  if (hasBudget && pacingRatio > 1.1) {
    recommendations.push({ priority: 1, action: 'Reduce daily budgets or tighten targeting to control overspend', reason: `Spend is exceeding plan by ${Math.round((pacingRatio - 1) * 100)}%.`, impact: 'High' });
  }
  if (kpiTrend === 'Declining') {
    recommendations.push({ priority: 2, action: `Review ${ctx.kpi} optimization strategy and creative rotation`, reason: 'Second-half performance is weaker than first half.', impact: 'Medium' });
  }
  if (totalImps > 0 && totalClicks / totalImps < 0.002) {
    recommendations.push({ priority: 3, action: 'Refresh ad creatives or test new formats', reason: 'Low CTR suggests creative fatigue or poor audience-ad match.', impact: 'Medium' });
  }
  recommendations.push({ priority: recommendations.length + 1, action: 'Monitor daily pacing and KPI delivery for next 48 hours', reason: 'Ensure any adjustments are producing intended effects before scaling.', impact: 'Low' });

  // Pacing-specific recommendations
  const pacingRecs = generatePacingRecommendations(
    pacingRatio, hasBudget, totalSpend, totalClicks, totalImps, totalConv, totalRevenue, kpiTrend, dailyRunRate, ctx
  );

  // Health summary
  const healthParts: string[] = [];
  if (hasBudget) {
    healthParts.push(`Campaign "${ctx.account_name}" is ${pacingStatus.toLowerCase()} with ${elapsedDays} of ${totalDays} days elapsed.`);
    healthParts.push(`Total spend: ${ctx.currency}${totalSpend.toLocaleString()} of ${ctx.currency}${ctx.total_budget.toLocaleString()} budget (${Math.round(pacingRatio * 100)}% pacing).`);
  } else {
    healthParts.push(`Campaign "${ctx.account_name}" has ${rows.length} rows of data across ${totalDays} days.`);
    healthParts.push(`Total spend: ${ctx.currency}${totalSpend.toLocaleString()} (avg ${ctx.currency}${dailyRunRate.toFixed(2)}/day).`);
  }
  healthParts.push(`${ctx.kpi} performance is ${kpiTrend.toLowerCase()} with a current value of ${kpiValue.toLocaleString()}.`);
  healthParts.push(`Optimizer: ${optimizer}.`);

  return {
    account_name: ctx.account_name,
    health_summary: healthParts.join(' '),
    pacing,
    kpi_performance: { kpi_name: ctx.kpi, kpi_value: kpiValue, kpi_trend: kpiTrend, secondary_metrics: secondaryMetrics },
    risks,
    recommendations,
    pacing_recommendations: pacingRecs,
    daily_data: dailyData,
    optimizer_type: optimizer,
    row_count: rows.length,
    campaign_names: campaignNames,
  };
}

export function detectAdvertisers(rows: Record<string, unknown>[]): string[] {
  const cols = Object.keys(rows[0] || {});
  const advertiserCol = findColumn(cols, ['advertiser', 'account', 'client', 'customer']);
  if (!advertiserCol) return [];
  
  const unique = new Set<string>();
  for (const row of rows) {
    const name = String(row[advertiserCol] || '').trim();
    if (name && name !== 'undefined' && name !== 'null') unique.add(name);
  }
  return Array.from(unique).sort();
}

export function bulkAnalyzeCampaigns(ctx: CampaignContext, rows: Record<string, unknown>[]): BulkAnalysisResult {
  const cols = Object.keys(rows[0] || {});
  const advertiserCol = findColumn(cols, ['advertiser', 'account', 'client', 'customer']);

  if (!advertiserCol) {
    // Fallback to single account analysis
    const name = ctx.account_name || 'All Data';
    const result = analyzeCampaign({ ...ctx, account_name: name }, rows);
    return {
      results: [result],
      summary: {
        total_accounts: 1,
        total_spend: result.pacing.actual_spend,
        total_budget: ctx.total_budget,
        overall_pacing: result.pacing.pacing_ratio,
        total_rows: rows.length,
      }
    };
  }

  // Group by advertiser
  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const row of rows) {
    const name = String(row[advertiserCol] || 'Unknown Account').trim();
    if (!groups[name]) groups[name] = [];
    groups[name].push(row);
  }

  const results = Object.entries(groups).map(([name, groupRows]) => {
    return analyzeCampaign({ ...ctx, account_name: name }, groupRows);
  });

  const totalSpend = results.reduce((s, r) => s + r.pacing.actual_spend, 0);
  const totalBudget = ctx.total_budget > 0 ? results.length * ctx.total_budget : 0;
  
  return {
    results,
    summary: {
      total_accounts: results.length,
      total_spend: Math.round(totalSpend * 100) / 100,
      total_budget: totalBudget,
      overall_pacing: totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) / 100 : 0,
      total_rows: rows.length,
    }
  };
}
