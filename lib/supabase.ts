import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gjbnxjvumokctckkxuvh.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Using dummy key for development.');
}

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqYm54anZ1bW9rY3Rja2t4dXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjUzOTAxMzksImV4cCI6MTkzMDk2NjEzOX0.dummy'
);

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
