# Exercise 4: Ship It

## Learning Objectives

By the end of this exercise, you'll:
- Deploy your agent to Supabase Edge Functions
- Configure environment variables for production
- Test the deployed agent from your Lovable frontend
- Debug deployment issues

## 💡 Using Cursor During Deployment

Cursor can help with:
- "Explain what CORS is and why I need it"
- "Help me debug this 500 error in my Edge Function"
- "What's the difference between SUPABASE_ANON_KEY and SERVICE_ROLE_KEY?"

**Deployment tip**: When things go wrong (they will!), ask Cursor to help interpret error messages before asking the instructor. Learning to debug production issues is a key skill.

## Scenario

Your agent works locally. It's resilient. It has approval flows. It sends emails.

Now it needs to actually run somewhere your frontend can reach it.

Time to deploy.

## Your Task

### Step 1: Prepare Your Function (10 min)

Create the final Edge Function structure:

```
supabase/
└── functions/
    └── crm-agent/
        ├── index.ts      # Entry point
        ├── agent.ts      # Your agent logic
        ├── types.ts      # Type definitions
        └── utils/
            ├── retry.ts  # Retry utilities
            └── email.ts  # Email utilities
```

Your `index.ts` should look like this:

```typescript
// supabase/functions/crm-agent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runAgent } from "./agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Parse request
    const { message, action, actionId } = await req.json();
    
    // Handle approval actions
    if (action === "approve" && actionId) {
      const result = await runAgent(null, { approve: actionId });
      return jsonResponse(result);
    }
    
    if (action === "reject" && actionId) {
      const result = await runAgent(null, { reject: actionId });
      return jsonResponse(result);
    }
    
    // Handle normal messages
    if (!message) {
      return jsonResponse({ error: "Missing 'message' field" }, 400);
    }
    
    const result = await runAgent(message);
    return jsonResponse(result);
    
  } catch (error) {
    console.error("Agent error:", error);
    return jsonResponse(
      { error: "Something went wrong. Please try again." },
      500
    );
  }
  
  function jsonResponse(data: any, status = 200) {
    return new Response(
      JSON.stringify(data),
      { 
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
```

### Step 2: Export Your Agent Function (10 min)

Modify your `agent.ts` to export a clean interface:

```typescript
// supabase/functions/crm-agent/agent.ts

// ... all your existing code (state, nodes, workflow) ...

// Export a clean function for the Edge Function to call
export async function runAgent(
  message: string | null,
  approval?: { approve?: string; reject?: string }
): Promise<AgentResponse> {
  
  // Handle approval/rejection of pending actions
  if (approval?.approve) {
    return handleApprovalAction(approval.approve, true);
  }
  if (approval?.reject) {
    return handleApprovalAction(approval.reject, false);
  }
  
  // Handle normal message
  if (!message) {
    return { success: false, error: "No message provided" };
  }
  
  try {
    const result = await app.invoke({
      userMessage: message,
      intent: null,
      leads: [],
      pendingAction: null,
      approvalStatus: null,
      approvalReason: null,
      response: null,
      error: null,
    });
    
    return {
      success: !result.error,
      message: result.response || "No response generated",
      data: {
        leads: result.leads,
        pendingApproval: result.pendingAction ? {
          actionId: result.pendingAction.leadId,
          type: result.pendingAction.type,
          description: `${result.pendingAction.type} for ${result.pendingAction.leadName}`,
        } : null,
      },
      error: result.error || undefined,
    };
    
  } catch (error) {
    console.error("Agent execution error:", error);
    return {
      success: false,
      error: "Agent failed to process request",
    };
  }
}

// Handle approval/rejection of stored pending actions
async function handleApprovalAction(
  actionId: string,
  approved: boolean
): Promise<AgentResponse> {
  // In a production system, you'd store pending actions in the database
  // and retrieve them here. For this exercise, we'll return a placeholder.
  
  return {
    success: true,
    message: approved 
      ? `Action ${actionId} approved and executed.`
      : `Action ${actionId} rejected.`,
  };
}
```

### Step 3: Set Up Supabase CLI (5 min)

If you haven't already:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in the Supabase dashboard URL:
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### Step 4: Set Environment Variables (5 min)

Your Edge Function needs secrets:

```bash
# Set secrets (one at a time)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM=onboarding@resend.dev
supabase secrets set HIGH_VALUE_THRESHOLD=80

# Verify they're set
supabase secrets list
```

**Note**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions - you don't need to set them.

### Step 5: Deploy (5 min)

```bash
# Deploy the function
supabase functions deploy crm-agent

# You should see:
# Deploying function crm-agent...
# Function crm-agent deployed successfully!
```

Your function is now live at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-agent
```

### Step 6: Test the Deployed Function (10 min)

Test with curl:

```bash
# Test a simple query
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-agent' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"message": "Show me hot leads"}'

# Expected response:
# {"success":true,"message":"Found 3 hot leads...","data":{...}}
```

Test approval flow:

```bash
# Trigger an action that needs approval
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-agent' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"message": "Mark TechCorp as won"}'

