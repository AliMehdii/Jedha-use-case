# Exercise 1: The Infinite Loop Challenge

## Learning Objectives

By the end of this exercise, you'll:
- Experience agent failure modes firsthand
- Identify infinite loop patterns in agent code
- Implement safeguards to prevent runaway execution
- Debug agent workflows using state inspection

## Scenario

Someone on your team wrote an agent that "sometimes works." They've asked you to figure out what's wrong. Spoiler: there are multiple bugs, and at least one will cause an infinite loop.

Welcome to production debugging.

## 💡 Using Cursor to Help Debug

Throughout this exercise, you can ask Cursor AI for assistance:
- "Why would this create an infinite loop?"
- "What's the difference between these two state values?"
- "How can I add a maximum attempts counter?"

**Remember**: Cursor can explain and suggest, but you need to understand WHY the fixes work. Use AI as a learning tool, not just a copy-paste source.

## Your Task

### Step 1: Get the Buggy Agent (5 min)

Create `buggy-agent.ts` with this intentionally broken code:

```typescript
import { StateGraph, END } from "@langchain/langgraph";

interface BuggyState {
  userMessage: string;
  attempts: number;
  response: string | null;
  needsMoreInfo: boolean;
}

// Bug #1: This node never sets needsMoreInfo to false
async function analyzeRequest(state: BuggyState): Promise<Partial<BuggyState>> {
  console.log(`[analyze] Attempt ${state.attempts}`);
  
  // Simulate "needing more information"
  if (state.userMessage.length < 20) {
    return {
      needsMoreInfo: true,
      attempts: state.attempts + 1,
    };
  }
  
  return {
    response: "Analyzed successfully!",
  };
}

// Bug #2: This node doesn't check if we've already asked
async function requestClarification(state: BuggyState): Promise<Partial<BuggyState>> {
  console.log(`[clarify] Asking for more info...`);
  return {
    response: "Could you provide more details?",
    // Bug: Still doesn't set needsMoreInfo to false!
  };
}

// Bug #3: Router doesn't have a termination condition
function routeAnalysis(state: BuggyState): string {
  if (state.needsMoreInfo) {
    return "request_clarification";
  }
  return "end";
}

// Build the buggy graph
const buggyWorkflow = new StateGraph<BuggyState>({
  channels: {
    userMessage: { value: (a, b) => b ?? a },
    attempts: { value: (a, b) => b ?? a },
    response: { value: (a, b) => b ?? a },
    needsMoreInfo: { value: (a, b) => b ?? a },
  },
});

buggyWorkflow.addNode("analyze_request", analyzeRequest);
buggyWorkflow.addNode("request_clarification", requestClarification);

buggyWorkflow.setEntryPoint("analyze_request");

// Bug #4: Circular routing with no exit
buggyWorkflow.addConditionalEdges(
  "analyze_request",
  routeAnalysis,
  {
    request_clarification: "request_clarification",
    end: END,
  }
);

// This creates the loop: clarification goes back to analyze
buggyWorkflow.addEdge("request_clarification", "analyze_request");

const buggyApp = buggyWorkflow.compile();

// Run it (WARNING: This will loop!)
async function runBuggyAgent() {
  console.log("Starting buggy agent...");
  
  const result = await buggyApp.invoke({
    userMessage: "Hi",  // Short message triggers the bug
    attempts: 0,
    response: null,
    needsMoreInfo: false,
  });
  
  console.log("Result:", result);
}

// Uncomment to run (but be ready to Ctrl+C!)
// runBuggyAgent();
```

### Step 2: Identify the Bugs (10 min)

Before running the code, read through it and try to identify:

1. What will happen when `userMessage` is "Hi" (3 characters)?
2. How many times will `analyzeRequest` run?
3. What condition would allow the workflow to exit?
4. Why does `requestClarification` make things worse?

**Write down your predictions before proceeding.**

