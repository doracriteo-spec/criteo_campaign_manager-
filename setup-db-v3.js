/**
 * Database setup script v3
 * Usage: SUPABASE_DB_URL=... node setup-db-v3.js
 *
 * DO NOT hardcode credentials. Use the env var:
 *   export SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
 */
const { Client } = require('pg');

const uri = process.env.SUPABASE_DB_URL;

if (!uri) {
  console.error('Error: SUPABASE_DB_URL environment variable is not set.');
  console.error('  export SUPABASE_DB_URL="postgresql://..."');
  process.exit(1);
}

const client = new Client({ connectionString: uri });

async function run() {
  try {
    await client.connect();
    console.log('✓ Connected to Supabase PostgreSQL');

    // ── Clean slate migration ────────────────────────────────────────────────
    await client.query(`
      DROP TABLE IF EXISTS upload_batches CASCADE;
      DROP TABLE IF EXISTS account_notes CASCADE;
      DROP TABLE IF EXISTS budget_allocations CASCADE;
      DROP TABLE IF EXISTS daily_metrics CASCADE;
      DROP TABLE IF EXISTS ad_sets CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS accounts CASCADE;
      DROP TABLE IF EXISTS portfolios CASCADE;
    `);
    console.log('✓ Old tables dropped');

    // ── Core entity tables ──────────────────────────────────────────────────

    await client.query(`
      -- Portfolios
      CREATE TABLE IF NOT EXISTS portfolios (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );

      -- Accounts (advertisers with portfolio membership)
      CREATE TABLE IF NOT EXISTS accounts (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id   UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        user_id        UUID NOT NULL,
        name           TEXT NOT NULL,
        global_account TEXT,
        market         TEXT,
        owner_as       TEXT,
        currency       TEXT DEFAULT 'USD',
        notes          TEXT,
        goals          TEXT,
        kpi_target     NUMERIC,
        kpi_metric     TEXT,
        client_context TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(portfolio_id, name)
      );

      -- Campaigns (linked to account)
      CREATE TABLE IF NOT EXISTS campaigns (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL,
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        external_id  TEXT,
        kpi          TEXT,
        total_budget NUMERIC,
        start_date   DATE,
        end_date     DATE,
        status       TEXT DEFAULT 'Active',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Ad Sets
      CREATE TABLE IF NOT EXISTS ad_sets (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        account_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
        user_id       UUID NOT NULL,
        portfolio_id  UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        external_id   TEXT,
        budget        NUMERIC,
        start_date    DATE,
        end_date      DATE,
        status        TEXT DEFAULT 'Live',
        optimizer     TEXT,
        campaign_type TEXT,
        channel       TEXT,
        smoothing      TEXT,
        comments      TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      -- Daily Metrics
      CREATE TABLE IF NOT EXISTS daily_metrics (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_set_id     UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
        campaign_id   UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        account_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
        portfolio_id  UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        user_id       UUID NOT NULL,
        date          DATE NOT NULL,
        spend         NUMERIC DEFAULT 0,
        budget        NUMERIC DEFAULT 0,
        impressions   BIGINT DEFAULT 0,
        clicks        INTEGER DEFAULT 0,
        conversions   NUMERIC DEFAULT 0,
        revenue       NUMERIC DEFAULT 0,
        visits        INTEGER DEFAULT 0,
        ctr           NUMERIC DEFAULT 0,
        cac           NUMERIC DEFAULT 0,
        cpv           NUMERIC DEFAULT 0,
        cpo           NUMERIC DEFAULT 0,
        roas          NUMERIC DEFAULT 0,
        raw_data      JSONB,
        upload_batch_id UUID,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(ad_set_id, date)
      );

      -- Budget Allocations
      CREATE TABLE IF NOT EXISTS budget_allocations (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
        ad_set_id    UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
        campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL,
        budget       NUMERIC NOT NULL,
        period_start DATE,
        period_end   DATE,
        notes        TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Account Notes & Action Items
      CREATE TABLE IF NOT EXISTS account_notes (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL,
        content      TEXT NOT NULL,
        type         TEXT DEFAULT 'note',  -- 'note' | 'action'
        owner        TEXT,
        status       TEXT DEFAULT 'open', -- 'open' | 'in_progress' | 'done'
        due_date     DATE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Upload Batches / Import Logs
      CREATE TABLE IF NOT EXISTS upload_batches (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL,
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        filename     TEXT,
        row_count    INTEGER DEFAULT 0,
        status       TEXT DEFAULT 'pending', -- 'pending'|'processing'|'done'|'error'
        column_map   JSONB,
        summary      JSONB,
        error_log    TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Tables created');

    // ── Row Level Security ───────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE portfolios       ENABLE ROW LEVEL SECURITY;
      ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
      ALTER TABLE campaigns        ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ad_sets          ENABLE ROW LEVEL SECURITY;
      ALTER TABLE daily_metrics    ENABLE ROW LEVEL SECURITY;
      ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE account_notes    ENABLE ROW LEVEL SECURITY;
      ALTER TABLE upload_batches   ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        DROP POLICY IF EXISTS "portfolios_policy"         ON portfolios;
        DROP POLICY IF EXISTS "accounts_policy"           ON accounts;
        DROP POLICY IF EXISTS "campaigns_policy"          ON campaigns;
        DROP POLICY IF EXISTS "ad_sets_policy"            ON ad_sets;
        DROP POLICY IF EXISTS "daily_metrics_policy"      ON daily_metrics;
        DROP POLICY IF EXISTS "budget_allocations_policy" ON budget_allocations;
        DROP POLICY IF EXISTS "account_notes_policy"      ON account_notes;
        DROP POLICY IF EXISTS "upload_batches_policy"     ON upload_batches;

        CREATE POLICY "portfolios_policy"         ON portfolios         FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "accounts_policy"           ON accounts           FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "campaigns_policy"          ON campaigns          FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "ad_sets_policy"            ON ad_sets            FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "daily_metrics_policy"      ON daily_metrics      FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "budget_allocations_policy" ON budget_allocations FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "account_notes_policy"      ON account_notes      FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "upload_batches_policy"     ON upload_batches     FOR ALL USING (auth.uid() = user_id);
      END $$;
    `);
    console.log('✓ RLS policies applied');

    // ── Indexes ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_portfolio   ON accounts(portfolio_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_account    ON campaigns(account_id);
      CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign     ON ad_sets(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_daily_metrics_date   ON daily_metrics(date);
      CREATE INDEX IF NOT EXISTS idx_daily_metrics_acct   ON daily_metrics(account_id);
      CREATE INDEX IF NOT EXISTS idx_account_notes_acct   ON account_notes(account_id);
    `);
    console.log('✓ Indexes created');

    console.log('\n✅ Database setup complete.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