# Should return pending approval with actionId
```

### Step 7: Connect Your Lovable Frontend (15 min)

In your Lovable app, create a hook to call the agent:

```typescript
// src/hooks/useAgent.ts
import { useState } from "react";

interface AgentResponse {
  success: boolean;
  message: string;
  data?: {
    leads?: any[];
    pendingApproval?: {
      actionId: string;
      type: string;
      description: string;
    };
  };
  error?: string;
}

export function useAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sendMessage = async (message: string): Promise<AgentResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ message }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  const approveAction = async (actionId: string): Promise<AgentResponse | null> => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "approve", actionId }),
        }
      );
      return await response.json();
    } finally {
      setLoading(false);
    }
  };
  
  const rejectAction = async (actionId: string): Promise<AgentResponse | null> => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "reject", actionId }),
        }
      );
      return await response.json();
    } finally {
      setLoading(false);
    }
  };
  
  return { sendMessage, approveAction, rejectAction, loading, error };
}
```

### Step 8: Build a Simple Chat UI (15 min)

Create a component to interact with your agent:

```typescript
// src/components/AgentChat.tsx
import { useState } from "react";
import { useAgent } from "../hooks/useAgent";

export function AgentChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{
    role: "user" | "agent";
    content: string;
    pendingAction?: any;
  }>>([]);
  
  const { sendMessage, approveAction, rejectAction, loading } = useAgent();
  
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: input }]);
    const userMessage = input;
    setInput("");
    
    // Get agent response
    const response = await sendMessage(userMessage);
    
    if (response) {
      setMessages(prev => [...prev, {
        role: "agent",
        content: response.message,
        pendingAction: response.data?.pendingApproval,
      }]);
    }
  };
  
  const handleApprove = async (actionId: string) => {
    const response = await approveAction(actionId);
    if (response) {
      setMessages(prev => [...prev, {
        role: "agent",
        content: response.message,
      }]);
    }
  };
  
  const handleReject = async (actionId: string) => {
    const response = await rejectAction(actionId);
    if (response) {
      setMessages(prev => [...prev, {
        role: "agent",
        content: response.message,
      }]);
    }
  };
  
  return (
    <div className="flex flex-col h-96 border rounded-lg">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xs p-3 rounded-lg ${
              msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              
              {msg.pendingAction && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleApprove(msg.pendingAction.actionId)}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(msg.pendingAction.actionId)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              Thinking...
            </div>
          </div>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your leads..."
          className="flex-1 border rounded px-3 py-2"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

## Success Criteria

- [ ] Function deploys without errors
- [ ] curl test returns valid JSON response
- [ ] "Show me leads" returns actual lead data
- [ ] Update requests trigger approval flow
- [ ] Frontend can send messages and receive responses
- [ ] Approve/reject buttons work

## Debugging Tips

**If deployment fails:**
- Check for syntax errors: `deno check supabase/functions/crm-agent/index.ts`
- Verify import URLs are valid Deno URLs (esm.sh, deno.land)
- Check for missing dependencies

**If function returns 500:**
- Check logs: `supabase functions logs crm-agent`
- Verify all secrets are set: `supabase secrets list`
- Test locally first: `supabase functions serve crm-agent --env-file .env`

**If CORS errors:**
- Ensure OPTIONS handler is present
- Check corsHeaders are on ALL responses (including errors)
- Verify frontend URL is allowed

**If auth errors:**
- Check you're using the correct anon key
- Verify the Authorization header format: `Bearer YOUR_KEY`

## What You Just Built

Congratulations! You now have:

1. **A deployed AI agent** that processes natural language
2. **Real database integration** with your Supabase CRM
3. **Human-in-the-loop approval** for sensitive operations
4. **Email sending capability** with Resend
5. **A working frontend** to interact with your agent

This is a real, production-grade autonomous AI system. You built it in two days.

## Capstone: Demo Time (30 min)

For the last 30 minutes, polish your agent and prepare a demo:

1. **Test edge cases**: Empty input, very long input, weird characters
2. **Try the full flow**: Look up lead → update → approve → send email → approve
3. **Check the audit trail**: Look in the `interactions` table to see logged actions
4. **Prepare 2-3 demo scenarios** to show the class

Demo ideas:
- "Show me hot leads, then send a follow-up to the top one"
- "Mark TechCorp as won" (showing approval flow)
- Intentionally trigger an error and show graceful handling

## What's Next?

You've built the foundation. Here's where you could go from here:

- **Add more tools**: Calendar integration, Slack notifications, document generation
- **Improve intent classification**: Fine-tune with your own examples
- **Add memory**: Store conversation history for multi-turn interactions
- **Build evaluation**: Measure agent accuracy on test cases
- **Add monitoring**: Track latency, errors, and usage patterns

The pattern you learned — nodes, edges, state, tools, approval — scales to much more complex agents. Go build something amazing.
