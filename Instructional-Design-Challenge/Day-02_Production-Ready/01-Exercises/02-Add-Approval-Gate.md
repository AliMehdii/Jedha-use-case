# Exercise 2: Add Approval Gate

## Learning Objectives

By the end of this exercise, you'll:
- Implement human-in-the-loop checkpoints in LangGraph
- Design approval workflows for sensitive operations
- Handle both approval and rejection gracefully
- Track pending actions in state

## 💡 Using Cursor for This Exercise

Cursor can help you:
- "Explain what human-in-the-loop means in AI systems"
- "Help me add approval tracking to this state interface"
- "What should I check to determine if an action needs approval?"

**Pro tip**: When Cursor suggests code, ask it to explain the logic before you use it. This exercise is about understanding approval workflows, not just getting code that works.

## Scenario

Your CRM agent can query leads, and soon it'll be able to update them. But you don't want it updating high-value leads (score > 80) without your say-so.

Time to add an approval gate.

## Your Task

### Step 1: Extend Your State (5 min)

Add approval-related fields to your agent state:

```typescript
interface AgentState {
  // ... existing fields from Day 1
  userMessage: string;
  intent: AgentIntent | null;
  leads: Lead[];
  response: string | null;
  error: string | null;
  
  // NEW: Approval tracking
  pendingAction: {
    type: "update_lead" | "send_email";
    leadId: string;
    leadName: string;
    changes?: Partial<Lead>;
    emailContent?: { to: string; subject: string; body: string };
  } | null;
  
  approvalStatus: "pending" | "approved" | "rejected" | null;
  approvalReason: string | null;
}
```

Update your state channels:

```typescript
channels: {
  // ... existing channels
  pendingAction: { value: (a, b) => b ?? a },
  approvalStatus: { value: (a, b) => b ?? a },
  approvalReason: { value: (a, b) => b ?? a },
}
```

### Step 2: Create the Approval Check Function (10 min)

Write a function that determines if an action needs approval:

```typescript
function needsApproval(actionType: string, lead: Lead | null): boolean {
  // TODO: Implement the approval rules
  // 1. All email sending requires approval
  // 2. Updates to leads with score > 80 require approval
  // 3. Everything else is auto-approved
  
}

// Test cases:
// needsApproval("send_email", null) → true
// needsApproval("update_lead", { score: 85 }) → true
// needsApproval("update_lead", { score: 50 }) → false
// needsApproval("query", null) → false
```

### Step 3: Create the Update Handler with Approval (20 min)

Build a handler that proposes updates instead of executing them directly:

```typescript
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
      response: `I couldn't find a lead matching "${target}".`,
    };
  }
  
  const lead = leads[0];
  
  // Parse what changes the user wants
  // (In a real system, you'd use the LLM to extract this from the message)
  const changes = parseChangesFromMessage(state.userMessage, lead);
  
  // Check if approval is needed
  if (needsApproval("update_lead", lead)) {
    // TODO: Return state that pauses for approval
    // Set pendingAction with the proposed changes
    // Set approvalStatus to "pending"
    // Set response to explain what's pending
    return {
      // Your code here
    };
  }
  
  // No approval needed - execute directly
  // (We'll implement the actual update in Step 5)
  return executeUpdate(lead, changes);
}

