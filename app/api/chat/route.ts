import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { getAuthenticatedClient } from '../../../lib/supabase-server';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are an expert Performance Marketing Analyst and Campaign Manager assistant embedded in a portfolio pacing dashboard. Your role is to analyze campaign data and provide sharp, actionable insights.

Your capabilities include:
- Identifying under-pacing and over-pacing ad sets and suggesting specific budget reallocations
- Detecting anomalies in daily spend trends (e.g., sudden drops or spikes)
- Answering natural language questions like "Which accounts are likely to overspend by end of month?"
- Recommending bid strategy adjustments based on pacing ratios
- Summarizing portfolio health in clear, concise bullet points
- Flagging accounts that need immediate attention

Rules:
- Always reference specific account/campaign names from the context when available
- Quantify recommendations (e.g., "Increase budget by $X/day" not just "increase budget")
- Use marketing terminology correctly (CPM, CPC, ROAS, CTR, pacing ratio, etc.)
- Keep answers focused and actionable — avoid generic advice
- If context data is missing, ask the user to navigate to the relevant account first
- Format important numbers in bold using markdown

You are embedded in the Criteo Campaign Pacing Platform. Only answer questions related to campaign management, pacing, budgeting, and performance marketing.`;

export async function POST(req: NextRequest) {
  // Attempt to get auth context (optional — AI can still respond without portfolio data)
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

  const body = await req.json();
  const { messages } = body;

  const contextualSystem = portfolioContext
    ? `${SYSTEM_PROMPT}\n\n--- LIVE PORTFOLIO DATA ---\n${portfolioContext}\n--- END DATA ---`
    : SYSTEM_PROMPT;

  try {
    const result = streamText({
      model: anthropic('claude-3-5-haiku-20241022'),
      system: contextualSystem,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    // Fallback: if Anthropic key missing, return a helpful mock
    console.error('AI Chat error:', err);
    return new Response(
      JSON.stringify({ error: 'AI service unavailable. Please set ANTHROPIC_API_KEY in your Vercel environment.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
