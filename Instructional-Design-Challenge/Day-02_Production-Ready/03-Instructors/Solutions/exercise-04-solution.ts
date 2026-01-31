/**
 * Exercise 4 Solution: Ship It - Complete Deployed Agent
 * 
 * This is the final, production-ready Edge Function that combines everything.
 * 
 * INSTRUCTOR NOTE: This file represents what students should have at the end
 * of the module. It's ready to deploy to Supabase Edge Functions.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StateGraph, END } from "https://esm.sh/@langchain/langgraph@0.0.20";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.17.0";

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
}

interface PendingAction {
  type: "update_lead" | "send_email";
  leadId: string;
  leadName: string;
  changes?: Partial<Lead>;
  emailContent?: { to: string; subject: string; body: string };
}

interface AgentState {
  userMessage: string;
  intent: { type: string; target?: string } | null;
  leads: Lead[];
  selectedLead: Lead | null;
  pendingAction: PendingAction | null;
  approvalStatus: "pending" | "approved" | "rejected" | null;
  response: string | null;
  error: string | null;
}

interface AgentResponse {
  success: boolean;
  message: string;
  data?: {
    leads?: Lead[];
    pendingApproval?: {
      actionId: string;
      type: string;
      description: string;
    };
  };
  error?: string;
}

// ============================================
// Clients
// ============================================

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const HIGH_VALUE_THRESHOLD = parseInt(Deno.env.get("HIGH_VALUE_THRESHOLD") || "80");

// ============================================
// Utilities
// ============================================

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!apiKey) {
    return { success: true, messageId: `mock-${Date.now()}` }; // Mock for testing
  }
  
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev",
        to,
        subject,
        text: body,
      }),
    });
    
    if (!response.ok) {
      return { success: false, error: await response.text() };
    }
    
    const result = await response.json();
    return { success: true, messageId: result.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function needsApproval(actionType: string, lead: Lead | null): boolean {
  if (actionType === "send_email") return true;
  if (actionType === "update_lead" && lead && lead.score > HIGH_VALUE_THRESHOLD) return true;
  return false;
}

// ============================================
// Agent Nodes
// ============================================

async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const response = await withRetry(() =>
      anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 256,
        messages: [{
          role: "user",
          content: `Classify this CRM request:
- "lookup": show/find leads
- "update": change lead status
- "followup": send email
- "unknown": anything else

Message: "${state.userMessage}"

JSON only: {"type":"...","target":"company or null"}`
        }],
      })
    );
    
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const intent = match ? JSON.parse(match[0]) : { type: "unknown" };
    
    return { intent };
  } catch (e) {
    return { error: e.message, response: "I had trouble understanding that. Please try again." };
  }
}

async function handleLookup(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const target = state.intent?.target?.toLowerCase() || "";
    let query = supabase.from("leads").select("*");
    
    if (target === "hot" || target === "high value") {
      query = query.gt("score", 80);
    } else if (target && target !== "all") {
      query = query.ilike("company_name", `%${target}%`);
    }
    
    const { data, error } = await query.order("score", { ascending: false });
    
    if (error) throw error;
    if (!data?.length) return { response: `No leads found${target ? ` matching "${target}"` : ""}.` };
    
    const lines = data.map((l, i) =>
      `${i + 1}. **${l.company_name}** (${l.contact_name})\n   Score: ${l.score} | Status: ${l.status}`
    );
    
    return {
      leads: data,
      response: `Found ${data.length} lead(s):\n\n${lines.join("\n\n")}`,
    };
  } catch (e) {
    return { error: e.message, response: "Failed to fetch leads. Please try again." };
  }
}

async function handleUpdate(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  if (!target) return { response: "Which lead would you like to update?" };
  
  try {
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .ilike("company_name", `%${target}%`);
    
    if (!leads?.length) return { response: `Couldn't find "${target}".` };
    
    const lead = leads[0];
    const msg = state.userMessage.toLowerCase();
    const changes: Partial<Lead> = {};
    
    if (msg.includes("won")) changes.status = "won";
    else if (msg.includes("lost")) changes.status = "lost";
    else if (msg.includes("qualified")) changes.status = "qualified";
    
    if (!Object.keys(changes).length) {
      return { response: `What would you like to change about ${lead.company_name}?`, selectedLead: lead };
    }
    
    if (needsApproval("update_lead", lead)) {
      return {
        selectedLead: lead,
        pendingAction: { type: "update_lead", leadId: lead.id, leadName: lead.company_name, changes },
        approvalStatus: "pending",
        response: `⚠️ **Approval Required**\n\nUpdate ${lead.company_name} (Score: ${lead.score}):\n- status: ${lead.status} → ${changes.status}\n\nThis is a high-value lead.`,
      };
    }
    
    // Execute directly
    await supabase.from("leads").update(changes).eq("id", lead.id);
    return { response: `✅ Updated ${lead.company_name}! New status: ${changes.status}` };
  } catch (e) {
    return { error: e.message, response: "Failed to update. Please try again." };
  }
}

async function handleFollowup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  if (!target) return { response: "Who would you like to follow up with?" };
  
  try {
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .ilike("company_name", `%${target}%`);
    
    if (!leads?.length) return { response: `Couldn't find "${target}".` };
    
    const lead = leads[0];
    const emailContent = {
      to: lead.contact_email,
      subject: `Following up - ${lead.company_name}`,
      body: `Hi ${lead.contact_name},\n\nI wanted to follow up on our conversation about ${lead.company_name}.\n\nBest regards`,
    };
    
    return {
      selectedLead: lead,
      pendingAction: { type: "send_email", leadId: lead.id, leadName: lead.company_name, emailContent },
      approvalStatus: "pending",
      response: `📧 Ready to send to ${lead.contact_name}:\n\n**Subject:** ${emailContent.subject}\n\n${emailContent.body}\n\n⏳ Awaiting approval...`,
    };
  } catch (e) {
    return { error: e.message, response: "Failed to prepare email. Please try again." };
  }
}

async function handleOther(state: AgentState): Promise<Partial<AgentState>> {
  return { response: `Try:\n• "Show me leads"\n• "Mark TechCorp as won"\n• "Send follow-up to Sophie"` };
}

async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
  // In production, this would wait for external approval
  // For demo, check AUTO_APPROVE env
  const auto = Deno.env.get("AUTO_APPROVE");
  if (auto === "true") return { approvalStatus: "approved" };
  if (auto === "false") return { approvalStatus: "rejected" };
  return {}; // Stays pending
}

async function executeApproved(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  if (!pending) return { error: "No pending action" };
  
  if (pending.type === "update_lead" && pending.changes) {
    await supabase.from("leads").update(pending.changes).eq("id", pending.leadId);
    await supabase.from("interactions").insert({
      lead_id: pending.leadId,
      interaction_type: "status_change",
      description: `Updated: ${JSON.stringify(pending.changes)}`,
      performed_by: "agent",
      required_approval: true,
      approved: true,
    });
    return { response: `✅ Updated ${pending.leadName}!`, pendingAction: null, approvalStatus: null };
  }
  
  if (pending.type === "send_email" && pending.emailContent) {
    const result = await sendEmail(
      pending.emailContent.to,
      pending.emailContent.subject,
      pending.emailContent.body
    );
    
    if (!result.success) return { error: result.error, response: `❌ Failed: ${result.error}` };
    
    await supabase.from("interactions").insert({
      lead_id: pending.leadId,
      interaction_type: "email_sent",
      description: `Sent: "${pending.emailContent.subject}"`,
      performed_by: "agent",
      required_approval: true,
      approved: true,
      metadata: { message_id: result.messageId },
    });
    
    await supabase.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", pending.leadId);
    return { response: `✅ Email sent!`, pendingAction: null, approvalStatus: null };
  }
  
  return { error: "Unknown action type" };
}

async function handleRejection(state: AgentState): Promise<Partial<AgentState>> {
  return { response: `❌ Action rejected.`, pendingAction: null, approvalStatus: null };
}

// ============================================
// Routing
// ============================================

function routeByIntent(state: AgentState): string {
  if (state.error) return "end";
  switch (state.intent?.type) {
    case "lookup": return "handle_lookup";
    case "update": return "handle_update";
    case "followup": return "handle_followup";
    default: return "handle_other";
  }
}

function routeAfterAction(state: AgentState): string {
  if (state.approvalStatus === "pending") return "human_review";
  return "end";
}

function routeAfterReview(state: AgentState): string {
  if (state.approvalStatus === "approved") return "execute_approved";
  if (state.approvalStatus === "rejected") return "handle_rejection";
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
    response: { value: (a, b) => b ?? a },
    error: { value: (a, b) => b ?? a },
  },
});

workflow.addNode("understand_request", understandRequest);
workflow.addNode("handle_lookup", handleLookup);
workflow.addNode("handle_update", handleUpdate);
workflow.addNode("handle_followup", handleFollowup);
workflow.addNode("handle_other", handleOther);
workflow.addNode("human_review", humanReview);
workflow.addNode("execute_approved", executeApproved);
workflow.addNode("handle_rejection", handleRejection);

workflow.setEntryPoint("understand_request");

workflow.addConditionalEdges("understand_request", routeByIntent, {
  handle_lookup: "handle_lookup",
  handle_update: "handle_update",
  handle_followup: "handle_followup",
  handle_other: "handle_other",
  end: END,
});

workflow.addConditionalEdges("handle_update", routeAfterAction, { human_review: "human_review", end: END });
workflow.addConditionalEdges("handle_followup", routeAfterAction, { human_review: "human_review", end: END });
workflow.addConditionalEdges("human_review", routeAfterReview, {
  execute_approved: "execute_approved",
  handle_rejection: "handle_rejection",
  end: END,
});

workflow.addEdge("handle_lookup", END);
workflow.addEdge("handle_other", END);
workflow.addEdge("execute_approved", END);
workflow.addEdge("handle_rejection", END);

const app = workflow.compile();

// ============================================
// Agent Runner
// ============================================

async function runAgent(message: string): Promise<AgentResponse> {
  try {
    const result = await app.invoke({
      userMessage: message,
      intent: null,
      leads: [],
      selectedLead: null,
      pendingAction: null,
      approvalStatus: null,
      response: null,
      error: null,
    });
    
    return {
      success: !result.error,
      message: result.response || "No response",
      data: {
        leads: result.leads?.length ? result.leads : undefined,
        pendingApproval: result.pendingAction ? {
          actionId: result.pendingAction.leadId,
          type: result.pendingAction.type,
          description: `${result.pendingAction.type} for ${result.pendingAction.leadName}`,
        } : undefined,
      },
      error: result.error || undefined,
    };
  } catch (e) {
    return { success: false, message: "Agent failed", error: e.message };
  }
}

// ============================================
// Edge Function Handler
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { message, action, actionId } = await req.json();
    
    // Handle approval actions (simplified for exercise)
    if (action === "approve" || action === "reject") {
      return new Response(
        JSON.stringify({ success: true, message: `Action ${actionId} ${action}ed.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Missing 'message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const result = await runAgent(message);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Handler error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
