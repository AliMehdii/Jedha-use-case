/**
 * Exercise 3 Solution: Multi-Node Flow
 * 
 * This builds on Exercise 2 by adding conditional routing.
 * The key concept is that the router function returns a STRING (node name),
 * not a modified state.
 * 
 * INSTRUCTOR NOTE: Many students will try to modify state in the router.
 * Emphasize that routers are pure decision functions - they just pick
 * the next node based on current state.
 */

import { StateGraph, END } from "@langchain/langgraph";
import Anthropic from "@anthropic-ai/sdk";

// ============================================
// Type Definitions
// ============================================

interface AgentIntent {
  type: "lookup" | "qualify" | "followup" | "update" | "unknown";
  target?: string;
  details?: string;
  confidence?: "high" | "medium" | "low";
}

interface AgentState {
  userMessage: string;
  intent: AgentIntent | null;
  response: string | null;
  error: string | null;
}

// ============================================
// LLM Client
// ============================================

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

// ============================================
// Nodes
// ============================================

/**
 * Node 1: Understand the request (from Exercise 2)
 */
async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  const userMessage = state.userMessage;
  
  const classificationPrompt = `You are a CRM assistant that classifies user requests.

Classify the following message into exactly ONE category:

- "lookup": User wants to SEE or FIND lead information
- "qualify": User wants to ANALYZE or SCORE a specific lead
- "followup": User wants to SEND COMMUNICATION to a lead
- "update": User wants to CHANGE lead data
- "unknown": Cannot determine intent OR it's unrelated to CRM

User message: "${userMessage}"

Respond with ONLY valid JSON:
{"type": "lookup|qualify|followup|update|unknown", "target": "company/person name or null", "details": "additional info or null"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: classificationPrompt }],
    });
    
    const responseText = response.content[0].type === "text" 
      ? response.content[0].text 
      : "{}";
    
    // Extract JSON safely
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const intent = jsonMatch 
      ? JSON.parse(jsonMatch[0]) 
      : { type: "unknown" };
    
    console.log(`[understand_request] Classified as: ${intent.type}`);
    
    return { intent };
    
  } catch (error) {
    console.error("[understand_request] Error:", error);
    return {
      intent: { type: "unknown", details: "Classification failed" },
      error: `Classification error: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

/**
 * Node 2: Handle lookup requests
 * 
 * In Exercise 4, this will actually query Supabase.
 * For now, it's a placeholder that acknowledges the request.
 */
async function handleLookup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target || "all leads";
  
  console.log(`[handle_lookup] Looking up: ${target}`);
  
  // Placeholder response - will be replaced with real data in Exercise 4
  return {
    response: `🔍 Looking up ${target}...

[In Exercise 4, this will show real data from Supabase]

For now, imagine you see:
- TechCorp Solutions (Score: 85)
- GlobalRetail Inc (Score: 92)
- MegaBank Financial (Score: 78)`,
  };
}

/**
 * Node 3: Handle qualify requests
 * 
 * INSTRUCTOR NOTE: This is a stretch goal in the exercise.
 * Some students may not implement it.
 */
async function handleQualify(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  
  console.log(`[handle_qualify] Qualifying: ${target || "unspecified"}`);
  
  if (!target) {
    return {
      response: "Which lead would you like me to qualify? Please specify a company name.",
    };
  }
  
  return {
    response: `📊 Analyzing ${target} for qualification...

[Tomorrow, this will run actual qualification logic]

Factors to consider:
- Company size and budget
- Timeline urgency
- Decision-maker engagement
- Fit with our product`,
  };
}

/**
 * Node 4: Handle other requests (followup, update, unknown)
 * 
 * These are grouped together because they all need features
 * we haven't built yet (database writes, email sending).
 */
async function handleOther(state: AgentState): Promise<Partial<AgentState>> {
  const intentType = state.intent?.type || "unknown";
  const target = state.intent?.target;
  
  console.log(`[handle_other] Intent type: ${intentType}`);
  
  switch (intentType) {
    case "followup":
      return {
        response: `📧 You want to follow up with ${target || "someone"}.

[Tomorrow, this will actually send emails via Resend]

For now, I can't send emails yet. Check back after we add the email integration!`,
      };
      
    case "update":
      return {
        response: `✏️ You want to update ${target || "a lead"}.

[Tomorrow, this will update Supabase with human approval]

For now, I can't modify data. Check back after we add write operations with approval flow!`,
      };
      
    case "unknown":
    default:
      return {
        response: `🤔 I'm not sure what you're asking for.

Try something like:
- "Show me hot leads"
- "What's the status of TechCorp?"
- "Qualify the GlobalRetail lead"

I'm your CRM assistant - I help you manage sales leads!`,
      };
  }
}

