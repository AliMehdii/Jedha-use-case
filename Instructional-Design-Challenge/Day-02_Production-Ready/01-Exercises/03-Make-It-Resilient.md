# Exercise 3: Make It Resilient

## Learning Objectives

By the end of this exercise, you'll:
- Implement retry logic with exponential backoff
- Add graceful error handling to all nodes
- Integrate Resend for sending real emails
- Build error recovery paths in your workflow

## 💡 Using Cursor Effectively

For this complex exercise, try:
- "Explain exponential backoff in simple terms"
- "Help me understand when to retry vs. fail immediately"
- "What's wrong with this error handling code?"

**Important**: Don't just ask Cursor to write the entire retry function. Instead, ask it to explain each part (max retries, delay calculation, error classification) so you understand the pattern.

## Scenario

Your agent can query, update (with approval), and soon send emails. But what happens when Supabase is slow? When Resend has a hiccup? When Claude returns malformed JSON?

Right now: your agent crashes. Let's fix that.

## Your Task

### Step 1: Build Retry Logic Step-by-Step (20 min)

Create `utils/retry.ts`. We'll build the retry utility incrementally so you understand each piece.

#### Part A: Basic Retry Loop (5 min)

Start simple: just try 3 times.

```typescript
// utils/retry.ts

// Start simple: just try 3 times
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === MAX_RETRIES) {
        throw error;  // Give up on last attempt
      }
      
      console.log(`Attempt ${attempt} failed, retrying...`);
    }
  }
  
  throw lastError;
}
```

**Test it**: Try calling `withRetry(() => fetch('https://httpstat.us/500'))` and watch it retry 3 times.

#### Part B: Add Delay (5 min)

Now add a simple 1-second delay between retries:

```typescript
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3;
  const DELAY_MS = 1000;
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed, retrying in ${DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));  // ← NEW
    }
  }
  
  throw lastError;
}
```

#### Part C: Add Exponential Backoff (5 min)

Instead of always 1 second, increase the delay each time:

```typescript
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);  // ← NEW
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

#### Part D: Add Smart Retry Logic (5 min)

Not all errors should be retried. Don't retry permanent errors (404, 401):

```typescript
interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const MAX_RETRIES = options.maxRetries ?? 3;
  const BASE_DELAY_MS = options.baseDelayMs ?? 1000;
  const shouldRetryFn = options.shouldRetry ?? (() => true);
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const isLastAttempt = attempt === MAX_RETRIES;
      const shouldRetry = shouldRetryFn(error);  // ← NEW
      
      if (isLastAttempt || !shouldRetry) {  // ← NEW: Don't retry permanent errors
        throw error;
      }
      
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper: decides which errors are worth retrying
export function defaultShouldRetry(error: any): boolean {
  const status = error?.status || error?.response?.status;
  
  // Don't retry client errors (you messed up) or not found
  if (status === 400 || status === 401 || status === 404) {
    return false;
  }
  
  // Do retry server errors, timeouts, network issues
  return true;
}
```

**Now you have a complete retry utility!**

Usage:
```typescript
const data = await withRetry(
  () => supabase.from("leads").select("*"),
  {
    maxRetries: 3,
    baseDelayMs: 1000,
    shouldRetry: defaultShouldRetry,
  }
);
```

### Step 2: Wrap Supabase Calls (10 min)

Update your database queries to use retry:

```typescript
// Before (fragile)
async function queryLeads(query: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .ilike("company_name", `%${query}%`);
  
  if (error) throw error;
  return data;
}

