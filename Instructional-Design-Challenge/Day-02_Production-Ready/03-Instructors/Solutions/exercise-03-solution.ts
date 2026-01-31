/**
 * Exercise 3 Solution: Make It Resilient
 * 
 * Complete implementation with retry logic, error handling, and email integration.
 * 
 * INSTRUCTOR NOTE: Key patterns demonstrated:
 * 1. Retry with exponential backoff
 * 2. Proper error classification
 * 3. External API integration (Resend)
 * 4. Error recovery node
 */

import { StateGraph, END } from "@langchain/langgraph";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// Retry Utilities
// ============================================

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: any) => boolean;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  shouldRetry: (error) => {
    const status = error?.status || error?.response?.status;
    // Don't retry client errors (except rate limits)
    if (status >= 400 && status < 500 && status !== 429) return false;
    return true;
  },
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const isLastAttempt = attempt === opts.maxRetries;
      const shouldRetry = opts.shouldRetry?.(error) ?? true;
      
      console.log(`[Retry] Attempt ${attempt}/${opts.maxRetries} failed: ${error.message}`);
      
      if (isLastAttempt || !shouldRetry) {
        console.log(`[Retry] ${isLastAttempt ? "Max retries reached" : "Error not retryable"}`);
        throw error;
      }
      
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1),
        opts.maxDelayMs
      );
      
      console.log(`[Retry] Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ============================================
// Email Utilities
// ============================================

interface EmailParams {
  to: string;
  subject: string;
  body: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";
  
  if (!apiKey) {
    console.log("[Email] RESEND_API_KEY not configured, using mock");
    // Mock for testing without API key
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }
  
  return withRetry(async () => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.body,
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Resend error: ${errorBody}`);
      (error as any).status = response.status;
      throw error;
    }
    
    const result = await response.json();
    return { success: true, messageId: result.id };
  }, {
    maxRetries: 2,
    baseDelayMs: 2000,
  });
}

// ============================================
// Error Handling Utilities
// ============================================

function formatUserError(error: any): string {
  const message = error?.message || String(error);
  
  if (message.includes("timeout") || message.includes("network") || message.includes("ETIMEDOUT")) {
    return "I'm having trouble connecting. Please try again in a moment.";
  }
  if (message.includes("not found") || message.includes("404") || message.includes("PGRST116")) {
    return "I couldn't find what you're looking for.";
  }
  if (message.includes("permission") || message.includes("401") || message.includes("403")) {
    return "I don't have permission to do that.";
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return "I'm being rate limited. Please wait a moment and try again.";
  }
  
  return "Something went wrong. Please try rephrasing your request.";
}

// ============================================
// State Definition
// ============================================

interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
  score: number;
  estimated_value: number | null;
}

interface AgentState {
  userMessage: string;
  intent: { type: string; target?: string } | null;
  leads: Lead[];
  pendingAction: {
    type: "update_lead" | "send_email";
    leadId: string;
    leadName: string;
    changes?: Partial<Lead>;
    emailContent?: EmailParams;
  } | null;
  approvalStatus: "pending" | "approved" | "rejected" | null;
  response: string | null;
  error: string | null;
  errorDetails: object | null;
}

// ============================================
// Supabase Client with Retry
// ============================================

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function queryLeadsWithRetry(filter?: { column: string; value: any; operator?: string }): Promise<Lead[]> {
  return withRetry(async () => {
    let query = supabase.from("leads").select("*");
    
    if (filter) {
      if (filter.operator === "gt") {
        query = query.gt(filter.column, filter.value);
      } else if (filter.operator === "ilike") {
        query = query.ilike(filter.column, filter.value);
      } else {
        query = query.eq(filter.column, filter.value);
      }
    }
    
    const { data, error } = await query.order("score", { ascending: false });
    
    if (error) {
      const e = new Error(error.message);
      (e as any).status = error.code === "PGRST116" ? 404 : 500;
      throw e;
    }
    
    return data || [];
  });
}

// ============================================
// Nodes
// ============================================

