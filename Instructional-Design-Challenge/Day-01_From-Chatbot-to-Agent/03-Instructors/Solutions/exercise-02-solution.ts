/**
 * Exercise 2 Solution: Your First Node
 * 
 * This is the complete implementation of the intent classification node.
 * Students should arrive at something similar, though their prompt wording
 * may differ.
 * 
 * INSTRUCTOR NOTE: The key learning here is the node signature:
 * (state) => Partial<state>. Everything else is implementation details.
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
// LLM Client Setup
// ============================================

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

// ============================================
// Intent Classification Node
// ============================================

/**
 * Classifies user intent using Claude.
 * 
 * APPROACH: Few-shot prompting with clear category definitions.
 * We ask for JSON output and parse it carefully.
 * 
 * COMMON MISTAKES:
 * 1. Not handling malformed JSON (Claude sometimes adds explanation text)
 * 2. Using vague category definitions that overlap
 * 3. Not providing examples for edge cases
 */
async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  const userMessage = state.userMessage;
  
  // The prompt is carefully structured:
  // 1. Clear role definition
  // 2. Explicit category definitions with examples
  // 3. JSON-only output instruction
  // 4. Edge case guidance
  const classificationPrompt = `You are a CRM assistant that classifies user requests.

Classify the following message into exactly ONE category:

CATEGORIES:
- "lookup": User wants to SEE or FIND lead information
  Examples: "show me leads", "what's TechCorp's status", "find hot leads", "list all contacts"
  
- "qualify": User wants to ANALYZE or SCORE a specific lead
  Examples: "qualify the TechCorp lead", "analyze this prospect", "score GlobalRetail"
  
- "followup": User wants to SEND COMMUNICATION to a lead
  Examples: "send email to Sophie", "follow up with TechCorp", "reach out to the new leads"
  
- "update": User wants to CHANGE lead data
  Examples: "mark as won", "update status to qualified", "add a note", "change the score"
  
- "unknown": Cannot determine intent OR it's unrelated to CRM
  Examples: "hello", "what's the weather", "tell me a joke"

User message: "${userMessage}"

Respond with ONLY valid JSON, no other text:
{"type": "lookup|qualify|followup|update|unknown", "target": "company/person name if mentioned or null", "details": "any relevant additional info or null", "confidence": "high|medium|low"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: classificationPrompt }],
    });
    
    // Extract text from response
    const responseText = response.content[0].type === "text" 
      ? response.content[0].text 
      : "";
    
    // Parse JSON (with fallback for malformed responses)
    const intent = extractJsonSafely(responseText);
    
    // Validate the intent type
    const validTypes = ["lookup", "qualify", "followup", "update", "unknown"];
    if (!validTypes.includes(intent.type)) {
      intent.type = "unknown";
    }
    
    return {
      intent: intent as AgentIntent,
    };
    
  } catch (error) {
    // Log the error for debugging, but don't expose details to user
    console.error("Intent classification failed:", error);
    
    return {
      intent: {
        type: "unknown",
        details: "Failed to classify intent",
        confidence: "low",
      },
      error: `Classification error: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

/**
 * Safely extract JSON from LLM response.
 * 
 * Claude sometimes adds text before/after the JSON, so we need
 * to find and extract just the JSON portion.
 */
function extractJsonSafely(text: string): Record<string, unknown> {
  // Try parsing the whole thing first
  try {
    return JSON.parse(text);
  } catch {
    // Find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to default
      }
    }
  }
  
  // Default if all parsing fails
  return {
    type: "unknown",
    target: null,
    details: "Could not parse LLM response",
    confidence: "low",
  };
}

// ============================================
// Graph Setup (Minimal - just the one node)
// ============================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a: string, b: string) => b ?? a },
    intent: { value: (a: AgentIntent | null, b: AgentIntent | null) => b ?? a },
    response: { value: (a: string | null, b: string | null) => b ?? a },
    error: { value: (a: string | null, b: string | null) => b ?? a },
  },
});

workflow.addNode("understand_request", understandRequest);
workflow.setEntryPoint("understand_request");
workflow.addEdge("understand_request", END);

const app = workflow.compile();

// ============================================
// Test Suite
// ============================================

async function runTests() {
  const testCases = [
    // Clear lookup cases
    { message: "Show me all my leads", expectedType: "lookup" },
    { message: "What's the status of TechCorp?", expectedType: "lookup" },
    { message: "Find hot leads", expectedType: "lookup" },
    
    // Clear qualify cases
    { message: "Qualify the TechCorp lead", expectedType: "qualify" },
    { message: "Analyze GlobalRetail as a prospect", expectedType: "qualify" },
    
    // Clear followup cases
    { message: "Send a follow-up email to Sophie", expectedType: "followup" },
    { message: "Reach out to the new leads", expectedType: "followup" },
    
    // Clear update cases
    { message: "Mark TechCorp as won", expectedType: "update" },
    { message: "Update LocalCafe status to lost", expectedType: "update" },
    { message: "Add a note to the MegaBank lead", expectedType: "update" },
    
    // Edge cases (should be unknown)
    { message: "Hello, how are you?", expectedType: "unknown" },
    { message: "What's the weather like?", expectedType: "unknown" },
    { message: "asdfghjkl", expectedType: "unknown" },
    
    // Ambiguous cases (classifier should still pick one)
    { message: "TechCorp", expectedType: "lookup" }, // Most likely looking up
    { message: "Can you help with TechCorp?", expectedType: "lookup" }, // Probably looking up
  ];
  
  console.log("=".repeat(60));
  console.log("INTENT CLASSIFICATION TESTS");
  console.log("=".repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const result = await app.invoke({
      userMessage: test.message,
      intent: null,
      response: null,
      error: null,
    });
    
    const actualType = result.intent?.type;
    const isCorrect = actualType === test.expectedType;
    
    if (isCorrect) {
      passed++;
      console.log(`✓ "${test.message}" → ${actualType}`);
    } else {
      failed++;
      console.log(`✗ "${test.message}"`);
      console.log(`  Expected: ${test.expectedType}`);
      console.log(`  Got: ${actualType}`);
      console.log(`  Full intent: ${JSON.stringify(result.intent)}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed}/${passed + failed} passed`);
  console.log("=".repeat(60));
  
  // Note: Some "failures" may be acceptable - LLMs are probabilistic
  if (failed > 3) {
    console.log(`
NOTE: More than 3 tests failed. This could be due to:
1. Ambiguous test cases (LLM made a reasonable choice)
2. Prompt needs refinement
3. API issues

Check the full intent output to understand WHY classifications differ.
`);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  if (process.argv[2]) {
    // Single message test
    const result = await app.invoke({
      userMessage: process.argv[2],
      intent: null,
      response: null,
      error: null,
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } else {
    // Full test suite
    await runTests();
  }
}

main().catch(console.error);