// After (resilient)
async function queryLeads(query: string): Promise<Lead[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .ilike("company_name", `%${query}%`);
    
    if (error) {
      // Convert Supabase error to throwable
      const e = new Error(error.message);
      (e as any).status = error.code === 'PGRST116' ? 404 : 500;
      throw e;
    }
    
    return data || [];
  }, {
    maxRetries: 3,
    shouldRetry: (error) => {
      // Don't retry "not found" - that's a valid result
      return error?.status !== 404;
    }
  });
}
```

### Step 3: Set Up Resend (10 min)

First, get your Resend API key:
1. Go to https://resend.com
2. Create account (free tier: 100 emails/day)
3. Create API key
4. Add to your `.env`: `RESEND_API_KEY=re_...`

Now create the email utility:

```typescript
// utils/email.ts

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

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";
  
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
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
    maxRetries: 2,  // Emails are less critical - don't retry too much
    baseDelayMs: 2000,
  });
}
```

### Step 4: Create Send Email Handler (15 min)

```typescript
async function handleFollowup(state: AgentState): Promise<Partial<AgentState>> {
  const target = state.intent?.target;
  
  if (!target) {
    return {
      response: "Who would you like me to follow up with? Please specify a name or company.",
    };
  }
  
  // Find the lead
  try {
    const leads = await queryLeads(target);
    
    if (leads.length === 0) {
      return {
        response: `I couldn't find anyone matching "${target}".`,
      };
    }
    
    const lead = leads[0];
    
    // Generate email content (in production, use LLM for personalization)
    const emailContent = {
      to: lead.contact_email,
      subject: `Following up - ${lead.company_name}`,
      body: `Hi ${lead.contact_name},

I wanted to follow up on our recent conversation about ${lead.company_name}.

Is there anything else I can help clarify or any questions you have?

Best regards,
Your CRM Assistant`,
    };
    
    // Email always requires approval
    return {
      pendingAction: {
        type: "send_email",
        leadId: lead.id,
        leadName: lead.company_name,
        emailContent,
      },
      approvalStatus: "pending",
      response: `📧 Ready to send email to ${lead.contact_name} (${lead.contact_email}):\n\nSubject: ${emailContent.subject}\n\n${emailContent.body}\n\n⏳ Awaiting approval...`,
    };
    
  } catch (error) {
    // Graceful error handling
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      response: "I had trouble looking up that contact. Please try again.",
    };
  }
}
```

### Step 5: Create Execute Email Node (10 min)

```typescript
async function executeApprovedEmail(state: AgentState): Promise<Partial<AgentState>> {
  const pending = state.pendingAction;
  
  if (!pending || pending.type !== "send_email" || !pending.emailContent) {
    return { error: "No valid pending email" };
  }
  
  if (state.approvalStatus !== "approved") {
    return { error: "Cannot send email without approval" };
  }
  
  // Actually send the email
  const result = await sendEmail(pending.emailContent);
  
  if (!result.success) {
    return {
      error: result.error,
      response: `❌ Failed to send email: ${result.error}\n\nPlease try again later.`,
    };
  }
  
  // Log the interaction
  await supabase.from("interactions").insert({
    lead_id: pending.leadId,
    interaction_type: "email_sent",
    description: `Sent follow-up email: "${pending.emailContent.subject}"`,
    performed_by: "agent",
    required_approval: true,
    approved: true,
    metadata: { 
      message_id: result.messageId,
      to: pending.emailContent.to,
    },
  });
  
  // Update last contacted date
  await supabase
    .from("leads")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", pending.leadId);
  
  return {
    response: `✅ Email sent to ${pending.emailContent.to}!\n\nMessage ID: ${result.messageId}`,
    pendingAction: null,
    approvalStatus: null,
  };
}
```

### Step 6: Add Error Recovery Node (10 min)

Create a catch-all error handler:

```typescript
async function errorRecovery(state: AgentState): Promise<Partial<AgentState>> {
  const error = state.error;
  
  // Log for debugging
  console.error("[ErrorRecovery] Handling error:", {
    error,
    step: state.currentStep,
    intent: state.intent,
  });
  
  // Classify the error
  let userMessage: string;
  let canRetry = false;
  
  if (error?.includes("timeout") || error?.includes("network")) {
    userMessage = "I'm having trouble connecting. Please try again in a moment.";
    canRetry = true;
  } else if (error?.includes("not found") || error?.includes("404")) {
    userMessage = "I couldn't find what you're looking for. Try a different search term.";
  } else if (error?.includes("permission") || error?.includes("401") || error?.includes("403")) {
    userMessage = "I don't have permission to do that. Please check your settings.";
  } else if (error?.includes("rate limit") || error?.includes("429")) {
    userMessage = "I'm being rate limited. Please wait a minute and try again.";
    canRetry = true;
  } else {
    userMessage = "Something went wrong. Please try rephrasing your request.";
  }
  
  return {
    response: `⚠️ ${userMessage}${canRetry ? "\n\n(Tip: This might be temporary - try again in a few seconds)" : ""}`,
    // Clear error state so next request starts fresh
    error: null,
    pendingAction: null,
    approvalStatus: null,
  };
}
```

### Step 7: Wire Up Error Handling (10 min)

Update your routing to catch errors:

```typescript
// Add error recovery node
workflow.addNode("error_recovery", errorRecovery);

