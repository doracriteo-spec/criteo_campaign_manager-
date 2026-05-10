import fetch from 'node-fetch';

const GLEAN_API_KEY = process.env.GLEAN_API_KEY || '';
const GLEAN_BASE_URL = process.env.GLEAN_BASE_URL || 'https://domain.glean.com/api/v1';

export interface GleanMessage {
  author: 'USER' | 'AGENT';
  text: string;
}

/**
 * Fallback analysis for when API keys are missing.
 * Analyzes the context string and generates deterministic insights.
 */
function generateFallbackAnalysis(context: string): string {
  const lines = context.split('\n');
  const accounts: { name: string; spend: number; budget: number; pacing: number }[] = [];
  
  lines.forEach(line => {
    const match = line.match(/-\s+(.*?):\s+Spend\s+\$([\d,]+)\s+\/\s+Budget\s+\$([\d,]+)\s+\(([\d.]+)%\s+paced\)/);
    if (match) {
      accounts.push({
        name: match[1],
        spend: parseFloat(match[2].replace(/,/g, '')),
        budget: parseFloat(match[3].replace(/,/g, '')),
        pacing: parseFloat(match[4])
      });
    }
  });

  if (accounts.length === 0) {
    return "I've analyzed your account, but I don't see any active campaign metrics to report on yet. Please upload a campaign workbook to get started!";
  }

  const overPaced = accounts.filter(a => a.pacing > 105);
  const underPaced = accounts.filter(a => a.pacing < 95);
  
  let report = `### 📊 Local Campaign Analysis (Offline Mode)\n\nI've analyzed your **${accounts.length} accounts** based on the current portfolio data. Since the Glean API is not yet connected, I'm providing a deterministic analysis of your pacing health:\n\n`;

  if (overPaced.length > 0) {
    report += `#### ⚠️ Over-pacing Alert\nThese accounts are exceeding their expected run-rate:\n`;
    overPaced.forEach(a => {
      report += `- **${a.name}**: Paced at **${a.pacing}%**. You may want to decrease daily caps to avoid early budget depletion.\n`;
    });
    report += `\n`;
  }

  if (underPaced.length > 0) {
    report += `#### 📉 Under-pacing Opportunities\nThese accounts have significant unspent budget:\n`;
    underPaced.forEach(a => {
      report += `- **${a.name}**: Paced at **${a.pacing}%**. Consider broadening targeting or increasing bids to maximize reach.\n`;
    });
    report += `\n`;
  }

  if (overPaced.length === 0 && underPaced.length === 0) {
    report += `✅ **All accounts are perfectly on-track!** Your current delivery matches the expected linear spend for this period.\n\n`;
  }

  report += `\n*Note: To enable full AI reasoning and custom strategy advice, please configure your \`GLEAN_API_KEY\` in the project settings.*`;
  
  return report;
}

export async function chatWithGleanAgent(
  agentId: string,
  messages: GleanMessage[],
  contextData?: string
) {
  // If API key is missing, provide a smart fallback instead of a hard crash or generic error.
  if (!GLEAN_API_KEY) {
    const lastUserMessage = [...messages].reverse().find(m => m.author === 'USER')?.text || '';
    
    // If it's a general greeting or analysis request, provide the fallback report.
    if (!lastUserMessage || lastUserMessage.toLowerCase().includes('analyze') || lastUserMessage.toLowerCase().includes('status') || lastUserMessage.toLowerCase().includes('help')) {
      return {
        messages: [{
          author: 'AGENT',
          text: generateFallbackAnalysis(contextData || '')
        }]
      };
    }

    // For specific questions, provide a helpful "Offline" response.
    return {
      messages: [{
        author: 'AGENT',
        text: "I'm currently in **Offline Analysis Mode** because the Glean API is not connected. I can provide high-level pacing reports, but for specific strategic questions, please add your `GLEAN_API_KEY` to the environment variables."
      }]
    };
  }

  const payload = {
    agent: agentId,
    messages: messages,
    systemPrompt: contextData ? `Context:\n${contextData}` : undefined,
    stream: false
  };

  const response = await fetch(`${GLEAN_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLEAN_API_KEY}`,
      'X-Glean-Auth-Type': 'Bearer',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Glean API error: ${response.status} ${errorText}`);
  }

  return response.json();
}
