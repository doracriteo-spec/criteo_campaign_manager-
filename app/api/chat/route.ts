import { getAuthenticatedClient } from '../../../lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { chatWithGleanAgent, GleanMessage } from '../../../lib/glean';

export const runtime = 'nodejs';
export const maxDuration = 30;

const GLEAN_AGENT_ID = '029e132bac844e8baaf6cb20dea43213';

export async function POST(req: NextRequest) {
  let portfolioContext = '';
  
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth.error) {
      const { client, userId } = auth;
      // Fetch portfolio summary for context
      const { data: portfolios } = await client
        .from('portfolios')
        .select(`
          name,
          accounts (
            name, currency, kpi_metric, kpi_target,
            daily_metrics ( spend, budget, date )
          )
        `)
        .eq('user_id', userId)
        .limit(5);

      if (portfolios && portfolios.length > 0) {
        portfolioContext = portfolios.map(p => {
          const accountSummaries = (p.accounts as any[])?.map(a => {
            const metrics = (a.daily_metrics as any[]) || [];
            const totalSpend = metrics.reduce((s: number, m: any) => s + (m.spend || 0), 0);
            const totalBudget = metrics.reduce((s: number, m: any) => s + (m.budget || 0), 0);
            const pacing = totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : 'N/A';
            return `  - ${a.name}: Spend $${totalSpend.toFixed(0)} / Budget $${totalBudget.toFixed(0)} (${pacing}% paced)`;
          }).join('\n') || '  - No accounts yet';
          return `Portfolio "${p.name}":\n${accountSummaries}`;
        }).join('\n\n');
      }
    }
  } catch {
    // Auth optional for AI chat
  }

  try {
    const body = await req.json();
    const { messages } = body; // Array of { role: 'user' | 'assistant', content: string }
    
    // Map standard messages to Glean format
    const gleanMessages: GleanMessage[] = messages.map((m: any) => ({
      author: m.role === 'user' ? 'USER' : 'AGENT',
      text: m.content || m.text
    }));

    const responseData = await chatWithGleanAgent(
      GLEAN_AGENT_ID,
      gleanMessages,
      portfolioContext
    );

    // Adapt Glean response format to typical OpenAI/AI SDK format for the frontend
    // Assuming Glean returns { text: '...', ... } or { messages: [{ text: '...' }] }
    let responseText = 'No response from Glean';
    if (responseData && responseData.messages && responseData.messages.length > 0) {
      responseText = responseData.messages[responseData.messages.length - 1].text;
    } else if (responseData && responseData.text) {
      responseText = responseData.text;
    }

    return NextResponse.json({ text: responseText, reply: responseText });
  } catch (err: any) {
    console.error('Glean Chat error:', err);
    return NextResponse.json(
      { error: err.message || 'AI service unavailable' },
      { status: 500 }
    );
  }
}