// Modify each node to route to error_recovery on failure
function routeWithErrorHandling(state: AgentState): string {
  if (state.error) {
    return "error_recovery";
  }
  // ... rest of your routing logic
}

// Make sure error_recovery leads to END
workflow.addEdge("error_recovery", END);
```

### Step 8: Test Resilience (10 min)

Create tests that simulate failures:

```typescript
async function testResilience() {
  // Test 1: Database timeout simulation
  console.log("\n--- Test: Database resilience ---");
  // Temporarily break the Supabase URL to simulate failure
  const originalUrl = Deno.env.get("SUPABASE_URL");
  Deno.env.set("SUPABASE_URL", "https://invalid.supabase.co");
  
  const result1 = await app.invoke({
    userMessage: "Show me all leads",
    // ... initial state
  });
  console.log("Response:", result1.response);
  // Should show graceful error, not crash
  
  Deno.env.set("SUPABASE_URL", originalUrl!);
  
  // Test 2: Email sending (without approval)
  console.log("\n--- Test: Email flow ---");
  Deno.env.set("AUTO_APPROVE", "true");
  
  const result2 = await app.invoke({
    userMessage: "Send follow-up to TechCorp",
    // ... initial state
  });
  console.log("Response:", result2.response);
  // Should show email sent confirmation
  
  // Test 3: Invalid request
  console.log("\n--- Test: Invalid input handling ---");
  const result3 = await app.invoke({
    userMessage: "",  // Empty input
    // ... initial state
  });
  console.log("Response:", result3.response);
  // Should handle gracefully
}
```

## Success Criteria

- [ ] Database queries retry up to 3 times on failure
- [ ] Failed queries show user-friendly error message, not crash
- [ ] Email sending works with Resend integration
- [ ] Email requires approval before sending
- [ ] Sent emails are logged in interactions table
- [ ] Error recovery provides helpful suggestions

## Debugging Tips

**If retries aren't working:**
- Add console.log inside the retry loop
- Check if your error has a status property
- Verify shouldRetry logic is correct

**If email fails:**
- Check Resend API key is set correctly
- Verify the "from" address is verified in Resend
- Check Resend dashboard for error details

**If errors aren't being caught:**
- Make sure you're throwing errors, not returning them
- Check that withRetry is actually wrapping your function call
- Verify error routing logic in your workflow

## What You Just Built

Your agent is now production-hardened:
- **Retries** handle transient failures automatically
- **Graceful degradation** keeps the UX smooth even when things break
- **Email integration** lets you actually communicate (with approval)
- **Error recovery** turns crashes into helpful messages

## Stretch Goal

Add a "health check" endpoint that your agent can call to verify all services are working:

```typescript
async function healthCheck(): Promise<{
  database: boolean;
  email: boolean;
  llm: boolean;
}> {
  const results = await Promise.all([
    // Check database
    supabase.from("leads").select("id").limit(1)
      .then(() => true)
      .catch(() => false),
    
    // Check email (just validate API key)
    fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` }
    }).then(r => r.ok).catch(() => false),
    
    // Check LLM
    anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }]
    }).then(() => true).catch(() => false),
  ]);
  
  return {
    database: results[0],
    email: results[1],
    llm: results[2],
  };
}
```

Use this before running expensive operations to fail fast if something's down.
