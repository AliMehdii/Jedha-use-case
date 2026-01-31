/**
 * Exercise 2 Solution: Add Approval Gate
 * 
 * Complete implementation of human-in-the-loop approval for high-value leads.
 * 
 * INSTRUCTOR NOTE: The key concepts here are:
 * 1. Checking if approval is needed BEFORE taking action
 * 2. Storing the pending action in state
 * 3. Routing based on approval status
 * 4. Handling both approval and rejection gracefully
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
  estimated_value: number | null;
  notes: string | null;
}

interface PendingAction {
  type: "update_lead" | "send_email";
  leadId: string;
  leadName: string;
  changes?: Partial<Lead>;
  emailContent?: { to: string; subject: string; body: string };
  reason: string;  // Why this action was proposed
}

interface AgentState {
  userMessage: string;
  intent: { type: string; target?: string } | null;
  leads: Lead[];
  selectedLead: Lead | null;
  pendingAction: PendingAction | null;
  approvalStatus: "pending" | "approved" | "rejected" | null;
  approvalReason: string | null;
  response: string | null;
  error: string | null;
}

// ============================================
// Clients
// ============================================

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

// ============================================
// Approval Logic
// ============================================

const HIGH_VALUE_THRESHOLD = parseInt(Deno.env.get("HIGH_VALUE_THRESHOLD") || "80");

/**
 * Determines if an action requires human approval.
 * 
 * Rules:
 * - All email sending requires approval
 * - Updates to leads with score > threshold require approval
 */
function needsApproval(actionType: string, lead: Lead | null): boolean {
  // Email always needs approval - external communication
  if (actionType === "send_email") {
    return true;
  }
  
  // Updates to high-value leads need approval
  if (actionType === "update_lead" && lead && lead.score > HIGH_VALUE_THRESHOLD) {
    return true;
  }
  
  // Everything else is auto-approved
  return false;
}

// ============================================
// Nodes
// ============================================

/**
 * Classify user intent
 */
async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: `Classify this CRM request into: lookup, update, followup, or unknown.
Extract the target company name if mentioned.

Message: "${state.userMessage}"

JSON only: {"type": "...", "target": "company name or null"}`
    }],
  });
  
  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const intent = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: "unknown" };
  
  return { intent };
}

/**
 * Handle update requests - may require approval
 */
async function handleUpdate(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  
  if (!target) {
    return {
      response: "Which lead would you like to update? Please specify the company name.",
    };
  }
  
  // Find the lead
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .ilike("company_name", `%${target}%`);
  
  if (error || !leads?.length) {
    return {
      error: error?.message || "Lead not found",
      response: `I couldn't find a lead matching "${target}".`,
    };
  }
  
  const lead = leads[0];
  
  // Parse changes from the message
  const changes = parseChanges(state.userMessage);
  
  if (Object.keys(changes).length === 0) {
    return {
      response: `What would you like to change about ${lead.company_name}? (e.g., "mark as won", "update status to qualified")`,
      selectedLead: lead,
    };
  }
  
  // Check if approval is needed
  if (needsApproval("update_lead", lead)) {
    return {
      selectedLead: lead,
      pendingAction: {
        type: "update_lead",
        leadId: lead.id,
        leadName: lead.company_name,
        changes,
        reason: `High-value lead (score: ${lead.score}) requires approval before modification`,
      },
      approvalStatus: "pending",
      response: formatApprovalRequest(lead, changes),
    };
  }
  
  // No approval needed - execute directly
  return await executeUpdate(lead, changes, state);
}

/**
 * Parse status changes from natural language
 */
function parseChanges(message: string): Partial<Lead> {
  const lower = message.toLowerCase();
  
  if (lower.includes("won") || lower.includes("close") && lower.includes("deal")) {
    return { status: "won" };
  }
  if (lower.includes("lost") || lower.includes("competitor")) {
    return { status: "lost" };
  }
  if (lower.includes("qualified")) {
    return { status: "qualified" };
  }
  if (lower.includes("proposal")) {
    return { status: "proposal" };
  }
  if (lower.includes("contact")) {
    return { status: "contacted" };
  }
  
  return {};
}

/**
 * Format an approval request message
 */