// ============================================
// Router
// ============================================

/**
 * Decides which handler node to run based on classified intent.
 * 
 * CRITICAL: This returns a STRING (the node name), not modified state.
 * 
 * COMMON MISTAKE: Students try to do work in the router.
 * Routers should be simple, pure functions with no side effects.
 */
function routeByIntent(state: AgentState): string {
  const intentType = state.intent?.type;
  
  console.log(`[router] Routing intent type: ${intentType}`);
  
  switch (intentType) {
    case "lookup":
      return "handle_lookup";
    case "qualify":
      return "handle_qualify";
    default:
      // followup, update, unknown all go to handle_other
      return "handle_other";
  }
}

// ============================================
// Graph Construction
// ============================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a: string, b: string) => b ?? a },
    intent: { value: (a: AgentIntent | null, b: AgentIntent | null) => b ?? a },
    response: { value: (a: string | null, b: string | null) => b ?? a },
    error: { value: (a: string | null, b: string | null) => b ?? a },
  },
});

// Add all nodes
workflow.addNode("understand_request", understandRequest);
workflow.addNode("handle_lookup", handleLookup);
workflow.addNode("handle_qualify", handleQualify);
workflow.addNode("handle_other", handleOther);

// Set entry point
workflow.setEntryPoint("understand_request");

// Add conditional routing after understanding
workflow.addConditionalEdges(
  "understand_request",  // From this node...
  routeByIntent,         // Run this function to get destination...
  {
    // Map return values to node names
    handle_lookup: "handle_lookup",
    handle_qualify: "handle_qualify",
    handle_other: "handle_other",
  }
);

// All handlers lead to END
workflow.addEdge("handle_lookup", END);
workflow.addEdge("handle_qualify", END);
workflow.addEdge("handle_other", END);

// Compile the graph
const app = workflow.compile();

// ============================================
// Testing
// ============================================

async function runTests() {
  const testCases = [
    // Lookup path
    { message: "Show me all leads", expectedPath: "lookup" },
    { message: "What's TechCorp's status?", expectedPath: "lookup" },
    { message: "Find hot leads", expectedPath: "lookup" },
    
    // Qualify path
    { message: "Qualify TechCorp", expectedPath: "qualify" },
    { message: "Analyze GlobalRetail as a prospect", expectedPath: "qualify" },
    
    // Other paths
    { message: "Send email to Sophie", expectedPath: "other" },
    { message: "Mark as won", expectedPath: "other" },
    { message: "Hello!", expectedPath: "other" },
  ];
  
  console.log("=".repeat(60));
  console.log("MULTI-NODE ROUTING TESTS");
  console.log("=".repeat(60));
  
  for (const test of testCases) {
    console.log(`\n--- Testing: "${test.message}" ---`);
    console.log(`Expected path: ${test.expectedPath}`);
    
    const result = await app.invoke({
      userMessage: test.message,
      intent: null,
      response: null,
      error: null,
    });
    
    // Determine which path was taken by checking response content
    let actualPath = "unknown";
    if (result.response?.includes("Looking up")) actualPath = "lookup";
    else if (result.response?.includes("Analyzing")) actualPath = "qualify";
    else if (result.response?.includes("follow up") || 
             result.response?.includes("update") ||
             result.response?.includes("not sure")) actualPath = "other";
    
    const match = actualPath === test.expectedPath ? "✓" : "✗";
    console.log(`Actual path: ${actualPath} ${match}`);
    console.log(`Response preview: ${result.response?.slice(0, 50)}...`);
  }
}

async function main() {
  if (process.argv[2]) {
    // Single message
    const result = await app.invoke({
      userMessage: process.argv[2],
      intent: null,
      response: null,
      error: null,
    });
    console.log("\n" + "=".repeat(60));
    console.log("RESULT");
    console.log("=".repeat(60));
    console.log(`Intent: ${JSON.stringify(result.intent)}`);
    console.log(`\nResponse:\n${result.response}`);
  } else {
    // Test suite
    await runTests();
  }
}

main().catch(console.error);
