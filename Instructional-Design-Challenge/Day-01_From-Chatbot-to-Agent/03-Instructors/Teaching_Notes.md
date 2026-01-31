# Day 1 Teaching Notes: From Chatbot to Agent

## Overview

**Theme**: Understanding the mental model shift from chatbots to agents, and building a working read-only agent.

**Key Learning Objectives**:
1. Students understand the fundamental difference between chatbots and agents
2. Students can create LangGraph nodes and wire them together
3. Students understand state management in workflows
4. Students can query Supabase from their agent

**End of Day Deliverable**: An agent that understands natural language, routes by intent, and queries real lead data from Supabase.

## Timing Guide (Optimized for 70% Hands-On)

| Time | Activity | Notes |
|------|----------|-------|
| 0:00-0:20 | **Lecture 1**: What's an Agent? | Set the "why" clearly (trimmed to 20min) |
| 0:20-1:05 | **Exercise 1**: Break a Chatbot | Fun, hands-on proof of limitations |
| 1:05-1:20 | Break | |
| 1:20-1:40 | **Lecture 2**: LangGraph Mental Model | Nodes, edges, state - the core concepts (20min) |
| 1:40-2:40 | **Exercise 2**: Your First Node | First real LangGraph code |
| 2:40-2:55 | Break | |
| 2:55-3:25 | **Lecture 3**: State & Data (COMBINED) | State management + Supabase integration (30min) |
| 3:25-4:25 | **Exercise 3**: Multi-Node Flow | Conditional routing |
| 4:25-4:40 | Break | |
| 4:40-6:00 | **Exercise 4**: Query Your Leads | Real database queries (extended to 80min) |
| 6:00-6:15 | Break | |
| 6:15-6:45 | **Wrap-up**: Debug Session + Q&A | Fix common issues together |
| 6:45-7:00 | **Preview Tomorrow** | Safety, human-in-the-loop, deployment |

**Total Times:**
- Lectures: 70 minutes (17%)
- Exercises: 285 minutes (68%)
- Breaks: 45 minutes (11%)
- Wrap-up: 20 minutes (5%)

**Hands-on ratio: 73% (including wrap-up debugging)**

## Common Student Struggles

### Concept: "What makes an agent different from a chatbot?"

**Symptoms**: Students say things like "so it's just a better prompt?" or "can't you do this with ChatGPT?"

**Intervention**: 
- Bring it back to Exercise 1: "Remember when the chatbot claimed to send an email? Did an email actually go out?"
- Draw the distinction: Chatbots *talk about* doing things. Agents *do* things.
- Emphasize tools: The agent has hands (functions it can call). The chatbot only has a mouth.

**Don't**: 
- Get into LLM architecture debates
- Compare different AI models
- Discuss fine-tuning (not relevant here)

### Concept: "Why can't I just modify state in the router?"

**Symptoms**: Students try to do work in `routeByIntent()` instead of just returning a node name.

**Intervention**:
- Explain separation of concerns: The router's only job is to pick the next destination
- Analogy: A traffic light doesn't fix your car - it just tells you where to go
- Show them the error they'll get if they try to return state from a router

**Don't**:
- Just say "that's not how it works" without explaining why
- Let them hack around it with workarounds

### Concept: "My intent classification is wrong sometimes"

**Symptoms**: "Show me leads" gets classified as "unknown" occasionally.

**Intervention**:
- This is expected! LLMs are probabilistic.
- Focus on: Is it correct 80%+ of the time? That's good enough to proceed.
- Show them how to improve prompts with examples (few-shot)
- Remind them: production systems use evaluation and iteration

