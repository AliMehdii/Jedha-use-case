/**
 * Day-01 Complete Starter Code
 * 
 * Use this if you need to catch up before starting Day-02.
 * This provides a working CRM agent with:
 * - Intent classification
 * - Lead querying from Supabase
 * - Basic routing and state management
 * 
 * Day-02 will add: approval flows, error handling, deployment
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END } from "@langchain/langgraph";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Configuration
// ============================================================================

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const llm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0,
  anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

// ============================================================================
// Types
// ============================================================================

interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  status: "new" | "qualified" | "won" | "lost";
  score: number;
  notes: string | null;
  created_at: string;
  last_contacted_at: string | null;
}

type IntentType = "query" | "update" | "followup" | "unknown";

interface AgentIntent {
  type: IntentType;
  target?: string;
  filters?: {
    status?: string;
    minScore?: number;
  };
}

interface AgentState {
  userMessage: string;
  intent: AgentIntent | null;
  leads: Lead[];
  response: string | null;
  error: string | null;
}

// ============================================================================
// Agent Nodes
// ============================================================================

/**
 * Classify user intent using LLM
 */
async function classifyIntent(state: AgentState): Promise<Partial<AgentState>> {
  const message = state.userMessage;
  
  const prompt = `You are a CRM assistant. Classify the user's intent.

User message: "${message}"

Respond with JSON:
{
  "type": "query" | "update" | "followup" | "unknown",
  "target": "company/person name if mentioned",
  "filters": {
    "status": "if status filter mentioned (new/qualified/won/lost)",
    "minScore": "if score threshold mentioned (0-100)"
  }
}

Examples:
- "Show me hot leads" → {"type": "query", "filters": {"minScore": 70}}
- "What's the status of TechCorp?" → {"type": "query", "target": "TechCorp"}
- "Mark LocalCafe as won" → {"type": "update", "target": "LocalCafe"}
- "Send follow-up to GlobalRetail" → {"type": "followup", "target": "GlobalRetail"}`;

  try {
    const response = await llm.invoke([{ role: "user", content: prompt }]);
    const intent = JSON.parse(response.content as string);
    
    return { intent };
  } catch (error) {
    console.error("Intent classification failed:", error);
    return {
      intent: { type: "unknown" },
      error: "Could not understand your request. Please try rephrasing.",
    };
  }
}

/**
 * Query leads from Supabase
 */
async function queryLeads(state: AgentState): Promise<Partial<AgentState>> {
  const intent = state.intent;
  
  if (!intent) {
    return {
      response: "I'm not sure what you're asking. Could you rephrase?",
    };
  }
  
  try {
    let query = supabase.from("leads").select("*");
    
    // Apply target filter (company name search)
    if (intent.target) {
      query = query.ilike("company_name", `%${intent.target}%`);
    }
    
    // Apply status filter
    if (intent.filters?.status) {
      query = query.eq("status", intent.filters.status);
    }
    
    // Apply score filter
    if (intent.filters?.minScore) {
      query = query.gte("score", intent.filters.minScore);
    }
    
    const { data, error } = await query.order("score", { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return { leads: data || [] };
    
  } catch (error) {
    console.error("Query failed:", error);
    return {
      error: "Failed to query leads from database",
      response: "I had trouble accessing the database. Please try again.",
    };
  }
}

/**
 * Format leads into a user-friendly response
 */
async function formatResponse(state: AgentState): Promise<Partial<AgentState>> {
  const leads = state.leads;
  
  if (!leads || leads.length === 0) {
    return {
      response: "I didn't find any leads matching your criteria. Try a different search.",
    };
  }
  
  // If single lead, provide detailed info
  if (leads.length === 1) {
    const lead = leads[0];
    return {
      response: `**${lead.company_name}**
Contact: ${lead.contact_name} (${lead.contact_email})
Status: ${lead.status}
Score: ${lead.score}/100
${lead.notes ? `\nNotes: ${lead.notes}` : ""}
${lead.last_contacted_at ? `\nLast contacted: ${new Date(lead.last_contacted_at).toLocaleDateString()}` : ""}`,
    };
  }
  
  // If multiple leads, provide summary
  let response = `Found ${leads.length} leads:\n\n`;
  
  leads.slice(0, 5).forEach((lead, i) => {
    response += `${i + 1}. **${lead.company_name}** (Score: ${lead.score}, Status: ${lead.status})\n`;
  });
  
  if (leads.length > 5) {
    response += `\n... and ${leads.length - 5} more.`;
  }
  
  return { response };
}

/**
 * Handle update requests (simplified - full implementation in Day-02)
 */
async function handleUpdate(state: AgentState): Promise<Partial<AgentState>> {
  return {
    response: "Update functionality will be implemented in Day-02 with approval flows!",
  };
}

/**
 * Handle follow-up requests (simplified - full implementation in Day-02)
 */
async function handleFollowup(state: AgentState): Promise<Partial<AgentState>> {
  return {
    response: "Email sending will be implemented in Day-02 with approval and error handling!",
  };
}

// ============================================================================
// Routing Logic
// ============================================================================

function routeIntent(state: AgentState): string {
  if (state.error) {
    return "end";
  }
  
  const intentType = state.intent?.type;
  
  switch (intentType) {
    case "query":
      return "query_leads";
    case "update":
      return "handle_update";
    case "followup":
      return "handle_followup";
    default:
      return "end";
  }
}

function routeAfterQuery(state: AgentState): string {
  if (state.error) {
    return "end";
  }
  return "format_response";
}

// ============================================================================
// Build the Agent Graph
// ============================================================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a, b) => b ?? a },
    intent: { value: (a, b) => b ?? a },
    leads: { value: (a, b) => b ?? a },
    response: { value: (a, b) => b ?? a },
    error: { value: (a, b) => b ?? a },
  },
});

// Add nodes
workflow.addNode("classify_intent", classifyIntent);
workflow.addNode("query_leads", queryLeads);
workflow.addNode("format_response", formatResponse);
workflow.addNode("handle_update", handleUpdate);
workflow.addNode("handle_followup", handleFollowup);

// Set entry point
workflow.setEntryPoint("classify_intent");

// Add edges
workflow.addConditionalEdges(
  "classify_intent",
  routeIntent,
  {
    query_leads: "query_leads",
    handle_update: "handle_update",
    handle_followup: "handle_followup",
    end: END,
  }
);

workflow.addConditionalEdges(
  "query_leads",
  routeAfterQuery,
  {
    format_response: "format_response",
    end: END,
  }
);

workflow.addEdge("format_response", END);
workflow.addEdge("handle_update", END);
workflow.addEdge("handle_followup", END);

// Compile the agent
export const agent = workflow.compile();

// ============================================================================
// Helper Function to Run the Agent
// ============================================================================

export async function runAgent(userMessage: string) {
  const result = await agent.invoke({
    userMessage,
    intent: null,
    leads: [],
    response: null,
    error: null,
  });
  
  return result;
}

// ============================================================================
// Test Examples (Uncomment to run)
// ============================================================================

/*
// Test 1: Query hot leads
console.log("\n=== Test 1: Hot Leads ===");
const result1 = await runAgent("Show me hot leads");
console.log(result1.response);

// Test 2: Query specific company
console.log("\n=== Test 2: Specific Company ===");
const result2 = await runAgent("What's the status of TechCorp?");
console.log(result2.response);

// Test 3: Query by status
console.log("\n=== Test 3: Status Filter ===");
const result3 = await runAgent("Show me all qualified leads");
console.log(result3.response);
*/
