-- 2024‑06‑30 Add comprehensive campaign manager schema
-- Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  global_account TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Advertisers
CREATE TABLE IF NOT EXISTS advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region TEXT,
  currency TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kpi TEXT,
  start_date DATE,
  end_date DATE,
  total_budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ad Sets
CREATE TABLE IF NOT EXISTS ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Metrics
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  sales NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  visits INTEGER DEFAULT 0,
  cpa NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_set_id, date)
);

-- Monthly Budget Plans
CREATE TABLE IF NOT EXISTS monthly_budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  planned_budget NUMERIC,
  allocated_budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, month)
);

-- Tracker Notes
CREATE TABLE IF NOT EXISTS tracker_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id),
  account_id UUID REFERENCES accounts(id),
  campaign_id UUID REFERENCES campaigns(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Upload Files
CREATE TABLE IF NOT EXISTS upload_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Upload Jobs
CREATE TABLE IF NOT EXISTS upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES upload_files(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

-- Import Row Audit
CREATE TABLE IF NOT EXISTS import_row_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  row_number INTEGER,
  status TEXT,
  errors TEXT,
  source_row_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mapping tables
CREATE TABLE IF NOT EXISTS account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_owner TEXT,
  external_global_account TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS advertiser_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  external_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shopee Allocation
CREATE TABLE IF NOT EXISTS shopee_allocation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shopee_allocation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES shopee_allocation_plans(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id),
  allocation_pct NUMERIC,
  budget_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GoJek Allocation
CREATE TABLE IF NOT EXISTS gojek_allocation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gojek_allocation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES gojek_allocation_plans(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id),
  allocation_pct NUMERIC,
  budget_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account Module States
CREATE TABLE IF NOT EXISTS account_module_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  shopee_enabled BOOLEAN DEFAULT FALSE,
  gojek_enabled BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_adset_date ON daily_metrics(ad_set_id, date);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id);

-- Row Level Security (RLS) – policies will be added in a separate script.

-- Refresh materialised views placeholder (to be defined later)
