# Talking to Supabase

## Your Agent Needs Data

So far, your agent can think and route — but it's thinking about nothing. It has no connection to the real world. Time to fix that.

Your CRM lives in Supabase. Your agent needs to:
1. Query leads based on user requests
2. Update lead records when asked
3. Log interactions for accountability

Today we focus on reading. Tomorrow we add writing (with proper safety guards).

## Supabase in Edge Functions

You've used the Supabase client in your React frontend. The Edge Function version is almost identical, with one key difference: **you'll use the service role key**.

### Why Service Role?

Your frontend uses the `anon` key, which respects Row Level Security (RLS). Users only see their own data.

Your agent runs server-side in an Edge Function. It needs to see *all* the data to be useful. The service role key bypasses RLS entirely.

```typescript
// Frontend (restricted access)
const supabase = createClient(url, anonKey);

// Edge Function (full access)
const supabase = createClient(url, serviceRoleKey);
```

**This is powerful and dangerous.** The service role can do anything: read all tables, delete all rows, drop databases. Never expose this key to clients. It lives only in your Edge Function environment variables.

## Setting Up the Client

Here's the setup code you'll use:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get credentials from environment
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create client
const supabase = createClient(supabaseUrl, supabaseKey);
```

The `!` after `Deno.env.get()` is TypeScript's non-null assertion. We're telling TypeScript "trust me, this value exists." If it doesn't, the function will crash — which is actually what you want. Failing fast is better than silently using `undefined`.

## Querying Leads

The Supabase query API is chainable and readable:

```typescript
// Get all leads
const { data: leads, error } = await supabase
  .from("leads")
  .select("*");

// Get leads with high scores
const { data: hotLeads, error } = await supabase
  .from("leads")
  .select("*")
  .gt("score", 80);

// Search by company name
const { data: matches, error } = await supabase
  .from("leads")
  .select("*")
  .ilike("company_name", "%techcorp%");  // Case-insensitive partial match

// Get a specific lead by ID
const { data: lead, error } = await supabase
  .from("leads")
  .select("*")
  .eq("id", leadId)
  .single();  // Expect exactly one result
```

Always check for errors:

```typescript
const { data, error } = await supabase.from("leads").select("*");

if (error) {
  console.error("Supabase query failed:", error.message);
  return { 
    ...state, 
    error: `Database error: ${error.message}`,
    currentStep: "error_handler"
  };
}

// Safe to use data now
return { ...state, leads: data };
```

## Common Query Patterns for CRM

Your agent will need to handle various user requests. Here are the queries you'll likely need:

### "Show me all my leads"

```typescript
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .order("score", { ascending: false });  // Highest scores first
```

### "Show me leads from [company]"

```typescript
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .ilike("company_name", `%${searchTerm}%`);
```

### "Show me hot leads" (score > 80)

```typescript
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .gt("score", 80)
  .order("score", { ascending: false });
```

### "Show me new leads"

```typescript
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .eq("status", "new")
  .order("created_at", { ascending: false });
```

### "Get details on [specific lead]"

```typescript
// First, find the lead
const { data: leads, error } = await supabase
  .from("leads")
  .select("*")
  .ilike("company_name", `%${companyName}%`);

if (!leads || leads.length === 0) {
  return { error: `No lead found matching "${companyName}"` };
}

if (leads.length > 1) {
  // Ambiguous - let user clarify
  return { 
    response: `Found ${leads.length} leads matching "${companyName}". Which one?\n${leads.map(l => `- ${l.company_name}`).join("\n")}`
  };
}

// Exactly one match
const lead = leads[0];
```

## Turning Queries into Nodes

Here's how a query node looks in practice:

```typescript
async function queryLeads(state: AgentState): Promise<Partial<AgentState>> {
  // Validate we have what we need
  if (!state.intent || state.intent.type !== "lookup") {
    return { error: "queryLeads called with wrong intent" };
  }

  const searchQuery = state.intent.query;
  
  try {
    // Build the query based on what user asked for
    let query = supabase.from("leads").select("*");
    
    if (searchQuery === "all") {
      // No filter needed
    } else if (searchQuery === "hot") {
      query = query.gt("score", 80);
    } else if (searchQuery === "new") {
      query = query.eq("status", "new");
    } else {
      // Treat as company name search
      query = query.ilike("company_name", `%${searchQuery}%`);
    }
    
    const { data, error } = await query.order("score", { ascending: false });
    
    if (error) {
      return { 
        error: `Database error: ${error.message}`,
        currentStep: "error_handler"
      };
    }
    
    return { 
      leads: data || [],
      currentStep: "format_response"
    };
    
  } catch (e) {
    return { 
      error: `Unexpected error: ${e.message}`,
      currentStep: "error_handler"
    };
  }
}
```

Notice the defensive coding:
- Check the intent before doing anything
- Handle both Supabase errors and unexpected exceptions
- Always set the next step explicitly
- Return empty array instead of null for leads

## The Supabase Gotcha: It Never Throws

This catches everyone at least once. Supabase queries don't throw errors — they return them:

```typescript
// This will NOT throw, even if the query fails
const { data, error } = await supabase.from("leads").select("*");

// You MUST check error manually
if (error) {
  // Handle it
}
```

If you forget to check `error`, your code will happily continue with `data: null` and explode somewhere downstream. Always check errors immediately after the query.

## Keeping Secrets Secret

Your service role key can do *anything* to your database. A few rules:

1. **Never hardcode it**. Always use environment variables.
2. **Never log it**. Even in debug mode.
3. **Never return it**. If your Edge Function accidentally includes it in a response, you're compromised.

```typescript
// BAD - key visible in response
return { 
  message: "Success",
  debug: { key: supabaseKey }  // NEVER DO THIS
};

// BAD - key in logs
console.log("Using key:", supabaseKey);  // NEVER DO THIS

// GOOD - key stays invisible
const supabase = createClient(url, key);
// Use client, never reference key again
```

If you ever suspect your service role key leaked, rotate it immediately in the Supabase dashboard.

## Up Next

You know how to query. Now let's build an exercise where your agent fetches real lead data from your Supabase database.