// Helper to parse changes from natural language
function parseChangesFromMessage(message: string, lead: Lead): Partial<Lead> {
  // Simplified parsing - in production, use the LLM
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("won") || lowerMessage.includes("closed")) {
    return { status: "won" };
  }
  if (lowerMessage.includes("lost")) {
    return { status: "lost" };
  }
  if (lowerMessage.includes("qualified")) {
    return { status: "qualified" };
  }
  
  // Default: no changes detected
  return {};
}
```

### Step 4: Create the Human Review Node (15 min)

This node handles the approval decision:

```typescript
async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
  // In a real system, this would:
  // 1. Persist state to database
  // 2. Send notification (email, Slack, etc.)
  // 3. Wait for webhook/API call with decision
  
  // For this exercise, we'll simulate with console interaction
  // or a mock approval
  
  const pending = state.pendingAction;
  if (!pending) {
    return { error: "No pending action to review" };
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("🔔 APPROVAL REQUIRED");
  console.log("=".repeat(50));
  console.log(`Action: ${pending.type}`);
  console.log(`Lead: ${pending.leadName}`);
  if (pending.changes) {
    console.log(`Changes: ${JSON.stringify(pending.changes)}`);
  }
  if (pending.emailContent) {
    console.log(`Email to: ${pending.emailContent.to}`);
    console.log(`Subject: ${pending.emailContent.subject}`);
  }
  console.log("=".repeat(50));
  
  // TODO: For testing, implement one of:
  // Option A: Auto-approve after delay (for automated tests)
  // Option B: Read from environment variable
  // Option C: Actually wait for input (for demos)
  
  // For now, let's use environment variable
  const autoDecision = Deno.env.get("AUTO_APPROVE");
  
  if (autoDecision === "true") {
    return {
      approvalStatus: "approved",
      approvalReason: "Auto-approved for testing",
    };
  } else if (autoDecision === "false") {
    return {
      approvalStatus: "rejected",
      approvalReason: "Auto-rejected for testing",
    };
  }
  
  // In real implementation, this would wait for external input
  // For now, default to requiring manual action
  return {
    response: `⏳ This action requires approval. Pending action ID: ${pending.leadId}\n\nCall POST /api/approve/${pending.leadId} to approve or POST /api/reject/${pending.leadId} to reject.`,
    approvalStatus: "pending",
  };
}
```

### Step 5: Create the Execute Update Node (10 min)

Only runs after approval:

```typescript
async function executeApprovedUpdate(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  
  if (!pending || pending.type !== "update_lead") {
    return { error: "No valid pending update" };
  }
  
  if (state.approvalStatus !== "approved") {
    return { error: "Cannot execute without approval" };
  }
  
  // Now actually do the update
  const { data, error } = await supabase
    .from("leads")
    .update(pending.changes)
    .eq("id", pending.leadId)
    .select()
    .single();
  
  if (error) {
    return {
      error: `Failed to update lead: ${error.message}`,
      response: "Sorry, the update failed. Please try again.",
    };
  }
  
  // Log the interaction
  await supabase.from("interactions").insert({
    lead_id: pending.leadId,
    interaction_type: "status_change",
    description: `Updated lead: ${JSON.stringify(pending.changes)}`,
    performed_by: "agent",
    required_approval: true,
    approved: true,
    metadata: { approval_reason: state.approvalReason },
  });
  
  return {
    response: `✅ Updated ${pending.leadName}!\n\nNew status: ${data.status}\nScore: ${data.score}`,
    pendingAction: null,
    approvalStatus: null,
  };
}
```

### Step 6: Handle Rejection (5 min)

```typescript
async function handleRejection(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  
  return {
    response: `❌ Action rejected${state.approvalReason ? `: ${state.approvalReason}` : ""}.\n\nI won't update ${pending?.leadName || "the lead"}. Let me know if you'd like to do something else.`,
    pendingAction: null,
    approvalStatus: null,
  };
}
```

### Step 7: Wire Up the Approval Flow (10 min)

Add the new nodes and routing:

```typescript
// Add nodes
workflow.addNode("handle_update", handleUpdate);
workflow.addNode("human_review", humanReview);
workflow.addNode("execute_update", executeApprovedUpdate);
workflow.addNode("handle_rejection", handleRejection);

// Route based on approval status
function routeAfterReview(state: AgentState): string {
  if (state.approvalStatus === "approved") {
    return "execute_update";
  }
  if (state.approvalStatus === "rejected") {
    return "handle_rejection";
  }
  // Still pending - wait (end for now)
  return "end";
}

// Add edges
workflow.addConditionalEdges(
  "human_review",
  routeAfterReview,
  {
    execute_update: "execute_update",
    handle_rejection: "handle_rejection",
    end: END,
  }
);

workflow.addEdge("execute_update", END);
workflow.addEdge("handle_rejection", END);
```

### Step 8: Test the Approval Flow (10 min)

```typescript
async function testApprovalFlow() {
  // Test 1: Low-value lead (no approval needed)
  console.log("\n--- Test 1: Low-value lead ---");
  Deno.env.set("AUTO_APPROVE", "");
  const result1 = await app.invoke({
    userMessage: "Mark LocalCafe as lost",  // Score: 25
    // ... rest of initial state
  });
  console.log("Result:", result1.response);
  // Expected: Update happens directly
  
  // Test 2: High-value lead (needs approval, auto-approve)
  console.log("\n--- Test 2: High-value lead (auto-approved) ---");
  Deno.env.set("AUTO_APPROVE", "true");
  const result2 = await app.invoke({
    userMessage: "Mark TechCorp as won",  // Score: 85
    // ... rest of initial state
  });
  console.log("Result:", result2.response);
  // Expected: Approval requested, then update executes
  
  // Test 3: High-value lead (needs approval, rejected)
  console.log("\n--- Test 3: High-value lead (rejected) ---");
  Deno.env.set("AUTO_APPROVE", "false");
  const result3 = await app.invoke({
    userMessage: "Mark GlobalRetail as lost",  // Score: 92
    // ... rest of initial state
  });
  console.log("Result:", result3.response);
  // Expected: Approval requested, then rejection handled
}
```

## Success Criteria

- [ ] Updates to leads with score <= 80 happen immediately
- [ ] Updates to leads with score > 80 pause for approval
- [ ] Approved updates execute and show success message
- [ ] Rejected updates show rejection message, no database change
- [ ] Interaction log captures approval/rejection

## Debugging Tips

**If approval check always returns false:**
- Print the lead score you're checking
- Make sure you're comparing numbers, not strings

**If the workflow doesn't pause:**
- Check that `pendingAction` is being set
- Verify your conditional routing is checking `approvalStatus`

**If updates fail after approval:**
- Check Supabase logs for the actual error
- Verify the lead ID is correct
- Make sure changes object has valid field names

## What You Just Built

Your agent now has a safety gate. High-value leads can't be modified without human review. This is the foundation of responsible AI automation:

1. **Propose** actions clearly
2. **Wait** for human decision
3. **Execute** only with approval
4. **Record** everything for accountability

## Stretch Goal

Add email approval: when `send_email` actions are proposed, require approval and include the full email content in the review request. After approval, actually send via Resend (you'll set this up in Exercise 3).
