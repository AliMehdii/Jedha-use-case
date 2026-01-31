// ============================================
// Type Definitions for CRM Agent
// ============================================
// These types define the shape of data flowing through your agent.
// Good types = fewer bugs = happier debugging sessions.

// --------------------------------------------
// Database Types (match your Supabase schema)
// --------------------------------------------

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  status: LeadStatus;
  score: number;
  source: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
}

export type InteractionType = 
  | "email_sent" 
  | "status_change" 
  | "note_added" 
  | "agent_action" 
  | "human_approval";

export interface Interaction {
  id: string;
  lead_id: string;
  interaction_type: InteractionType;
  description: string;
  performed_by: "agent" | "human";
  required_approval: boolean;
  approved: boolean | null;
  approved_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --------------------------------------------
// Agent State Types
// --------------------------------------------
// This is the "memory" your agent carries between steps

export interface AgentState {
  // The original user request
  userMessage: string;
  
  // What the agent understood from the request
  intent: AgentIntent | null;
  
  // Current step in the workflow
  currentStep: string;
  
  // Data fetched from Supabase
  leads: Lead[];
  
  // Actions the agent wants to take
  pendingActions: AgentAction[];
  
  // Actions that need human approval before executing
  awaitingApproval: AgentAction[];
  
  // The final response to send back
  response: string | null;
  
  // Error tracking
  error: string | null;
  retryCount: number;
}

// What the agent thinks the user wants
export type AgentIntent = 
  | { type: "lookup"; query: string }           // "Show me leads from tech companies"
  | { type: "qualify"; leadId: string }         // "Qualify the TechCorp lead"  
  | { type: "followup"; leadId: string }        // "Send a follow-up to Sophie"
  | { type: "update"; leadId: string; changes: Partial<Lead> }  // "Mark TechCorp as won"
  | { type: "unknown"; rawMessage: string };    // Couldn't understand

// Actions the agent can take
export type AgentAction = 
  | { type: "query_database"; query: string }
  | { type: "update_lead"; leadId: string; changes: Partial<Lead> }
  | { type: "send_email"; to: string; subject: string; body: string }
  | { type: "log_interaction"; leadId: string; interaction: Omit<Interaction, "id" | "created_at"> };

// --------------------------------------------
// API Response Types
// --------------------------------------------

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: {
    leads?: Lead[];
    actionsTaken?: string[];
    pendingApproval?: AgentAction[];
  };
  error?: string;
}

// --------------------------------------------
// Helper: Create initial state
// --------------------------------------------

export function createInitialState(userMessage: string): AgentState {
  return {
    userMessage,
    intent: null,
    currentStep: "start",
    leads: [],
    pendingActions: [],
    awaitingApproval: [],
    response: null,
    error: null,
    retryCount: 0,
  };
}
