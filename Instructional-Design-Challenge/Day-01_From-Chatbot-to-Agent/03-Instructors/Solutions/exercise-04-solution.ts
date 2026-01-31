/**
 * Exercise 4 Solution: Query Your Leads
 * 
 * This is the complete Day 1 agent with real Supabase integration.
 * The agent can understand requests, route them, and query the database.
 * 
 * INSTRUCTOR NOTE: This is the "payoff" moment for Day 1. Students see
 * their agent actually talking to a real database and returning real data.
 * Contrast this with Exercise 1's chatbot that could only hallucinate.
 */

import { StateGraph, END } from "@langchain/langgraph";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "@anthropic-ai/sdk";

// ============================================
// Type Definitions
// ============================================

interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
  score: number;
  source: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
}

interface AgentIntent {
  type: "lookup" | "qualify" | "followup" | "update" | "unknown";
  target?: string;
  details?: string;
}

interface AgentState {
  userMessage: string;
  intent: AgentIntent | null;
  leads: Lead[];
  response: string | null;
  error: string | null;
}

// ============================================
// Client Setup
// ============================================

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// Nodes
// ============================================

/**
 * Node 1: Classify user intent
 */
async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  const userMessage = state.userMessage;
  
  const prompt = `You are a CRM assistant that classifies user requests.

Classify into ONE category:
- "lookup": User wants to SEE/FIND lead information
- "qualify": User wants to ANALYZE/SCORE a lead  
- "followup": User wants to SEND COMMUNICATION
- "update": User wants to CHANGE lead data
- "unknown": Can't determine or unrelated to CRM

Also extract the target (company name) if mentioned.

User message: "${userMessage}"

Respond with ONLY JSON:
{"type": "lookup|qualify|followup|update|unknown", "target": "company name or null"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const intent = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: "unknown" };
    
    return { intent };
  } catch (error) {
    return {
      intent: { type: "unknown" },
      error: `Classification failed: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

/**
 * Node 2: Query leads from Supabase
 * 
 * This is the main new functionality for Exercise 4.
 * We build different queries based on what the user asked for.
 */
async function handleLookup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target?.toLowerCase().trim() || "";
  
  try {
    // Build query based on what user asked for
    let query = supabase.from("leads").select("*");
    let queryDescription = "";
    
    if (target === "" || target === "all" || target === "my leads") {
      // "Show me all leads" - no filter
      queryDescription = "all leads";
      
    } else if (target === "hot" || target === "hot leads" || target === "high value") {
      // "Show me hot leads" - filter by high score
      query = query.gt("score", 80);
      queryDescription = "hot leads (score > 80)";
      
    } else if (target === "new" || target === "new leads") {
      // "Show me new leads" - filter by status
      query = query.eq("status", "new");
      queryDescription = "new leads";
      
    } else if (target === "qualified") {
      query = query.eq("status", "qualified");
      queryDescription = "qualified leads";
      
    } else if (target === "proposal" || target === "in proposal") {
      query = query.eq("status", "proposal");
      queryDescription = "leads in proposal stage";
      
    } else {
      // Assume it's a company name search
      query = query.ilike("company_name", `%${target}%`);
      queryDescription = `leads matching "${target}"`;
    }
    
    // Always sort by score (highest first)
    query = query.order("score", { ascending: false });
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error("Supabase error:", error);
      return {
        leads: [],
        error: `Database error: ${error.message}`,
        response: "Sorry, I couldn't fetch the leads. Please try again.",
      };
    }
    
    // Handle empty results
    if (!data || data.length === 0) {
      return {
        leads: [],
        response: `No ${queryDescription} found.${
          target && target !== "all" 
            ? `\n\nTry a different search term, or "show me all leads" to see everything.`
            : ""
        }`,
      };
    }
    
    // Format and return results
    return {
      leads: data,
      response: formatLeadsResponse(data, queryDescription),
    };
    
  } catch (e) {
    console.error("Unexpected error in handleLookup:", e);
    return {
      leads: [],
      error: `Unexpected error: ${e instanceof Error ? e.message : "unknown"}`,
      response: "Something went wrong while fetching leads. Please try again.",
    };
  }
}

/**
 * Format leads into a human-readable response.
 * 
 * INSTRUCTOR NOTE: Formatting matters! A wall of JSON is not helpful.
 * Teach students to think about how users will actually read the output.
 */
function formatLeadsResponse(leads: Lead[], queryDescription: string): string {
  const count = leads.length;
  const header = `Found ${count} ${queryDescription}:`;
  
  const leadLines = leads.map((lead, index) => {
    const value = lead.estimated_value 
      ? `$${lead.estimated_value.toLocaleString()}`
      : "Not set";
    
    const status = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
    
    return `${index + 1}. **${lead.company_name}** (${lead.contact_name})
   📊 Score: ${lead.score} | Status: ${status} | Value: ${value}
   📧 ${lead.contact_email}${lead.notes ? `\n   💬 ${lead.notes.slice(0, 100)}${lead.notes.length > 100 ? "..." : ""}` : ""}`;
  });
  
  return `${header}\n\n${leadLines.join("\n\n")}`;
}

