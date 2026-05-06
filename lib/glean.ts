import fetch from 'node-fetch';

const GLEAN_API_KEY = process.env.GLEAN_API_KEY || '';
const GLEAN_BASE_URL = process.env.GLEAN_BASE_URL || 'https://domain.glean.com/api/v1';

export interface GleanMessage {
  author: 'USER' | 'AGENT';
  text: string;
}

export async function chatWithGleanAgent(
  agentId: string,
  messages: GleanMessage[],
  contextData?: string
) {
  if (!GLEAN_API_KEY) {
    throw new Error('GLEAN_API_KEY is not configured');
  }

  // Construct the payload according to typical Glean agent chat API structure
  const payload = {
    agent: agentId,
    messages: messages,
    // Provide additional prompt context if needed and supported
    systemPrompt: contextData ? `Context:\n${contextData}` : undefined,
    stream: false // Using non-streaming for simplicity, can be updated if streaming is required
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
    console.error('Glean API error:', response.status, errorText);
    throw new Error(`Glean API error: ${response.status} ${errorText}`);
  }

  return response.json();
}
