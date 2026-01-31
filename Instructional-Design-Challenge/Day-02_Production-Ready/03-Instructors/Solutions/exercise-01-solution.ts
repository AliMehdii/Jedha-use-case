/**
 * Exercise 1 Solution: The Infinite Loop Challenge
 * 
 * This file shows both the buggy version and the fixed version.
 * Students should arrive at similar fixes, though implementation details may vary.
 * 
 * INSTRUCTOR NOTE: Walk through each bug fix systematically. The key insight
 * is that agents need explicit termination conditions - they won't "figure it out."
 */

import { StateGraph, END } from "@langchain/langgraph";

// ============================================
// Type Definitions
// ============================================

interface AgentState {
  userMessage: string;
  attempts: number;
  maxAttempts: number;
  response: string | null;
  needsMoreInfo: boolean;
  askedForClarification: boolean;  // NEW: Track if we already asked
  error: string | null;
}

// ============================================
// FIXED Nodes
// ============================================

/**
 * Fixed analyzeRequest node with proper termination conditions.
 * 
 * FIXES:
 * 1. Checks maxAttempts before continuing
 * 2. Sets needsMoreInfo to false when successful
 * 3. Properly handles the "already asked" case
 */
async function analyzeRequest(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`[analyze] Attempt ${state.attempts + 1}/${state.maxAttempts}`);
  
  // FIX #1: Check if we've exceeded max attempts
  if (state.attempts >= state.maxAttempts) {
    console.log("[analyze] Max attempts reached, giving up");
    return {
      response: "I wasn't able to understand your request after several tries. Could you try rephrasing it differently?",
      needsMoreInfo: false,  // Important: stop the loop
      error: "Max attempts exceeded",
    };
  }
  
  // FIX #2: If we already asked for clarification, don't ask again
  if (state.askedForClarification) {
    console.log("[analyze] Already asked for clarification, proceeding with best effort");
    return {
      response: `I'll do my best with what you told me: "${state.userMessage}"`,
      needsMoreInfo: false,  // Stop asking
      attempts: state.attempts + 1,
    };
  }
  
  // Original logic: short messages need clarification
  if (state.userMessage.length < 20) {
    console.log("[analyze] Message too short, flagging for clarification");
    return {
      needsMoreInfo: true,
      attempts: state.attempts + 1,
    };
  }
  
  // Success case
  console.log("[analyze] Message is sufficient, proceeding");
  return {
    response: `Analyzed successfully: "${state.userMessage}"`,
    needsMoreInfo: false,
    attempts: state.attempts + 1,
  };
}

/**
 * Fixed requestClarification node.
 * 
 * FIXES:
 * 1. Sets askedForClarification to true
 * 2. Sets needsMoreInfo to false to break the immediate loop
 */
async function requestClarification(state: AgentState): Promise<Partial<AgentState>> {
  console.log("[clarify] Asking for more info (once only)");
  
  return {
    response: "Could you provide more details? Your message seems a bit short.",
    needsMoreInfo: false,  // FIX: Clear the flag
    askedForClarification: true,  // FIX: Remember we asked
  };
}

// ============================================
// FIXED Router
// ============================================

/**
 * Fixed router with multiple termination conditions.
 * 
 * FIXES:
 * 1. Checks for response (success)
 * 2. Checks for max attempts
 * 3. Checks for error state
 * 4. Only routes to clarification if actually needed AND not already asked
 */
function routeAnalysis(state: AgentState): string {
  console.log(`[router] Routing... needsMoreInfo=${state.needsMoreInfo}, attempts=${state.attempts}, hasResponse=${!!state.response}`);
  
  // FIX #1: If we have a response, we're done
  if (state.response) {
    console.log("[router] Have response, ending");
    return "end";
  }
  
  // FIX #2: If we hit max attempts, we're done
  if (state.attempts >= state.maxAttempts) {
    console.log("[router] Max attempts reached, ending");
    return "end";
  }
  
  // FIX #3: If there's an error, we're done
  if (state.error) {
    console.log("[router] Error state, ending");
    return "end";
  }
  
  // FIX #4: Only request clarification if needed AND we haven't asked yet
  if (state.needsMoreInfo && !state.askedForClarification) {
    console.log("[router] Needs clarification, routing to request_clarification");
    return "request_clarification";
  }
  
  // Default: continue analyzing (but attempts will increment)
  console.log("[router] Default case, ending to prevent infinite loop");
  return "end";
}

// ============================================
// Fixed Graph
// ============================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a: string, b: string) => b ?? a },
    attempts: { value: (a: number, b: number) => b ?? a },
    maxAttempts: { value: (a: number, b: number) => b ?? a },
    response: { value: (a: string | null, b: string | null) => b ?? a },
    needsMoreInfo: { value: (a: boolean, b: boolean) => b ?? a },
    askedForClarification: { value: (a: boolean, b: boolean) => b ?? a },
    error: { value: (a: string | null, b: string | null) => b ?? a },
  },
});

workflow.addNode("analyze_request", analyzeRequest);
workflow.addNode("request_clarification", requestClarification);

workflow.setEntryPoint("analyze_request");

// Conditional routing after analysis
workflow.addConditionalEdges(
  "analyze_request",
  routeAnalysis,
  {
    request_clarification: "request_clarification",
    end: END,
  }
);

// After clarification, go back to analysis (but now askedForClarification is true)
workflow.addEdge("request_clarification", "analyze_request");

const app = workflow.compile();

// ============================================
// Testing
// ============================================

async function runTests() {
  console.log("=".repeat(60));
  console.log("FIXED AGENT TESTS");
  console.log("=".repeat(60));
  
  const testCases = [
    {
      name: "Short message (triggers clarification once)",
      input: "Hi",
      expectClarification: true,
    },
    {
      name: "Long message (no clarification needed)",
      input: "Show me all the leads in my database please",
      expectClarification: false,
    },
    {
      name: "Empty message",
      input: "",
      expectClarification: true,
    },
    {
      name: "Edge case: exactly 20 characters",
      input: "Show me all my lead",  // 19 chars
      expectClarification: true,
    },
  ];
  
  for (const test of testCases) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`TEST: ${test.name}`);
    console.log(`Input: "${test.input}" (${test.input.length} chars)`);
    console.log(`Expected clarification: ${test.expectClarification}`);
    console.log("─".repeat(60));
    
    const startTime = Date.now();
    
    const result = await app.invoke({
      userMessage: test.input,
      attempts: 0,
      maxAttempts: 3,
      response: null,
      needsMoreInfo: false,
      askedForClarification: false,
      error: null,
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\nResult (${elapsed}ms):`);
    console.log(`  Attempts: ${result.attempts}`);
    console.log(`  Asked for clarification: ${result.askedForClarification}`);
    console.log(`  Response: ${result.response}`);
    console.log(`  Error: ${result.error || "none"}`);
    
    // Verify no infinite loop (should complete in under 5 seconds)
    if (elapsed > 5000) {
      console.log("⚠️ WARNING: Test took too long - possible infinite loop!");
    } else {
      console.log("✓ Completed in reasonable time");
    }
    
    // Verify max attempts wasn't exceeded
    if (result.attempts > 3) {
      console.log("⚠️ WARNING: Exceeded max attempts!");
    } else {
      console.log("✓ Stayed within attempt limit");
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("ALL TESTS COMPLETE");
  console.log("=".repeat(60));
}

// ============================================
// Main
// ============================================

async function main() {
  if (process.argv[2] === "buggy") {
    console.log("Running BUGGY version - be ready to Ctrl+C!");
    // Would run buggy version here
  } else {
    await runTests();
  }
}

main().catch(console.error);
