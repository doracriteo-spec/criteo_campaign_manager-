export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_BOT_ID) {
      return new Response(
        JSON.stringify({ error: "Microsoft Copilot Studio credentials missing. Please check your .env.local file." }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get Direct Line Token from Copilot Studio
    let dlToken = "";
    
    // First try the environment-specific endpoint (most reliable for regional bots)
    const envId = process.env.AZURE_ENVIRONMENT_ID?.replace('Default-', '');
    const regionalUrl = `https://${envId}.environment.api.powerplatform.com/powervirtualagents/bots/${process.env.AZURE_BOT_ID}/directline/token?api-version=2022-03-01-preview`;
    const globalUrl = `https://powerva.microsoft.com/api/botmanagement/v1/directline/directlinetoken?botId=${process.env.AZURE_BOT_ID}`;

    let tokenResponse = await fetch(regionalUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.AZURE_CLIENT_SECRET}` }
    });

    if (!tokenResponse.ok) {
      console.log('Regional endpoint failed, trying global proxy...');
      tokenResponse = await fetch(globalUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.AZURE_CLIENT_SECRET}` }
      });
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Copilot Token Error:', errorText);
      throw new Error(`Failed to get Direct Line token. Error: ${errorText}. Please verify that the bot is published and the Client Secret is correct.`);
    }

    const tokenData = await tokenResponse.json();
    dlToken = tokenData.token;

    // 2. Start Conversation with Direct Line
    const convResponse = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dlToken}` },
    });

    if (!convResponse.ok) {
      throw new Error('Failed to start Direct Line conversation with the retrieved token.');
    }

    const { conversationId, token: sessionToken } = await convResponse.json();

    // 3. Send Message to Bot (including Campaign Context)
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
        Authorization: `Bearer ${sessionToken}`,
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
    const maxAttempts = 10;

    while (!foundResponse && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for bot processing
      
      const pollResponse = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (pollResponse.ok) {
        const { activities } = await pollResponse.json();
        const botActivity = activities.find((a: any) => 
          a.from.id !== 'user1' && 
          a.type === 'message' && 
          a.text
        );

        if (botActivity) {
          botReply = botActivity.text;
          foundResponse = true;
        }
      }
      attempts++;
    }

    if (!foundResponse) {
      botReply = "Copilot Studio is taking longer than usual to respond. Please check your bot status.";
    }

    return new Response(JSON.stringify({ reply: botReply }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Copilot Studio Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred connecting to Copilot Studio." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
