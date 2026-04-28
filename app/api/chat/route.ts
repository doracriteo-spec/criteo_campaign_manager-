export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
      return new Response(
        JSON.stringify({ error: "Azure credentials missing. Please check your .env.local file." }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get OAuth Token from Microsoft
    const tokenResponse = await fetch(process.env.AZURE_TOKEN_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        grant_type: 'client_credentials',
        scope: 'https://api.botframework.com/.default',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Azure Auth Failed: ${JSON.stringify(errorData)}`);
    }

    const { access_token } = await tokenResponse.json();

    // 2. Start Conversation with Direct Line
    const convResponse = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!convResponse.ok) {
      throw new Error('Failed to start Direct Line conversation');
    }

    const { conversationId, token: dlToken } = await convResponse.json();

    // 3. Send Message to Bot (including Campaign Context)
    // We send the context as part of the message to ensure Copilot "reads" the data
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
        Authorization: `Bearer ${dlToken}`,
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
    // We return a stream so the UI feels responsive
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let foundResponse = false;
        let attempts = 0;
        const maxAttempts = 15;

        while (!foundResponse && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for bot processing
          
          const pollResponse = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
            headers: { Authorization: `Bearer ${dlToken}` },
          });

          if (pollResponse.ok) {
            const { activities } = await pollResponse.json();
            // Find the first message from the bot that isn't our own message
            const botActivity = activities.find((a: any) => 
              a.from.id !== 'user1' && 
              a.type === 'message' && 
              a.text
            );

            if (botActivity) {
              // Format for AI SDK useChat compatibility (0: is text chunk)
              controller.enqueue(encoder.encode(`0:${JSON.stringify(botActivity.text)}\n`));
              foundResponse = true;
            }
          }
          attempts++;
        }

        if (!foundResponse) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify("Copilot Studio is taking a bit longer to respond. Please check your bot status in the portal.")}\n`));
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error: any) {
    console.error('Copilot Studio Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred connecting to Copilot Studio." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