async function handleFollowup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  
  if (!target) {
    return {
      response: "Who would you like me to follow up with?",
    };
  }
  
  try {
    const leads = await queryLeadsWithRetry({
      column: "company_name",
      value: `%${target}%`,
      operator: "ilike",
    });
    
    if (leads.length === 0) {
      return {
        response: `I couldn't find anyone matching "${target}".`,
      };
    }
    
    const lead = leads[0];
    
    const emailContent: EmailParams = {
      to: lead.contact_email,
      subject: `Following up - ${lead.company_name}`,
      body: `Hi ${lead.contact_name},

I wanted to follow up on our recent conversation about ${lead.company_name}.

Is there anything else I can help clarify or any questions you have?

Best regards`,
    };
    
    return {
      pendingAction: {
        type: "send_email",
        leadId: lead.id,
        leadName: lead.company_name,
        emailContent,
      },
      approvalStatus: "pending",
      response: `📧 Ready to send to ${lead.contact_name} (${lead.contact_email}):\n\n**Subject:** ${emailContent.subject}\n\n${emailContent.body}\n\n⏳ Awaiting approval...`,
    };
    
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      errorDetails: { node: "handleFollowup", error },
      response: formatUserError(error),
    };
  }
}

async function executeApprovedEmail(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  
  if (!pending || pending.type !== "send_email" || !pending.emailContent) {
    return { error: "No valid pending email" };
  }
  
  try {
    const result = await sendEmail(pending.emailContent);
    
    if (!result.success) {
      return {
        error: result.error,
        response: `❌ Failed to send email: ${result.error}`,
      };
    }
    
    // Log the interaction
    await supabase.from("interactions").insert({
      lead_id: pending.leadId,
      interaction_type: "email_sent",
      description: `Sent: "${pending.emailContent.subject}"`,
      performed_by: "agent",
      required_approval: true,
      approved: true,
      metadata: { message_id: result.messageId },
    });
    
    // Update last contacted
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", pending.leadId);
    
    return {
      response: `✅ Email sent to ${pending.emailContent.to}!\n\nMessage ID: ${result.messageId}`,
      pendingAction: null,
      approvalStatus: null,
    };
    
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      response: `❌ Failed to send email. ${formatUserError(error)}`,
    };
  }
}

async function errorRecovery(state: AgentState): Promise<Partial<AgentState>> {
  console.error("[ErrorRecovery]", {
    error: state.error,
    details: state.errorDetails,
  });
  
  // Already have a user-friendly response if error was caught in a node
  if (state.response?.includes("❌") || state.response?.includes("trouble")) {
    return {
      error: null,
      errorDetails: null,
    };
  }
  
  // Generate user-friendly response for uncaught errors
  return {
    response: `⚠️ ${formatUserError(state.error)}\n\nTry:\n- Rephrasing your request\n- Asking about something else\n- Waiting a moment and trying again`,
    error: null,
    errorDetails: null,
    pendingAction: null,
    approvalStatus: null,
  };
}

// Simplified versions of other nodes
async function understandRequest(state: AgentState): Promise<Partial<AgentState>> {
  // Simplified intent detection for this exercise
  const lower = state.userMessage.toLowerCase();
  
  if (lower.includes("follow") || lower.includes("email") || lower.includes("send")) {
    const target = extractCompanyName(state.userMessage);
    return { intent: { type: "followup", target } };
  }
  if (lower.includes("show") || lower.includes("list") || lower.includes("find")) {
    const target = extractCompanyName(state.userMessage);
    return { intent: { type: "lookup", target } };
  }
  
  return { intent: { type: "unknown" } };
}

function extractCompanyName(message: string): string | undefined {
  // Simple extraction - in production, use LLM
  const companies = ["techcorp", "globalretail", "megabank", "startupxyz", "localcafe"];
  const lower = message.toLowerCase();
  
  for (const company of companies) {
    if (lower.includes(company)) {
      return company;
    }
  }
  
  return undefined;
}

