# Deploy to the Edge

## What You've Built

Let's take stock. Your agent can now:

- Understand natural language requests
- Route to appropriate handlers
- Query your Supabase database
- Propose actions for sensitive operations
- Wait for human approval
- Handle errors gracefully with retries
- Send emails (with approval)

It runs locally. It's time to put it somewhere your Lovable frontend can actually call it.

## Why Supabase Edge Functions?

You have options for deploying backend code: Vercel, AWS Lambda, Railway, Render, etc. We're using Supabase Edge Functions because:

1. **You already have Supabase**: No new account, no new billing
2. **Same ecosystem**: Your database and functions live together
3. **Deno runtime**: Modern, secure, fast cold starts
4. **Simple deployment**: One CLI command

Edge Functions run on Deno Deploy's global network. When your Lovable app calls the function, the request goes to the nearest edge location. Fast.

## Edge Function Structure

Your Edge Function is just a TypeScript file that exports a handler:

```typescript
// supabase/functions/crm-agent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Handle the request
  const { message } = await req.json();
  
  // Run your agent
  const result = await runAgent(message);
  
  // Return the response
  return new Response(
    JSON.stringify(result),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

That's it. The `serve` function handles HTTP for you. You just process requests and return responses.

## CORS: The Frontend-Backend Handshake

When your Lovable frontend (running on lovable.app or localhost) calls your Edge Function (running on supabase.co), the browser enforces CORS (Cross-Origin Resource Sharing).

Without proper CORS headers, you'll see this error:
```
Access to fetch at 'https://xxx.supabase.co/functions/v1/crm-agent' 
from origin 'https://xxx.lovable.app' has been blocked by CORS policy
```

The fix is adding CORS headers to every response:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // In production, be more specific
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Your actual handler
  try {
    const result = await handleRequest(req);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Important**: The `OPTIONS` preflight check happens before your actual request. If you don't handle it, nothing works.

## Environment Variables

Your secrets (API keys, etc.) should never be in code. Edge Functions read from environment variables:

```typescript
// In your Edge Function
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
```

Set them via the Supabase CLI:

```bash
# Set a secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# List secrets
supabase secrets list
```

Or in the Supabase dashboard: Project Settings > Edge Functions > Secrets

## Deploying Your Function

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (with scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or with npm (any OS)
npm install -g supabase
```

### Step 2: Login and Link

```bash
# Login to your Supabase account
supabase login

# Link to your project (get project ref from dashboard)
supabase link --project-ref your-project-ref
```

### Step 3: Create the Function

Your function lives in `supabase/functions/crm-agent/`:

```
your-project/
├── supabase/
│   └── functions/
│       └── crm-agent/
│           └── index.ts
├── src/
└── ...
```

### Step 4: Deploy

```bash
supabase functions deploy crm-agent
```

That's it. Your function is now live at:
```
https://your-project-ref.supabase.co/functions/v1/crm-agent
```

## Calling from Lovable

In your Lovable frontend:

```typescript
async function askAgent(message: string): Promise<AgentResponse> {
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
    throw new Error(`Agent error: ${response.status}`);
  }
  
  return response.json();
}
```

Note: Even though the frontend uses `ANON_KEY` for authorization, your Edge Function uses `SERVICE_ROLE_KEY` internally. The anon key just proves the request came from a legitimate client.

## Local Development

You don't want to deploy every time you make a change. Run functions locally:

```bash
supabase functions serve crm-agent --env-file .env.local
```

This starts a local server at `http://localhost:54321/functions/v1/crm-agent`.

**Tip**: Create `.env.local` with your secrets for local development. Never commit this file.

## Debugging Deployed Functions

### View Logs

```bash
supabase functions logs crm-agent
```

Or in the dashboard: Edge Functions > crm-agent > Logs

### Common Issues

**Function returns 500 with no details**
- Check the logs - the actual error is there
- Make sure all environment variables are set
- Verify your imports use Deno-compatible URLs

**Function works locally but not deployed**
- Local might have different env vars than production
- Check for hardcoded localhost URLs
- Verify secrets are set with `supabase secrets list`

**CORS errors**
- Make sure you handle OPTIONS requests
- Check that corsHeaders are on EVERY response (including errors)
- Verify the origin is allowed

## Security Considerations

Your Edge Function is publicly accessible. Anyone can call it. Consider:

1. **Rate limiting**: Prevent abuse by limiting requests per IP/user
2. **Input validation**: Never trust user input
3. **Auth verification**: If needed, verify the JWT from the anon key
4. **Cost awareness**: Each LLM call costs money

Basic auth verification:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Get the JWT from the Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization" }),
      { status: 401, headers: corsHeaders }
    );
  }
  
  // Verify it with Supabase (optional - only if you need user identity)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid authorization" }),
      { status: 401, headers: corsHeaders }
    );
  }
  
  // Now you know who's calling
  console.log("Request from user:", user.id);
  
  // Continue with your handler...
});
```

## Up Next

Time for the final exercise. You'll deploy your complete agent to Supabase Edge Functions and test it end-to-end from the Lovable frontend.