function formatApprovalRequest(lead: Lead, changes: Partial<Lead>): string {
  const changesList = Object.entries(changes)
    .map(([key, value]) => `  - ${key}: ${lead[key as keyof Lead]} → ${value}`)
    .join("\n");
  
  return `⚠️ **Approval Required**

I'd like to update **${lead.company_name}** (Score: ${lead.score}):

${changesList}

This is a high-value lead, so I need your approval before making changes.

**To approve:** Click Approve or call POST /api/approve/${lead.id}
**To reject:** Click Reject or call POST /api/reject/${lead.id}`;
}

/**
 * Execute an update (called directly or after approval)
 */
async function executeUpdate(
  lead: Lead,
  changes: Partial<Lead>,
  state: AgentState
): Promise<Partial<AgentState>> {
  const { data, error } = await supabase
    .from("leads")
    .update(changes)
    .eq("id", lead.id)
    .select()
    .single();
  
  if (error) {
    return {
      error: error.message,
      response: `Failed to update ${lead.company_name}: ${error.message}`,
    };
  }
  
  // Log the interaction
  await supabase.from("interactions").insert({
    lead_id: lead.id,
    interaction_type: "status_change",
    description: `Updated: ${JSON.stringify(changes)}`,
    performed_by: "agent",
    required_approval: state.approvalStatus === "approved",
    approved: state.approvalStatus === "approved" || null,
    approved_by: state.approvalStatus === "approved" ? "human" : null,
    metadata: { changes, previous_status: lead.status },
  });
  
  return {
    response: `✅ Updated **${lead.company_name}**!\n\nNew status: ${data.status}`,
    pendingAction: null,
    approvalStatus: null,
  };
}

/**
 * Human review node - waits for approval
 */
async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
  // In production, this would:
  // 1. Store pending action to database
  // 2. Send notification
  // 3. Return and wait for webhook
  
  // For testing, check environment variable
  const autoApprove = Deno.env.get("AUTO_APPROVE");
  
  if (autoApprove === "true") {
    console.log("[humanReview] Auto-approving for testing");
    return {
      approvalStatus: "approved",
      approvalReason: "Auto-approved for testing",
    };
  }
  
  if (autoApprove === "false") {
    console.log("[humanReview] Auto-rejecting for testing");
    return {
      approvalStatus: "rejected",
      approvalReason: "Auto-rejected for testing",
    };
  }
  
  // In real implementation, return with pending status
  // The workflow would be resumed when approval comes in
  return {
    response: state.response + "\n\n⏳ Waiting for approval...",
  };
}

/**
 * Execute approved update
 */
async function executeApprovedUpdate(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  
  if (!pending || pending.type !== "update_lead" || !pending.changes) {
    return { error: "No valid pending update" };
  }
  
  const lead = state.selectedLead || { id: pending.leadId } as Lead;
  
  return await executeUpdate(
    { ...lead, id: pending.leadId, company_name: pending.leadName } as Lead,
    pending.changes,
    state
  );
}

/**
 * Handle rejection
 */
async function handleRejection(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  const reason = state.approvalReason;
  
  // Log the rejection
  if (pending) {
    await supabase.from("interactions").insert({
      lead_id: pending.leadId,
      interaction_type: "agent_action",
      description: `Update rejected: ${JSON.stringify(pending.changes)}`,
      performed_by: "agent",
      required_approval: true,
      approved: false,
      metadata: { rejection_reason: reason },
    });
  }
  
  return {
    response: `❌ Update rejected${reason ? `: ${reason}` : ""}.\n\nI won't modify ${pending?.leadName || "the lead"}. Let me know if you'd like to do something else.`,
    pendingAction: null,
    approvalStatus: null,
    approvalReason: null,
  };
}

/**
 * Handle lookup (from Day 1)
 */
async function handleLookup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target?.toLowerCase() || "all";
  
  let query = supabase.from("leads").select("*");
  
  if (target === "hot" || target === "high value") {
    query = query.gt("score", 80);
  } else if (target !== "all" && target !== "") {
    query = query.ilike("company_name", `%${target}%`);
  }
  
  const { data, error } = await query.order("score", { ascending: false });
  
  if (error) {
    return { error: error.message, response: "Failed to query leads." };
  }
  
  if (!data?.length) {
    return { response: `No leads found matching "${target}".` };
  }
  
  const formatted = data.map((l, i) => 
    `${i + 1}. **${l.company_name}** (${l.contact_name}) - Score: ${l.score}`
  ).join("\n");
  
  return {
    leads: data,
    response: `Found ${data.length} lead(s):\n\n${formatted}`,
  };
}