async function handleLookup(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const target = state.intent?.target;
    let leads: Lead[];
    
    if (target) {
      leads = await queryLeadsWithRetry({
        column: "company_name",
        value: `%${target}%`,
        operator: "ilike",
      });
    } else {
      leads = await queryLeadsWithRetry();
    }
    
    if (leads.length === 0) {
      return { response: "No leads found." };
    }
    
    const formatted = leads.map((l, i) =>
      `${i + 1}. **${l.company_name}** - ${l.contact_name} (Score: ${l.score})`
    ).join("\n");
    
    return {
      leads,
      response: `Found ${leads.length} lead(s):\n\n${formatted}`,
    };
    
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      response: formatUserError(error),
    };
  }
}

async function handleOther(state: AgentState): Promise<Partial<AgentState>> {
  return {
    response: `Try: "Show me leads" or "Send follow-up to TechCorp"`,
  };
}

async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
  const autoApprove = Deno.env.get("AUTO_APPROVE");
  
  if (autoApprove === "true") {
    return { approvalStatus: "approved" };
  }
  if (autoApprove === "false") {
    return { approvalStatus: "rejected" };
  }
  
  return {};
}

async function handleRejection(state: AgentState): Promise<Partial<AgentState>> {
  return {
    response: `❌ Email not sent. Let me know if you'd like to do something else.`,
    pendingAction: null,
    approvalStatus: null,
  };
}

// ============================================
// Routing
// ============================================

function routeByIntent(state: AgentState): string {
  if (state.error) return "error_recovery";
  
  switch (state.intent?.type) {
    case "lookup": return "handle_lookup";
    case "followup": return "handle_followup";
    default: return "handle_other";
  }
}

function routeAfterFollowup(state: AgentState): string {
  if (state.error) return "error_recovery";
  if (state.approvalStatus === "pending") return "human_review";
  return "end";
}

function routeAfterReview(state: AgentState): string {
  if (state.approvalStatus === "approved") return "execute_email";
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
    pendingAction: { value: (a, b) => b ?? a },
    approvalStatus: { value: (a, b) => b ?? a },
    response: { value: (a, b) => b ?? a },
    error: { value: (a, b) => b ?? a },
    errorDetails: { value: (a, b) => b ?? a },
  },
});

workflow.addNode("understand_request", understandRequest);
workflow.addNode("handle_lookup", handleLookup);
workflow.addNode("handle_followup", handleFollowup);
workflow.addNode("handle_other", handleOther);
workflow.addNode("human_review", humanReview);
workflow.addNode("execute_email", executeApprovedEmail);
workflow.addNode("handle_rejection", handleRejection);
workflow.addNode("error_recovery", errorRecovery);

workflow.setEntryPoint("understand_request");

workflow.addConditionalEdges("understand_request", routeByIntent, {
  handle_lookup: "handle_lookup",
  handle_followup: "handle_followup",
  handle_other: "handle_other",
  error_recovery: "error_recovery",
});

workflow.addConditionalEdges("handle_followup", routeAfterFollowup, {
  human_review: "human_review",
  error_recovery: "error_recovery",
  end: END,
});

workflow.addConditionalEdges("human_review", routeAfterReview, {
  execute_email: "execute_email",
  handle_rejection: "handle_rejection",
  end: END,
});

workflow.addEdge("handle_lookup", END);
workflow.addEdge("handle_other", END);
workflow.addEdge("execute_email", END);
workflow.addEdge("handle_rejection", END);
workflow.addEdge("error_recovery", END);

const app = workflow.compile();

// ============================================
// Export for Edge Function
// ============================================

export async function runAgent(message: string): Promise<{ success: boolean; message: string }> {
  const result = await app.invoke({
    userMessage: message,
    intent: null,
    leads: [],
    pendingAction: null,
    approvalStatus: null,
    response: null,
    error: null,
    errorDetails: null,
  });
  
  return {
    success: !result.error,
    message: result.response || "No response",
  };
}

// Test
async function test() {
  console.log("Testing resilient agent...\n");
  
  Deno.env.set("AUTO_APPROVE", "true");
  
  const tests = [
    "Show me all leads",
    "Send follow-up to TechCorp",
    "Hello",
  ];
  
  for (const msg of tests) {
    console.log(`\n> ${msg}`);
    const result = await runAgent(msg);
    console.log(result.message);
  }
}

test().catch(console.error);