**Don't**:
- Promise 100% accuracy (it's not achievable)
- Spend too long optimizing prompts (diminishing returns)

### Concept: "Supabase queries aren't returning data"

**Symptoms**: Empty results even though data exists in the database.

**Intervention**:
- Check #1: Did they run the schema SQL? (Most common issue)
- Check #2: Are they using the service role key? (anon key may hit RLS)
- Check #3: Is the filter syntax correct? (`ilike` needs `%` wildcards)
- Debug together: Run the query directly in Supabase SQL editor

**Don't**:
- Immediately give them the answer - guide them through debugging
- Let them stay stuck for more than 5 minutes

## Key Terminology to Emphasize

**Node**: A single step in the workflow. A function that takes state and returns state updates. Like a station on a train line.

**Edge**: A connection between nodes. Defines what happens after a node completes. Like the track between stations.

**Conditional Edge**: An edge where the destination depends on state. Like a train switch that sends you different directions based on conditions.

**State**: The shared memory that all nodes can read from and write to. Like a shared notebook passed between team members.

**Intent**: What we think the user wants to do. Classifying intent is often the first step in an agent.

**Router**: A function that decides which node runs next. It returns a string (node name), not state updates.

## Lecture Structure Changes

**Important:** Lectures 3 and 4 have been combined into a single 30-minute "State and Data" lecture. This achieves the 70/30 hands-on split while maintaining content quality.

**Benefits:**
- More hands-on time for Exercise 4 (now 80 minutes)
- Natural flow: state management → database queries use state
- Reduced cognitive switching between concepts

## Live Coding Suggestions

### During Lecture 2 (LangGraph Mental Model)

Draw the workflow on a whiteboard or shared screen as you explain:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Node A  │ ──> │ Node B  │ ──> │ Node C  │
└─────────┘     └─────────┘     └─────────┘
     │
     └──> State flows through ──>
```

Then show branching:

```
              ┌─────────┐
         ┌──> │ Node B  │ ──┐
┌─────────┐   └─────────┘   │   ┌─────────┐
│ Node A  │                 └─> │ Node D  │
└─────────┘   ┌─────────┐   ┌─> └─────────┘
         └──> │ Node C  │ ──┘
              └─────────┘
```

### During Lecture 3 (State and Data - Combined)

**Part 1 (State):** Use live state examples. Create a simple state object in Cursor, modify it in an imaginary node, show the merge:

```typescript
// Before
{ userMessage: "Hello", intent: null }

// Node returns
{ intent: { type: "lookup" } }

// After merge (show this!)
{ userMessage: "Hello", intent: { type: "lookup" } }
```

**Part 2 (Data):** If you have a Supabase project ready, show a live query in the SQL editor, then show the same query using the JavaScript client. This bridges the gap for students familiar with SQL.

### During Exercise 4

Exercise 4 now has 80 minutes (extended from 75). Use the extra time for:
- More individual debugging
- Live code review of student solutions
- Advanced patterns (joins, complex filters)

If many students are stuck, do a live walkthrough of the Supabase query building:

```typescript
// Start simple
let query = supabase.from("leads").select("*");

// Show them how to add filters progressively
// "What if the user asks for hot leads?"
query = query.gt("score", 80);

// "What if they search by company name?"
query = query.ilike("company_name", "%techcorp%");
```

## Debugging Session Tips (End of Day)

Reserve 30 minutes for group debugging. Ask students to share their screens if they're stuck.

**Common issues to look for**:
1. Missing environment variables (show how to check: `console.log(Deno.env.get("SUPABASE_URL"))`)
2. Typos in node names (addConditionalEdges names must exactly match addNode names)
3. Forgetting to add edges to END (workflow runs forever)
4. JSON parsing errors from Claude (show the extractJsonSafely pattern)

**Turn bugs into teaching moments**: "Great bug! Let's see what's happening here..." Make it safe to share failures.

## Assessment Checkpoints

### After Exercise 1
Quick check: "Raise your hand if you got the chatbot to make up information it couldn't possibly know."
(Should be everyone)

### After Exercise 2
Ask students: "What are the two things your node receives and returns?"
(Answer: Receives full state, returns partial state with updates)

### After Exercise 3
Have 2-3 students explain their routing logic out loud.
Check for understanding of conditional edges.

### After Exercise 4
Final check: "Show me the output when you ask for hot leads."
Should see 2-3 leads with score > 80.

## Safety & Ethics Discussion Points

**Introduce tomorrow's challenges**: End the day by previewing what could go wrong.

"Your agent can now read your database. Tomorrow, we give it the ability to write. What could go wrong?"

- Prompt students to think of failure scenarios
- Write their answers on the board
- Preview human-in-the-loop as the solution

**Discussion questions**:
- "If we let the agent send emails without approval, what's the worst that could happen?"
- "How would you feel if an AI updated your CRM records without telling you?"
- "What should always require human approval?"

## Engagement Boosters

### Exercise 1: Chatbot Roast
Make it fun. Who can get the chatbot to say the most absurd thing? (While keeping it professional)

### Exercise 4: Leaderboard
"First person to get all 5 sample leads showing correctly wins bragging rights!"

### End of Day
Celebrate the progress: "This morning you had a chatbot that made stuff up. Now you have an agent that queries real data. Tomorrow, it writes data AND asks your permission first."

## Technical Accuracy Notes

**LangGraph version**: Examples use `@langchain/langgraph` latest. Verify state channel syntax if students have issues.

**Supabase**: Use `@supabase/supabase-js@2`. The v2 API is significantly different from v1.

**Deno vs Node**: Examples use Deno imports (for Edge Functions). If students test locally with Node, they'll need to adjust imports:
```typescript
// Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Node
import { createClient } from "@supabase/supabase-js";
```

**API Keys**: Make absolutely sure students use SERVICE_ROLE_KEY for the agent, not ANON_KEY. The service role bypasses RLS.

## If You're Running Behind

With the optimized timing, you should stay on track. If you're still behind:

**Cut Exercise 3 stretch goal** (qualify routing) - students will see this pattern tomorrow anyway.

**Trim Lecture 3 Part 1** to 5 minutes if students are already comfortable with state from Exercise 2.

**Skip the "detailed mode" stretch goal** in Exercise 4 - it's nice-to-have.

## If You're Running Ahead

With the extended Exercise 4 time, you're less likely to run ahead. If you still do:

**Preview tomorrow's safety patterns**: Show what human-in-the-loop looks like:
```typescript
if (leadValue > 10000) {
  return { awaitingApproval: true, pendingAction: "update_lead" };
}
```

**Let fast students help slower ones**: Pair programming is valuable and reinforces understanding.

**Advanced Supabase patterns**: Show joins, transactions, or RLS policies if the whole class is ready.
