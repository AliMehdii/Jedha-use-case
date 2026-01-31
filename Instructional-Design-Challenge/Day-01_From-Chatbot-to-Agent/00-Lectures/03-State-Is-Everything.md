# State Is Everything

## The Problem of Forgetful Functions

Here's something that trips up a lot of people: regular functions don't remember anything.

```typescript
function step1() {
  const result = doSomething();
  // result exists here...
}

function step2() {
  // ...but not here. result is gone.
}
```

If you call `step1()` then `step2()`, they can't share information. Each function lives in its own little world.

This is a problem for agents. Your `understand_request` node figures out what the user wants. Your `query_leads` node needs that information to know what to query. How do they communicate?

**Answer: State.**

## State is the Shared Notebook

In LangGraph, every node receives the current state and returns an updated state. It's like a notebook that gets passed from person to person:

```
Node 1 reads notebook → writes findings → passes notebook
Node 2 reads notebook → writes findings → passes notebook
Node 3 reads notebook → writes findings → done
```

Here's what that looks like in code:

```typescript
// Every node has this signature
function myNode(state: AgentState): Partial<AgentState> {
  // Read from state
  const userMessage = state.userMessage;
  
  // Do something
  const intent = analyzeMessage(userMessage);
  
  // Return updates (they get merged into state)
  return { intent };
}
```

Notice: you don't return the *entire* state, just the parts you changed. LangGraph merges your updates with the existing state automatically.

## Designing Your State

State design is one of the most important decisions you'll make. Get it wrong, and you'll be fighting your own code all week.

Here's the state for our CRM agent:

```typescript
interface AgentState {
  // -------- Input --------
  userMessage: string;        // What the user sent us
  
  // -------- Understanding --------
  intent: AgentIntent | null; // What we think they want
  
  // -------- Data --------
  leads: Lead[];              // Fetched from Supabase
  selectedLead: Lead | null;  // The specific lead we're working with
  
  // -------- Actions --------
  pendingActions: Action[];   // Things we want to do
  completedActions: Action[]; // Things we've done
  
  // -------- Control flow --------
  currentStep: string;        // Where we are in the workflow
  awaitingApproval: boolean;  // Paused for human input?
  
  // -------- Output --------
  response: string | null;    // Final answer to user
  
  // -------- Error handling --------
  error: string | null;       // What went wrong (if anything)
  retryCount: number;         // How many times we've retried
}
```

Let me break down the thinking here:

**Input section**: The raw user request. Never modified after being set.

**Understanding section**: Our interpretation of the request. Set by the `understand_request` node, read by everyone else.

**Data section**: Information from external sources (Supabase). Gets populated as we query.

**Actions section**: What the agent wants to do and has done. This is your audit trail — you can always see what happened.

**Control flow section**: Where we are and whether we're blocked. Used by conditional edges to route correctly.

**Output section**: The final response. Built up piece by piece, sent at the end.

**Error handling section**: Tracks failures so we can retry intelligently.

## Common State Design Mistakes

I've seen these trip people up repeatedly:

### Mistake 1: Putting everything in one blob

```typescript
// Bad: What even is this?
interface AgentState {
  data: any;
}
```

When something goes wrong (and it will), you'll have no idea what's in `data`. Be specific. Name things. Your future self will thank you.

### Mistake 2: Forgetting history

```typescript
// Bad: Only tracks current action
interface AgentState {
  currentAction: Action;
}
```

If the agent takes 5 actions and then fails, you can't see what happened. Always keep a history:

```typescript
// Good: Track everything
interface AgentState {
  pendingActions: Action[];
  completedActions: Action[];
  failedActions: Action[];
}
```

### Mistake 3: No error tracking

```typescript
// Bad: Errors just... vanish
function myNode(state: AgentState) {
  try {
    // do stuff
  } catch (e) {
    console.log(e);  // Logged and forgotten
    return state;    // State unchanged, problem hidden
  }
}
```

If something fails, put it in state. Otherwise downstream nodes have no idea anything went wrong:

```typescript
// Good: Error is visible in state
function myNode(state: AgentState) {
  try {
    // do stuff
  } catch (e) {
    return { 
      error: e.message,
      currentStep: "error_handler"  // Route to error handling
    };
  }
}
```

## State Updates are Merges

This is subtle but important. When you return from a node, you're not replacing state — you're merging:

```typescript
// Current state
{
  userMessage: "Show me TechCorp",
  intent: null,
  leads: []
}

// Node returns
{ intent: { type: "lookup", query: "TechCorp" } }

// Result (merged)
{
  userMessage: "Show me TechCorp",  // Still here
  intent: { type: "lookup", query: "TechCorp" },  // Updated
  leads: []  // Still here
}
```

You only change what you return. Everything else stays the same.

**But watch out for arrays and objects:**

```typescript
// If state.leads = [lead1, lead2]
// And you return { leads: [lead3] }
// Result: leads = [lead3]  ← lead1 and lead2 are GONE

// To append, spread the existing array:
return { leads: [...state.leads, lead3] };
```

## TypeScript is Your Friend Here

This is why we use TypeScript for this module. With JavaScript, state is just a bag of `any` and you're constantly guessing what's in it.

With TypeScript:

```typescript
function queryLeads(state: AgentState): Partial<AgentState> {
  // TypeScript knows state.intent might be null
  if (!state.intent) {
    return { error: "No intent set" };
  }
  
  // TypeScript knows intent has a .type property
  if (state.intent.type !== "lookup") {
    return { error: "Wrong intent for this node" };
  }
  
  // TypeScript autocompletes state.intent.query
  const query = state.intent.query;
  
  // ... rest of the function
}
```

The type system catches mistakes before you run the code. When you're debugging at 11pm, you'll appreciate not having to wonder "wait, is `intent` a string or an object?"

## Quick Reference

| Pattern | When to use |
|---------|-------------|
| `return { field: value }` | Update a single field |
| `return { field: value, other: value }` | Update multiple fields |
| `return {}` | Change nothing (rare, but valid) |
| `return { arr: [...state.arr, newItem] }` | Append to array |
| `return { obj: { ...state.obj, key: value } }` | Update nested object |

## Up Next

You've got the theory. Now let's build a workflow with multiple nodes that actually communicate through state.
