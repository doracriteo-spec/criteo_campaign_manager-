const { Client } = require('pg');

const uri = 'postgresql://postgres:KBK517CACRITEO@db.gjbnxjvumokctckkxuvh.supabase.co:5432/postgres';

const client = new Client({ connectionString: uri });

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    await client.query(`
      -- Advertisers
      CREATE TABLE IF NOT EXISTS advertisers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        region TEXT,
        currency TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );

      -- Campaigns
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        kpi TEXT,
        total_budget NUMERIC,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(advertiser_id, name)
      );

      -- Ad Sets
      CREATE TABLE IF NOT EXISTS ad_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, name)
      );

      -- Daily Metrics
      CREATE TABLE IF NOT EXISTS daily_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        spend NUMERIC DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        visits INTEGER DEFAULT 0,
        raw_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(ad_set_id, date) -- ensure no duplicate dates per ad set
      );

      -- Enable RLS
      ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

      -- RLS Policies
      DO $$ BEGIN
        -- Advertisers
        DROP POLICY IF EXISTS "Users can manage their own advertisers" ON advertisers;
        CREATE POLICY "Users can manage their own advertisers" ON advertisers
          FOR ALL USING (auth.uid() = user_id);

        -- Campaigns
        DROP POLICY IF EXISTS "Users can manage their own campaigns" ON campaigns;
        CREATE POLICY "Users can manage their own campaigns" ON campaigns
          FOR ALL USING (auth.uid() = user_id);

        -- Ad Sets
        DROP POLICY IF EXISTS "Users can manage their own ad sets" ON ad_sets;
        CREATE POLICY "Users can manage their own ad sets" ON ad_sets
          FOR ALL USING (auth.uid() = user_id);

        -- Daily Metrics
        DROP POLICY IF EXISTS "Users can manage their own daily metrics" ON daily_metrics;
        CREATE POLICY "Users can manage their own daily metrics" ON daily_metrics
          FOR ALL USING (auth.uid() = user_id);
      END $$;
    `);

    console.log('Tables and RLS policies created successfully.');

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

run();
