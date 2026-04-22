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
  pacing_status: 'On Track' | 'Underpacing' | 'Overpacing' | 'Critical Underpacing' | 'Critical Overpacing';
  projected_total_spend: number;
  projected_underspend: number;
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
}

export interface AnalysisResult {
  account_name: string;
  health_summary: string;
  pacing: PacingAnalysis;
  kpi_performance: KPIPerformance;
  risks: Risk[];
  recommendations: Recommendation[];
  daily_data: { date: string; spend: number; kpi_value: number }[];
  optimizer_type: string;
}

export interface BulkAnalysisResult {
  results: AnalysisResult[];
  summary: {
    total_accounts: number;
    total_spend: number;
    total_budget: number;
    overall_pacing: number;
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

export function analyzeCampaign(ctx: CampaignContext, rows: Record<string, unknown>[]): AnalysisResult {
  if (!rows.length) {
    return {
      health_summary: 'No data available for analysis.',
      pacing: { elapsed_days: 0, remaining_days: 0, total_days: 0, expected_spend: 0, actual_spend: 0, pacing_ratio: 0, pacing_status: 'Critical Underpacing', projected_total_spend: 0, projected_underspend: ctx.total_budget },
      kpi_performance: { kpi_name: ctx.kpi, kpi_value: 0, kpi_trend: 'Stable', secondary_metrics: {} },
      risks: [{ severity: 'high', title: 'No Data', description: 'No campaign data was found in the uploaded CSV.' }],
      recommendations: [{ priority: 1, action: 'Upload valid campaign data', reason: 'Analysis requires at least one row of campaign data.', impact: 'High' }],
      daily_data: [],
      optimizer_type: 'Unknown',
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
  const ctrCol = findColumn(cols, ['ctr', 'click_through_rate']);
  const cpcCol = findColumn(cols, ['cpc', 'cost_per_click']);
  const roasCol = findColumn(cols, ['roas', 'return_on_ad_spend']);

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

  // Pacing
  const start = new Date(ctx.start_date);
  const end = new Date(ctx.end_date);
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const expectedSpend = (elapsedDays / totalDays) * ctx.total_budget;
  const pacingRatio = expectedSpend > 0 ? totalSpend / expectedSpend : 0;

  let pacingStatus: PacingAnalysis['pacing_status'] = 'On Track';
  if (pacingRatio < 0.7) pacingStatus = 'Critical Underpacing';
  else if (pacingRatio < 0.9) pacingStatus = 'Underpacing';
  else if (pacingRatio > 1.3) pacingStatus = 'Critical Overpacing';
  else if (pacingRatio > 1.1) pacingStatus = 'Overpacing';

  const dailyRunRate = elapsedDays > 0 ? totalSpend / elapsedDays : 0;
  const projectedTotalSpend = dailyRunRate * totalDays;
  const projectedUnderspend = Math.max(0, ctx.total_budget - projectedTotalSpend);

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

  // Risks
  const risks: Risk[] = [];
  if (pacingStatus.includes('Underpacing')) {
    risks.push({ severity: pacingStatus === 'Critical Underpacing' ? 'high' : 'medium', title: 'Budget Underdelivery', description: `Campaign is pacing at ${Math.round(pacingRatio * 100)}% of expected spend. Projected underspend: ${ctx.currency}${projectedUnderspend.toLocaleString()}.` });
  }
  if (pacingStatus.includes('Overpacing')) {
    risks.push({ severity: pacingStatus === 'Critical Overpacing' ? 'high' : 'medium', title: 'Budget Overdelivery', description: `Campaign is overspending at ${Math.round(pacingRatio * 100)}% of expected spend.` });
  }
  if (kpiTrend === 'Declining') {
    risks.push({ severity: 'medium', title: 'KPI Declining', description: `${ctx.kpi} performance is trending downward in the second half of the flight.` });
  }
  if (totalImps > 0 && totalClicks / totalImps < 0.001) {
    risks.push({ severity: 'low', title: 'Low CTR', description: 'Click-through rate is below 0.1%, indicating weak creative engagement.' });
  }
  if (remainingDays <= 3 && remainingDays > 0) {
    risks.push({ severity: 'high', title: 'Flight Ending Soon', description: `Only ${remainingDays} day(s) remaining in this campaign flight.` });
  }
  if (risks.length === 0) {
    risks.push({ severity: 'low', title: 'No Major Risks Detected', description: 'Campaign appears to be performing within acceptable parameters.' });
  }

  // Recommendations
  const recommendations: Recommendation[] = [];
  if (pacingRatio < 0.9) {
    recommendations.push({ priority: 1, action: 'Increase daily spend caps or broaden audience targeting', reason: `Current pacing at ${Math.round(pacingRatio * 100)}% risks significant underspend by flight end.`, impact: 'High' });
  }
  if (pacingRatio > 1.1) {
    recommendations.push({ priority: 1, action: 'Reduce daily budgets or tighten targeting to control overspend', reason: `Spend is exceeding plan by ${Math.round((pacingRatio - 1) * 100)}%.`, impact: 'High' });
  }
  if (kpiTrend === 'Declining') {
    recommendations.push({ priority: 2, action: `Review ${ctx.kpi} optimization strategy and creative rotation`, reason: 'Second-half performance is weaker than first half.', impact: 'Medium' });
  }
  if (totalImps > 0 && totalClicks / totalImps < 0.002) {
    recommendations.push({ priority: 3, action: 'Refresh ad creatives or test new formats', reason: 'Low CTR suggests creative fatigue or poor audience-ad match.', impact: 'Medium' });
  }
  recommendations.push({ priority: recommendations.length + 1, action: 'Monitor daily pacing and KPI delivery for next 48 hours', reason: 'Ensure any adjustments are producing intended effects before scaling.', impact: 'Low' });

  // Health summary
  const healthParts: string[] = [];
  healthParts.push(`Campaign "${ctx.account_name}" is ${pacingStatus.toLowerCase()} with ${elapsedDays} of ${totalDays} days elapsed.`);
  healthParts.push(`Total spend: ${ctx.currency}${totalSpend.toLocaleString()} of ${ctx.currency}${ctx.total_budget.toLocaleString()} budget (${Math.round(pacingRatio * 100)}% pacing).`);
  healthParts.push(`${ctx.kpi} performance is ${kpiTrend.toLowerCase()} with a current value of ${kpiValue.toLocaleString()}.`);
  healthParts.push(`Optimizer: ${optimizer}.`);

  return {
    account_name: ctx.account_name,
    health_summary: healthParts.join(' '),
    pacing,
    kpi_performance: { kpi_name: ctx.kpi, kpi_value: kpiValue, kpi_trend: kpiTrend, secondary_metrics: secondaryMetrics },
    risks,
    recommendations,
    daily_data: dailyData,
    optimizer_type: optimizer,
  };
}

export function bulkAnalyzeCampaigns(ctx: CampaignContext, rows: Record<string, unknown>[]): BulkAnalysisResult {
  const cols = Object.keys(rows[0] || {});
  const advertiserCol = findColumn(cols, ['advertiser', 'account', 'client', 'customer']);

  if (!advertiserCol) {
    // Fallback to single account analysis
    const result = analyzeCampaign(ctx, rows);
    return {
      results: [result],
      summary: {
        total_accounts: 1,
        total_spend: result.pacing.actual_spend,
        total_budget: ctx.total_budget,
        overall_pacing: result.pacing.pacing_ratio,
      }
    };
  }

  // Group by advertiser
  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const row of rows) {
    const name = String(row[advertiserCol] || 'Unknown Account');
    if (!groups[name]) groups[name] = [];
    groups[name].push(row);
  }

  const results = Object.entries(groups).map(([name, groupRows]) => {
    // If budget/dates are in the CSV per account, we'd extract them here.
    // For now, we use the global context but update the name.
    return analyzeCampaign({ ...ctx, account_name: name }, groupRows);
  });

  const totalSpend = results.reduce((s, r) => s + r.pacing.actual_spend, 0);
  const totalBudget = results.length * ctx.total_budget; // Assuming budget is per account if global
  
  return {
    results,
    summary: {
      total_accounts: results.length,
      total_spend: Math.round(totalSpend * 100) / 100,
      total_budget: totalBudget,
      overall_pacing: totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) / 100 : 0,
    }
  };
}
