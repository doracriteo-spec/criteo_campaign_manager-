import { supabase } from './supabase';
import { CampaignContext, AnalysisResult } from './analyzer';

export async function processUpload(
  userId: string,
  config: CampaignContext,
  analysis: AnalysisResult,
  csvData: Record<string, unknown>[]
) {
  // 1. Process Advertiser
  let advertiserId: string;
  const { data: existingAdv } = await supabase
    .from('advertisers')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', config.account_name)
    .single();

  if (existingAdv) {
    advertiserId = existingAdv.id;
    // Update basic info
    await supabase.from('advertisers').update({
      region: config.region,
      currency: config.currency,
    }).eq('id', advertiserId);
  } else {
    const { data: newAdv, error } = await supabase
      .from('advertisers')
      .insert({
        user_id: userId,
        name: config.account_name,
        region: config.region,
        currency: config.currency,
      })
      .select('id')
      .single();
    if (error) throw error;
    advertiserId = newAdv.id;
  }

  // 2. Process Campaign
  let campaignId: string;
  // We try to find campaign by name (using a generic name from the config, or we could extract unique campaigns from the CSV. 
  // Given the constraints, we treat the upload as representing one overarching campaign or a specific flight).
  // Assuming 'csvFileName' or config contains the main campaign context for this upload:
  const campaignName = config.account_name + ' - Main Campaign'; 

  const { data: existingCamp } = await supabase
    .from('campaigns')
    .select('id')
    .eq('advertiser_id', advertiserId)
    .ilike('name', campaignName)
    .single();

  if (existingCamp) {
    campaignId = existingCamp.id;
    await supabase.from('campaigns').update({
      kpi: config.kpi,
      total_budget: config.total_budget,
      start_date: config.start_date,
      end_date: config.end_date,
    }).eq('id', campaignId);
  } else {
    const { data: newCamp, error } = await supabase
      .from('campaigns')
      .insert({
        advertiser_id: advertiserId,
        user_id: userId,
        name: campaignName,
        kpi: config.kpi,
        total_budget: config.total_budget,
        start_date: config.start_date,
        end_date: config.end_date,
      })
      .select('id')
      .single();
    if (error) throw error;
    campaignId = newCamp.id;
  }

  // 3. Process Ad Sets & Daily Metrics
  // We will deduce ad sets from the CSV (if 'Ad Set' or 'Adset' column exists), otherwise default to 'Default Ad Set'
  const cols = Object.keys(csvData[0] || {}).map(c => c.toLowerCase());
  const adSetCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('ad set') || c.toLowerCase().includes('adset'));
  const dateCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('day') || c.toLowerCase().includes('period'));
  
  // Columns for metrics
  const spendCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('spend') || c.toLowerCase().includes('cost'));
  const impCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('impression') || c.toLowerCase().includes('imps'));
  const clickCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('click') || c.toLowerCase().includes('clicks'));
  const convCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('conversion') || c.toLowerCase().includes('sale'));
  const revCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('value'));
  const visitCol = Object.keys(csvData[0] || {}).find(c => c.toLowerCase().includes('visit'));

  const num = (v: any) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[$,€£¥%]/g, '').trim());
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  // Cache of ad sets for this campaign
  const adSetMap = new Map<string, string>();
  
  for (const row of csvData) {
    const adSetName = adSetCol ? String(row[adSetCol]) : 'Default Ad Set';
    const rowDateRaw = dateCol ? String(row[dateCol]) : new Date().toISOString().split('T')[0];
    
    // Convert date to standard YYYY-MM-DD
    let rowDate = rowDateRaw;
    try {
      const d = new Date(rowDateRaw);
      if (!isNaN(d.getTime())) {
        rowDate = d.toISOString().split('T')[0];
      }
    } catch (e) {}

    let adSetId = adSetMap.get(adSetName);

    if (!adSetId) {
      // Look up or create
      const { data: existingAdSet } = await supabase
        .from('ad_sets')
        .select('id')
        .eq('campaign_id', campaignId)
        .ilike('name', adSetName)
        .single();
        
      if (existingAdSet) {
        adSetId = existingAdSet.id;
      } else {
        const { data: newAdSet, error } = await supabase
          .from('ad_sets')
          .insert({
            campaign_id: campaignId,
            user_id: userId,
            name: adSetName,
          })
          .select('id')
          .single();
        if (error) throw error;
        adSetId = newAdSet.id;
      }
      adSetMap.set(adSetName, adSetId);
    }

    // Upsert Daily Metrics
    const metricsPayload = {
      ad_set_id: adSetId,
      campaign_id: campaignId,
      user_id: userId,
      date: rowDate,
      spend: spendCol ? num(row[spendCol]) : 0,
      impressions: impCol ? num(row[impCol]) : 0,
      clicks: clickCol ? num(row[clickCol]) : 0,
      conversions: convCol ? num(row[convCol]) : 0,
      revenue: revCol ? num(row[revCol]) : 0,
      visits: visitCol ? num(row[visitCol]) : 0,
      raw_data: row
    };

    // Try to update existing day, otherwise insert
    const { data: existingMetric } = await supabase
      .from('daily_metrics')
      .select('id')
      .eq('ad_set_id', adSetId)
      .eq('date', rowDate)
      .single();

    if (existingMetric) {
      await supabase.from('daily_metrics').update(metricsPayload).eq('id', existingMetric.id);
    } else {
      await supabase.from('daily_metrics').insert(metricsPayload);
    }
  }

  return { advertiserId, campaignId };
}