/**
 * Node 3: Handle qualify requests (placeholder for Day 2)
 */
async function handleQualify(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  
  if (!target) {
    return {
      response: "Which lead would you like me to qualify? Please specify a company name.",
    };
  }
  
  return {
    response: `📊 To qualify ${target}, I'll need to analyze their data.

This feature will be fully implemented tomorrow when we add:
- Database writes (updating lead scores)
- Human approval (for high-value qualification changes)

For now, you can ask "What's the status of ${target}?" to see their current info.`,
  };
}

/**
 * Node 4: Handle other requests (placeholder)
 */
async function handleOther(state: AgentState): Promise<Partial<AgentState>> {
  const intentType = state.intent?.type;
  const target = state.intent?.target;
  
  switch (intentType) {
    case "followup":
      return {
        response: `📧 You want to follow up with ${target || "someone"}.

This feature will be implemented tomorrow when we add:
- Email integration (via Resend)
- Human approval before sending

For now, you can look up their contact info with "Show me ${target || "leads"}".`,
      };
      
    case "update":
      return {
        response: `✏️ You want to update ${target || "a lead"}.

This feature will be implemented tomorrow when we add:
- Database write operations
- Human approval for sensitive changes

For now, you can view current data with "What's the status of ${target || "the lead"}?"`,
      };
      
    default:
      return {
        response: `🤔 I'm not sure what you're asking for.

Try something like:
• "Show me all leads" - See your full pipeline
• "Show me hot leads" - Filter by score > 80
• "What's the status of TechCorp?" - Look up a specific company
• "Find new leads" - Filter by status

What would you like to know?`,
      };
  }
}

// ============================================
// Router
// ============================================

function routeByIntent(state: AgentState): string {
  const intentType = state.intent?.type;
  
  switch (intentType) {
    case "lookup":
      return "handle_lookup";
    case "qualify":
      return "handle_qualify";
    default:
      return "handle_other";
  }
}

// ============================================
// Graph
// ============================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a: string, b: string) => b ?? a },
    intent: { value: (a: AgentIntent | null, b: AgentIntent | null) => b ?? a },
    leads: { value: (a: Lead[], b: Lead[]) => b ?? a },
    response: { value: (a: string | null, b: string | null) => b ?? a },
    error: { value: (a: string | null, b: string | null) => b ?? a },
  },
});

workflow.addNode("understand_request", understandRequest);
workflow.addNode("handle_lookup", handleLookup);
workflow.addNode("handle_qualify", handleQualify);
workflow.addNode("handle_other", handleOther);

workflow.setEntryPoint("understand_request");

workflow.addConditionalEdges(
  "understand_request",
  routeByIntent,
  {
    handle_lookup: "handle_lookup",
    handle_qualify: "handle_qualify",
    handle_other: "handle_other",
  }
);

workflow.addEdge("handle_lookup", END);
workflow.addEdge("handle_qualify", END);
workflow.addEdge("handle_other", END);

const app = workflow.compile();

// ============================================
// Testing
// ============================================

async function runTests() {
  const testCases = [
    "Show me all my leads",
    "Show me hot leads",
    "What's the status of TechCorp?",
    "Find GlobalRetail",
    "Show me new leads",
    "Find FakeCompanyThatDoesntExist",
    "Qualify TechCorp",
    "Send email to Sophie",
    "Hello!",
  ];
  
  console.log("=".repeat(70));
  console.log("FULL AGENT TEST WITH REAL DATABASE");
  console.log("=".repeat(70));
  
  for (const message of testCases) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`USER: ${message}`);
    console.log("─".repeat(70));
    
    const result = await app.invoke({
      userMessage: message,
      intent: null,
      leads: [],
      response: null,
      error: null,
    });
    
    console.log(`INTENT: ${result.intent?.type}${result.intent?.target ? ` (target: ${result.intent.target})` : ""}`);
    console.log(`LEADS RETURNED: ${result.leads?.length || 0}`);
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    }
    console.log(`\nRESPONSE:\n${result.response}`);
  }
}

async function main() {
  if (process.argv[2]) {
    const result = await app.invoke({
      userMessage: process.argv[2],
      intent: null,
      leads: [],
      response: null,
      error: null,
    });
    console.log(result.response);
    if (result.error) {
      console.error("\nError:", result.error);
    }
  } else {
    await runTests();
  }
}

main().catch(console.error);
