export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build a rich system prompt with full campaign context
    const systemPrompt = `You are a Senior Campaign Strategy Analyst for a performance marketing agency. 
You have deep expertise in Criteo campaign management, digital advertising, pacing analysis, and ROAS optimization.

You are currently analyzing the following campaign data:

ENTITY: ${context.currentNode.name} (${context.currentNode.level} level)
PACING STATUS: ${context.currentNode.pacing.pacing_status} at ${Math.round(context.currentNode.pacing.pacing_ratio * 100)}%
ACTUAL SPEND: ${context.config.currency}${context.currentNode.pacing.actual_spend.toLocaleString()}
EXPECTED SPEND: ${context.config.currency}${context.currentNode.pacing.expected_spend.toLocaleString()}
PROJECTED TOTAL: ${context.config.currency}${context.currentNode.pacing.projected_total_spend.toLocaleString()}
DAYS ELAPSED: ${context.currentNode.pacing.elapsed_days} of ${context.currentNode.pacing.total_days} (${context.currentNode.pacing.remaining_days} remaining)
KPI: ${context.currentNode.kpi_performance.kpi_name} = ${context.currentNode.kpi_performance.kpi_value.toLocaleString()} (Trend: ${context.currentNode.kpi_performance.kpi_trend})
PRIMARY KPI TARGET: ${context.config.kpi}
RISKS IDENTIFIED: ${context.currentNode.risks.length > 0 ? context.currentNode.risks.map((r: any) => `${r.severity.toUpperCase()} - ${r.title}: ${r.description}`).join(' | ') : 'None'}
PORTFOLIO SUMMARY: Total Spend ${context.config.currency}${context.summary.total_spend?.toLocaleString()}, ${context.summary.total_rows} rows analysed

Be concise, actionable, and data-driven. When drafting client emails, be professional and use the specific numbers above. 
Always refer to actual data from the context rather than making generic statements.`;

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Call Anthropic API directly
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`Anthropic API error: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'No response from assistant.';

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