### Step 3: Run It (Carefully) (5 min)

Uncomment the last line and run:

```bash
deno run --allow-env --allow-net buggy-agent.ts
```

**Have Ctrl+C ready.** When you see the loop starting, kill it.

Questions to answer:
- How many attempts did it make before you killed it?
- What's the pattern in the console output?
- How would you detect this in production (where you can't see console logs)?

### Step 4: Fix Bug #1 - Add Attempt Limit (10 min)

The simplest fix: don't allow more than N attempts.

```typescript
// TODO: Modify analyzeRequest to include a maximum attempts check
async function analyzeRequest(state: BuggyState): Promise<Partial<BuggyState>> {
  const MAX_ATTEMPTS = 3;
  
  // Your code here: 
  // If attempts >= MAX_ATTEMPTS, return with an error response
  // instead of setting needsMoreInfo: true
  
}
```

### Step 5: Fix Bug #2 - Clear the Flag (10 min)

After requesting clarification, we should reset `needsMoreInfo`:

```typescript
// TODO: Fix requestClarification to break the loop
async function requestClarification(state: BuggyState): Promise<Partial<BuggyState>> {
  console.log(`[clarify] Asking for more info...`);
  
  return {
    response: "Could you provide more details?",
    // What should you add here?
  };
}
```

But wait — even with this fix, what happens on the next analyze call?

### Step 6: Fix Bug #3 - Add Exit Condition to Router (10 min)

The router needs to know when to stop:

```typescript
// TODO: Fix the router to check attempts and response
function routeAnalysis(state: BuggyState): string {
  // If we have a response, we're done
  // If we've hit max attempts, we're done
  // If we need more info AND haven't asked yet, ask
  // Otherwise, something is wrong - exit anyway
  
  // Your logic here
}
```

### Step 7: Test Your Fixes (5 min)

With all fixes in place, your agent should:
- Ask for clarification once (not infinitely)
- Give up after 3 attempts
- Never loop more than 3 times total

Test cases:

```typescript
// Should trigger clarification, then exit
await runAgent("Hi");

// Should succeed without clarification
await runAgent("Show me all the leads in my database please");

// Edge case: What about empty string?
await runAgent("");
```

## Success Criteria

- [ ] Agent exits after max 3 iterations for any input
- [ ] Short messages get one clarification request, then an error
- [ ] Long messages succeed on first try
- [ ] No infinite loops (test by running for 30 seconds)
- [ ] You can explain why each bug caused problems

## Debugging Tips

**If the loop continues after your "fix":**
- Add more console.log statements to see state at each step
- Check if your condition is actually evaluating to true
- Print the entire state object, not just one field

**If you're not sure what's happening:**
```typescript
// Add this helper
function debugState(label: string, state: BuggyState) {
  console.log(`[DEBUG ${label}]`, JSON.stringify(state, null, 2));
}
```

## What You Just Learned

Infinite loops in agents happen when:
1. A condition never becomes false
2. State updates don't affect the routing decision
3. There's no maximum iteration limit
4. Exit conditions aren't checked in the router

**The fix pattern**: 
- Always have a max attempts/iterations limit
- Always check that limit in your router
- Always clear flags after handling them
- Always log enough to debug later

## Stretch Goal

Add a "circuit breaker" that tracks how many times the agent has looped in the last minute. If it exceeds 10 iterations/minute, refuse to run:

```typescript
const recentExecutions: Date[] = [];

function canExecute(): boolean {
  // Remove entries older than 1 minute
  const oneMinuteAgo = Date.now() - 60000;
  while (recentExecutions.length && recentExecutions[0].getTime() < oneMinuteAgo) {
    recentExecutions.shift();
  }
  
  // Check if we're over the limit
  if (recentExecutions.length >= 10) {
    return false;
  }
  
  recentExecutions.push(new Date());
  return true;
}
```

This prevents the agent from burning through API credits even if the loop detection fails.
