/**
 * Exercise 1 Solution: Break a Chatbot
 * 
 * This file contains the complete chatbot implementation that students will test
 * and break. The point is to demonstrate the limitations of prompt-only approaches.
 * 
 * INSTRUCTOR NOTE: This chatbot is intentionally limited. When students try to
 * "send emails" or "update leads," it will appear to comply but actually do nothing.
 * This is the "aha moment" we're building toward.
 */

import Anthropic from "@anthropic-ai/sdk";

// Initialize the Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The system prompt contains hardcoded "database" info
// This is exactly the problem - data is frozen in the prompt
const SYSTEM_PROMPT = `You are a helpful CRM assistant. You help users manage their sales leads.

The user has the following leads in their database:
- TechCorp Solutions (Sophie Martin, sophie@techcorp.io) - Score: 85, Status: qualified, Value: $45,000
- StartupXYZ (Marcus Chen, marcus@startupxyz.com) - Score: 40, Status: new, Value: $5,000
- GlobalRetail Inc (Amanda Rodriguez, a.rodriguez@globalretail.com) - Score: 92, Status: proposal, Value: $120,000
- LocalCafe (Tom Wilson, tom@localcafe.co) - Score: 25, Status: contacted, Value: $500
- MegaBank Financial (Dr. James Wright, jwright@megabank.com) - Score: 78, Status: qualified, Value: $80,000

When users ask about leads, reference this information accurately.
When users ask you to take actions (send emails, update status, add notes), 
respond as if you're doing it, but be clear that you've "completed" the action.

Be helpful and professional.`;

/**
 * Send a message to the chatbot and get a response
 */
async function chat(userMessage: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    
    if (response.content[0].type === "text") {
      return response.content[0].text;
    }
    
    return "No text response received";
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return "Unknown error occurred";
  }
}

/**
 * Run the test suite that demonstrates chatbot limitations
 * 
 * INSTRUCTOR NOTE: Walk through each failure case with students.
 * Ask them to predict what will happen before running each test.
 */
async function runTestSuite() {
  console.log("=".repeat(60));
  console.log("CHATBOT LIMITATION TESTS");
  console.log("=".repeat(60));
  
  const testCases = [
    // These SHOULD work (data is in prompt)
    {
      message: "Which lead has the highest score?",
      expected: "Should correctly identify GlobalRetail (92)",
      category: "Works - data in prompt",
    },
    {
      message: "What's Sophie's email at TechCorp?",
      expected: "Should return sophie@techcorp.io",
      category: "Works - data in prompt",
    },
    
    // These will FAIL (data not in prompt)
    {
      message: "Show me all leads created this week",
      expected: "Will make up data or say it can't access dates",
      category: "FAILS - no real database access",
    },
    {
      message: "How many leads did we close last month?",
      expected: "Will hallucinate or refuse",
      category: "FAILS - no historical data",
    },
    
    // These will appear to work but actually do nothing
    {
      message: "Send a follow-up email to Sophie at TechCorp",
      expected: "Will claim to send email, but nothing actually happens",
      category: "FAILS - no actual action",
    },
    {
      message: "Mark LocalCafe as lost - they went with a competitor",
      expected: "Will claim to update, but status is still 'contacted'",
      category: "FAILS - no persistence",
    },
    
    // This will expose the hallucination problem
    {
      message: "What's the status of the AcmeCorp lead?",
      expected: "Will either make up a lead or admit it doesn't exist",
      category: "FAILS - hallucinates or reveals limitations",
    },
    
    // Verification that "updates" didn't persist
    {
      message: "What's the current status of LocalCafe?",
      expected: "Will still say 'contacted' even after we 'marked it lost'",
      category: "FAILS - no state persistence",
    },
  ];
  
  for (const test of testCases) {
    console.log("\n" + "-".repeat(60));
    console.log(`CATEGORY: ${test.category}`);
    console.log(`MESSAGE: "${test.message}"`);
    console.log(`EXPECTED: ${test.expected}`);
    console.log("-".repeat(60));
    
    const response = await chat(test.message);
    console.log(`\nRESPONSE:\n${response}`);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUITE COMPLETE");
  console.log("=".repeat(60));
  console.log(`
DISCUSSION POINTS:

1. DATA STALENESS: The chatbot "knows" 5 leads, but what happens when
   the real database has 500? Or when data changes?

2. FALSE ACTIONS: The chatbot claims to send emails and update records,
   but nothing actually happens. How would you verify this?

3. NO MEMORY: After "updating" LocalCafe, asking about it shows the
   original status. The chatbot has no persistent memory.

4. HALLUCINATION: When asked about AcmeCorp (doesn't exist), the chatbot
   either makes up data or reveals it's just guessing.

KEY INSIGHT: Chatbots are text generators, not action takers.
Agents solve this by actually connecting to databases and APIs.
`);
}

// Interactive mode for manual testing
async function interactiveMode() {
  const message = process.argv[2];
  
  if (!message) {
    console.log("Usage: npx ts-node exercise-01-solution.ts \"your message here\"");
    console.log("Or run without args to execute full test suite");
    return;
  }
  
  console.log(`User: ${message}\n`);
  const response = await chat(message);
  console.log(`Bot: ${response}`);
}

// Main entry point
async function main() {
  if (process.argv[2]) {
    await interactiveMode();
  } else {
    await runTestSuite();
  }
}

main().catch(console.error);
