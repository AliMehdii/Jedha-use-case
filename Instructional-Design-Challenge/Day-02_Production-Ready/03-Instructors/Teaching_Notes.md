# Day 2 Teaching Notes: Making It Production-Ready

## Overview

**Theme**: From "it works on my machine" to "I'd trust this in production."

**Key Learning Objectives**:
1. Students understand how agents fail and how to prevent common failure modes
2. Students can implement human-in-the-loop approval flows
3. Students can add retry logic and graceful error handling
4. Students can deploy their agent to Supabase Edge Functions

**End of Day Deliverable**: A deployed, production-ready CRM agent with approval flows, error handling, and email integration.

## Leveraging Cursor AI in Instruction

### Philosophy
Students are using Cursor as their AI-assisted IDE. This is a feature, not a bug. Teach them to use it effectively:

**Encourage**:
- Asking Cursor to explain concepts in simpler terms
- Using Cursor to check their understanding ("Is this code doing what I think?")
- Asking "why" questions, not just "how"

**Discourage**:
- Blindly accepting Cursor's suggestions without understanding
- Using Cursor to skip the learning (copying full solutions)
- Relying on Cursor instead of reading error messages

### When Students Get Stuck

**Before** immediately helping:
1. Ask: "What does Cursor suggest if you ask it: [relevant question]?"
2. Let them try Cursor's suggestion
3. Then ask: "Does this make sense? Can you explain why it works?"

This teaches them to:
- Debug independently
- Think critically about AI suggestions
- Build genuine understanding

### Discussion Prompts

**Mid-Exercise 1**:
"Raise your hand if Cursor helped you find a bug. What did it suggest? Was it right?"

**Mid-Exercise 3**:
"Some of you got retry logic working. Did Cursor help? How did you verify it was correct?"

**During Capstone**:
"Let's talk about AI-assisted coding: When was Cursor helpful? When did it mislead you? What did you learn about working with AI tools?"

### Red Flags (When to Intervene)

