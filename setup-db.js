const { Client } = require('pg');

const uri = 'postgresql://postgres:KBK517CACRITEO@db.gjbnxjvumokctckkxuvh.supabase.co:5432/postgres';

const client = new Client({ connectionString: uri });

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_name TEXT NOT NULL,
        region TEXT,
        currency TEXT,
        kpi TEXT,
        total_budget NUMERIC,
        start_date DATE,
        end_date DATE,
        csv_data JSONB,
        analysis_result JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Table "campaign_uploads" created successfully (if it did not exist).');

    // Add row-level security setup so Supabase API functions properly for an anon user if they save later
    await client.query(`
      ALTER TABLE campaign_uploads ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Enable insert for all users" ON campaign_uploads;
      CREATE POLICY "Enable insert for all users" ON campaign_uploads 
        FOR INSERT WITH CHECK (true);
        
      DROP POLICY IF EXISTS "Enable read access for all users" ON campaign_uploads;
      CREATE POLICY "Enable read access for all users" ON campaign_uploads 
        FOR SELECT USING (true);
    `);
    console.log('Row Level Security (RLS) policies set up successfully.');

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

run();
