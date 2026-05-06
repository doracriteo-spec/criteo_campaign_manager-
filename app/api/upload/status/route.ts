import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  try {
    const { data: job, error } = await supabaseAdmin
      .from('upload_jobs')
      .select('*, import_row_audit(count)')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job }, { status: 200 });
  } catch (err: any) {
    console.error('Job status check failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