/**
 * Handle other intents
 */
async function handleOther(state: AgentState): Promise<Partial<AgentState>> {
  return {
    response: `I understood "${state.intent?.type}" but that feature is coming soon!\n\nTry: "Show me leads" or "Mark TechCorp as won"`,
  };
}

// ============================================
// Routing
// ============================================

function routeByIntent(state: AgentState): string {
  switch (state.intent?.type) {
    case "lookup": return "handle_lookup";
    case "update": return "handle_update";
    default: return "handle_other";
  }
}

function routeAfterUpdate(state: AgentState): string {
  if (state.approvalStatus === "pending") {
    return "human_review";
  }
  return "end";
}

function routeAfterReview(state: AgentState): string {
  if (state.approvalStatus === "approved") {
    return "execute_approved_update";
  }
  if (state.approvalStatus === "rejected") {
    return "handle_rejection";
  }
  return "end";
}

// ============================================
// Graph
// ============================================

const workflow = new StateGraph<AgentState>({
  channels: {
    userMessage: { value: (a, b) => b ?? a },
    intent: { value: (a, b) => b ?? a },
    leads: { value: (a, b) => b ?? a },
    selectedLead: { value: (a, b) => b ?? a },
    pendingAction: { value: (a, b) => b ?? a },
    approvalStatus: { value: (a, b) => b ?? a },
    approvalReason: { value: (a, b) => b ?? a },
    response: { value: (a, b) => b ?? a },
    error: { value: (a, b) => b ?? a },
  },
});

// Add nodes
workflow.addNode("understand_request", understandRequest);
workflow.addNode("handle_lookup", handleLookup);
workflow.addNode("handle_update", handleUpdate);
workflow.addNode("handle_other", handleOther);
workflow.addNode("human_review", humanReview);
workflow.addNode("execute_approved_update", executeApprovedUpdate);
workflow.addNode("handle_rejection", handleRejection);

// Set entry and routing
workflow.setEntryPoint("understand_request");

workflow.addConditionalEdges("understand_request", routeByIntent, {
  handle_lookup: "handle_lookup",
  handle_update: "handle_update",
  handle_other: "handle_other",
});

workflow.addConditionalEdges("handle_update", routeAfterUpdate, {
  human_review: "human_review",
  end: END,
});

workflow.addConditionalEdges("human_review", routeAfterReview, {
  execute_approved_update: "execute_approved_update",
  handle_rejection: "handle_rejection",
  end: END,
});

// Terminal edges
workflow.addEdge("handle_lookup", END);
workflow.addEdge("handle_other", END);
workflow.addEdge("execute_approved_update", END);
workflow.addEdge("handle_rejection", END);

const app = workflow.compile();

// ============================================
// Testing
// ============================================

async function runTests() {
  const initialState = {
    userMessage: "",
    intent: null,
    leads: [],
    selectedLead: null,
    pendingAction: null,
    approvalStatus: null,
    approvalReason: null,
    response: null,
    error: null,
  };
  
  console.log("=".repeat(60));
  console.log("APPROVAL GATE TESTS");
  console.log("=".repeat(60));
  
  // Test 1: Low-value lead (no approval)
  console.log("\n--- Test 1: Low-value lead (auto-approved) ---");
  Deno.env.set("AUTO_APPROVE", "");
  const result1 = await app.invoke({
    ...initialState,
    userMessage: "Mark LocalCafe as lost",
  });
  console.log("Response:", result1.response);
  console.log("Approval status:", result1.approvalStatus);
  
  // Test 2: High-value lead (needs approval, approved)
  console.log("\n--- Test 2: High-value lead (approved) ---");
  Deno.env.set("AUTO_APPROVE", "true");
  const result2 = await app.invoke({
    ...initialState,
    userMessage: "Mark TechCorp as won",
  });
  console.log("Response:", result2.response);
  
  // Test 3: High-value lead (needs approval, rejected)
  console.log("\n--- Test 3: High-value lead (rejected) ---");
  Deno.env.set("AUTO_APPROVE", "false");
  const result3 = await app.invoke({
    ...initialState,
    userMessage: "Mark GlobalRetail as lost",
  });
  console.log("Response:", result3.response);
}

runTests().catch(console.error);
