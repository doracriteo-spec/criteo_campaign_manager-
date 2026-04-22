import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gjbnxjvumokctckkxuvh.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type CampaignUpload = {
  id?: string;
  account_name: string;
  region: string;
  currency: string;
  kpi: string;
  total_budget: number;
  start_date: string;
  end_date: string;
  csv_data: Record<string, unknown>[];
  analysis_result?: Record<string, unknown>;
  created_at?: string;
};
