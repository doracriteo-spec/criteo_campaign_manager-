const { chatWithGleanAgent } = require('./lib/glean');

async function test() {
  console.log("Testing Glean Fallback...");
  try {
    const context = "Portfolio \\\"Main\\\":\\n  - Account A: Spend $500 / Budget $1000 (50.0% paced)\\n  - Account B: Spend $1200 / Budget $1000 (120.0% paced)";
    const result = await chatWithGleanAgent('test-id', [{ author: 'USER', text: 'Analyze status' }], context);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
