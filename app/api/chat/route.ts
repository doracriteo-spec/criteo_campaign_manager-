export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID || !process.env.AZURE_BOT_ID) {
      return new Response(
        JSON.stringify({ error: "Microsoft Copilot Studio credentials missing in .env.local" }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get OAuth Token from Microsoft Entra (Azure AD)
    // This token proves our identity to the Bot Framework
    const authResponse = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'https://api.botframework.com/.default',
      }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      throw new Error(`Azure Auth Failed: ${errorData.error_description || authResponse.statusText}`);
    }

    const { access_token } = await authResponse.json();

    // 2. Start Conversation with Direct Line using the AD token
    // We use the global Bot Framework endpoint which trusts Azure AD tokens for registered bots
    const convResponse = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!convResponse.ok) {
      const errorText = await convResponse.text();
      console.error('Direct Line Conv Error:', errorText);
      throw new Error(`Failed to start Direct Line conversation. Your bot might not have the 'Direct Line' channel enabled in Copilot Studio. Error: ${errorText}`);
    }

    const { conversationId, token: sessionToken } = await convResponse.json();

    // 3. Send Message to Bot (including Campaign Context)
    // Format the context so the custom Copilot can parse it
    const contextString = `
[CONTEXT DATA]
Entity: ${context.currentNode.name}
Level: ${context.currentNode.level}
Pacing: ${Math.round(context.currentNode.pacing.pacing_ratio * 100)}% (${context.currentNode.pacing.pacing_status})
Spend: ${context.currentNode.pacing.actual_spend} / ${context.currentNode.pacing.expected_spend}
KPI: ${context.currentNode.kpi_performance.kpi_name} = ${context.currentNode.kpi_performance.kpi_value}
Risks: ${context.currentNode.risks.length > 0 ? context.currentNode.risks.map((r: any) => r.title).join(', ') : 'None'}
[/CONTEXT DATA]

User Message: ${lastMessage.content}
    `;

    const sendResponse = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'message',
        from: { id: 'user1', name: 'Campaign Manager' },
        text: contextString,
      }),
    });

    if (!sendResponse.ok) {
      throw new Error('Failed to send message to Copilot Studio');
    }

    // 4. Poll for Response
    let botReply = "";
    let foundResponse = false;
    let attempts = 0;
    const maxAttempts = 12; // Increased attempts for Copilot Studio processing

    while (!foundResponse && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for bot processing
      
      const pollResponse = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (pollResponse.ok) {
        const { activities } = await pollResponse.json();
        // Find the most recent message from the bot
        const botActivities = activities.filter((a: any) => 
          a.from.id !== 'user1' && 
          a.type === 'message' && 
          a.text
        );

        if (botActivities.length > 0) {
          botReply = botActivities[botActivities.length - 1].text;
          foundResponse = true;
        }
      }
      attempts++;
    }

    if (!foundResponse) {
      botReply = "Your Copilot Studio agent is processing the request. If you don't see a reply, please ensure the bot is published and the 'Direct Line' channel is active.";
    }

    return new Response(JSON.stringify({ reply: botReply }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Copilot Studio Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred connecting to your Copilot Studio agent." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