If you notice students:
- Having identical code (everyone copied Cursor's suggestion)
- Unable to explain their own code
- Frustrated because "Cursor's code doesn't work"

**Intervention**: Pause the class. Discuss how to evaluate AI suggestions. Show examples of asking Cursor follow-up questions.

## Timing Guide

| Time | Activity | Notes |
|------|----------|-------|
| 0:00-0:20 | **Lecture 1**: When Agents Go Wrong | Set the stakes - this is serious |
| 0:20-1:05 | **Exercise 1**: Infinite Loop Challenge | Debugging is a skill |
| 1:05-1:20 | Break | |
| 1:20-1:40 | **Lecture 2**: Human-in-the-Loop | The approval pattern |
| 1:40-2:40 | **Exercise 2**: Add Approval Gate | Core safety mechanism |
| 2:40-2:55 | Break | |
| 2:55-3:15 | **Lecture 3**: Error Handling | Retry, backoff, recovery |
| 3:15-4:15 | **Exercise 3**: Make It Resilient | Real-world robustness |
| 4:15-4:30 | Break | |
| 4:30-4:50 | **Lecture 4**: Deploy to the Edge | Supabase Edge Functions |
| 4:50-5:50 | **Exercise 4**: Ship It | Deploy and test |
| 5:50-6:05 | Break | |
| 6:05-7:00 | **Capstone**: Polish & Demo | Celebrate the achievement |

## If Students Are Behind After Day-01

Some students may struggle with Day-01 concepts. Don't let this prevent them from learning Day-02 material.

**Solution**: Provide `Solutions/day-01-complete-starter.ts` at the start of Day-02.

**When to offer it**:
- Student's Day-01 code isn't working after 10 minutes of debugging
- Student missed Day-01 entirely
- Student is getting discouraged and needs a fresh start

**Script**: 
> "Yesterday we built the foundation. Today we're making it production-ready. If you had trouble with Day-01, that's okay — use the starter code so you can focus on today's concepts. You can always revisit Day-01 implementation details later. Today is about approval flows, error handling, and deployment."

**Important**: Frame this as "different learning paths" not "falling behind." Some students learn better by seeing a complete working example first, then understanding the pieces. That's valid.

## Common Student Struggles

### Concept: "Why does the agent loop forever?"

**Symptoms**: Students can see the loop but don't understand WHY it happens.

**Intervention**:
- Draw the state machine on the board
- Trace through with specific state values
- Ask: "What value would need to change to exit the loop?"
- Point out: The router checks condition X, but no node ever changes X

**Don't**:
- Just tell them to "add a counter" without explaining the underlying issue
- Let them copy the solution without understanding

### Concept: "When should I require approval?"

**Symptoms**: Students either want approval for everything or nothing.

**Intervention**:
- Use the risk matrix: reversibility × impact
- Ask: "If this action goes wrong, can we undo it? How bad is it?"
- Rule of thumb: External effects (emails, payments) always need approval
- Start strict, loosen over time as you build trust in the system

**Don't**:
- Give them a fixed list of "approve these, don't approve those"
- Ignore the nuance (context matters)

### Concept: "How do I know if retry is working?"

**Symptoms**: Students add retry but can't tell if it's actually retrying.

**Intervention**:
- Add explicit logging: `console.log(\`Attempt ${attempt}/${max}\`)`
- Simulate failure: temporarily use wrong API URL
- Check timing: if it returns immediately, retries aren't happening

**Don't**:
- Let them assume it works without testing failure cases

### Concept: "My deployment fails with no error message"

**Symptoms**: `supabase functions deploy` fails silently or with cryptic errors.

**Intervention**:
- Common cause 1: Deno import issues (use esm.sh URLs)
- Common cause 2: Missing secrets (run `supabase secrets list`)
- Common cause 3: Syntax error (run `deno check` locally first)
- Check logs: `supabase functions logs crm-agent`

**Don't**:
- Debug deployment issues without checking logs first

## Key Terminology to Emphasize

**Infinite Loop**: When an agent keeps executing the same steps without terminating. Usually caused by conditions that never become false.

**Circuit Breaker**: A pattern that stops trying after repeated failures. Prevents cascading failures and runaway costs.

**Exponential Backoff**: Waiting progressively longer between retries (1s, 2s, 4s, 8s...). Gives systems time to recover.

**Human-in-the-Loop (HITL)**: Pausing automated actions for human review. Essential for high-stakes operations.

**Graceful Degradation**: Continuing to provide partial functionality when something fails, rather than crashing entirely.

**Edge Function**: Serverless code that runs close to users on edge servers. Fast cold starts, global distribution.

## Live Coding Suggestions

### During Lecture 1 (When Agents Go Wrong)

Show a real-time infinite loop (but be ready to kill it):

```typescript
// "Watch what happens when I run this..."
// Kill after 5-10 iterations
```

Students seeing the rapid-fire console output is more impactful than just describing it.

### During Lecture 3 (Error Handling)

Live code the retry logic from scratch:

```typescript
// Start with naive approach
try {
  await riskyThing();
} catch (e) {
  console.log("failed"); // ← "This is useless"
}

// Build up to proper retry
// Show exponential backoff math
// Demonstrate jitter importance
```

### During Exercise 4

Do a live deployment together if many students are stuck:

```bash
# Walk through each step
supabase login
supabase link
supabase secrets set ...
supabase functions deploy crm-agent
```

## Debugging Session Tips

### Exercise 1 Common Bugs

1. **Router returns wrong string**: Check exact spelling matches `addConditionalEdges` keys
2. **State not updating**: Check if return statement includes the field
3. **Attempt counter not incrementing**: Make sure you're returning `attempts: state.attempts + 1`

### Exercise 2 Common Bugs

1. **Approval always skipped**: Check `needsApproval()` logic and lead score data
2. **Pending action not cleared**: Make sure to set `pendingAction: null` after execution
3. **Wrong routing after review**: Verify `approvalStatus` values match routing conditions

### Exercise 3 Common Bugs

1. **Resend errors**: Usually API key issue or unverified "from" address
2. **Retry not working**: Check if error has proper status code for shouldRetry logic
3. **Email goes to wrong person**: Double-check lead email is being used, not hardcoded

### Exercise 4 Common Bugs

1. **CORS errors**: Missing OPTIONS handler or corsHeaders on error responses
2. **500 errors with no details**: Check Edge Function logs in Supabase dashboard
3. **Works locally, fails deployed**: Environment variables not set in production

## Assessment Checkpoints

### After Exercise 1
Ask: "What are three ways to prevent infinite loops in agents?"
(Max attempts, checking for response, clearing loop conditions)

### After Exercise 2
Ask students to trace through: "What happens when I say 'Mark GlobalRetail as won'?"
(Understand → Update → Check score (92) → Need approval → Review → Execute)

### After Exercise 3
Ask: "If Resend is down, what does your user see?"
(Should be a friendly error message, not a crash)

### After Exercise 4
Have students demo their deployed agent via curl or frontend.

## Safety & Ethics Discussion Points

**During Exercise 2 (Approval Gate)**:

"This is where ethics becomes code. You're encoding company policy directly into the system."

Discussion prompts:
- "What if someone asks you to remove the approval requirement for 'efficiency'?"
- "How would you audit what the agent has done over time?"
- "What's the right balance between automation and oversight?"

**During Exercise 3 (Email Integration)**:

"You just gave your agent the ability to contact real people. That's powerful and dangerous."

Discussion prompts:
- "What if the agent sends an embarrassing email? Who's responsible?"
- "How would you handle someone asking to be removed from agent emails?"
- "What legal requirements might apply? (GDPR, CAN-SPAM)"

## Engagement Boosters

### Exercise 1: Bug Hunt Competition
First person to fix all bugs wins. Creates energy and urgency.

### Exercise 3: Show Real Emails
If possible, set up a test email that actually arrives. Seeing "Email sent!" AND receiving it is magical.

### Capstone: Demo Gallery
Last 30 minutes: students show off their agents. Encourage creative scenarios beyond the CRM basics.

## Technical Accuracy Notes

**LangGraph version**: Use stable CDN URLs (esm.sh). Version lock if possible.

**Supabase Edge Functions**: Runs on Deno Deploy. Some Node APIs don't work. Use Deno-compatible libraries.

**Resend free tier**: 100 emails/day. Enough for testing but watch for rate limits.

**Anthropic API**: Claude 3.5 Sonnet is the recommended model. Handle rate limits (429 errors).

## If You're Running Behind

**Exercise 1**: Can be shortened by providing more of the fixed code and focusing on understanding rather than writing.

**Exercise 3**: Resend integration can be mocked (`{ success: true, messageId: "mock-123" }`) if API setup takes too long.

**Exercise 4**: If deployment issues are consuming too much time, do a single instructor-led deployment and have students follow along.

## If You're Running Ahead

**Add monitoring**: Show how to add basic telemetry (count requests, track latency).

**Multi-turn conversation**: Challenge students to add memory so the agent remembers previous messages in a session.

**Advanced routing**: Add a "triage" step that handles ambiguous requests by asking clarifying questions.

## End-of-Module Celebration

This is a significant achievement. In two days, students went from "what's an agent?" to deployed production code with:
- Natural language understanding
- Database integration
- Human oversight
- Error resilience
- External API integration
- Cloud deployment

Make sure to acknowledge this. It's real. It's production-grade. It's impressive.

Suggested closing:
"Two days ago, you'd never built an agent. Now you have one deployed, talking to a real database, sending real emails, and asking for your approval before doing anything risky. That's not a tutorial project. That's a foundation you can build real products on. Go build something amazing."
