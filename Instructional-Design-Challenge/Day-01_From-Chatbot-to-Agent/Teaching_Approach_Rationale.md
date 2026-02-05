# Day 1 Teaching Approach & Rationale

## Quick Overview

**What we're teaching:** How to build AI agents (not chatbots) using LangGraph and Supabase  
**Who we're teaching:** Non-engineers with basic React/Supabase experience  
**Time:** 7 hours  
**End goal:** Students build a working agent that queries real database data

---

## The Big Problem We're Solving

**Students already know chatbots.** They've used ChatGPT, they've written prompts. But they don't understand *why* agents are different or *when* you need them instead of a simple prompt.

So Day 1 is all about **creating that "aha" moment** where they genuinely understand: agents aren't just "better prompts" — they're fundamentally different tools.

---

## Teaching Philosophy

### 1. **Experience First, Then Explain**

Instead of starting with "here's what an agent is," we start with "here's where chatbots fail."

- **Exercise 1:** Students intentionally break a chatbot by asking it to do things (send emails, update databases)
- The chatbot *claims* to do things but nothing actually happens
- Students viscerally feel the limitation before we give them the solution

**Why this works:** Adults learn best when they see *why* new knowledge matters. If we told them "agents use tools," they'd nod and forget. By making them break a chatbot first, they understand the problem we're solving.

### 2. **70% Hands-On, 30% Theory**

Jedha's evaluation criteria heavily weight hands-on practice. Our timing breakdown:

| Activity Type | Time | Percentage |
|--------------|------|------------|
| Exercises | 285 min | 68% |
| Lectures | 70 min | 17% |
| Breaks | 45 min | 11% |
| Wrap-up/Debug | 20 min | 5% |

**Lectures are short and focused** — just enough to understand the next exercise. We don't teach everything upfront; we introduce concepts right before students need them.

### 3. **Scaffold the Complexity**

We build up gradually:

1. **Exercise 1:** No LangGraph yet. Just experience the problem.
2. **Exercise 2:** One single node. That's it. Learn the pattern.
3. **Exercise 3:** Multiple nodes with routing. Add complexity.
4. **Exercise 4:** Real database queries. Now it's actually useful.

Each step adds *one* new concept. We never throw everything at them at once.

---

## The Four Core Concepts (and How We Teach Each)

### Concept 1: **Agents vs Chatbots**

**The mental model shift:** Chatbots talk. Agents do.

**How we teach it:**
- **Lecture 1 (20 min):** Set up the distinction with concrete examples and a comparison table
- **Exercise 1 (45 min):** Students break a chatbot by asking it to do real actions
- **Key insight:** When the chatbot says "I'll send that email!" but nothing happens, students understand why we need something more

**What students say when they get it:** "Oh, so the agent actually *calls* the database instead of just pretending to know the data."

### Concept 2: **Nodes, Edges, and State (LangGraph Basics)**

**The mental model shift:** Workflows are explicit graphs, not hidden in prompts.

**How we teach it:**
- **Lecture 2 (20 min):** Visual diagrams showing nodes (boxes) connected by edges (arrows)
- **Exercise 2 (60 min):** Build one single node that takes state and returns state
- **Key insight:** Each node is just a function. State flows through like a shared notebook.

**What students say when they get it:** "So each node is like one step in a recipe, and state is the ingredients we're working with."

### Concept 3: **Routing and Conditional Logic**

**The mental model shift:** The *workflow* decides what happens next, not just the LLM.

**How we teach it:**
- **Lecture 3 Part 1 (15 min):** Show how conditional edges create different paths
- **Exercise 3 (60 min):** Build a router that sends different requests to different nodes
- **Key insight:** Business rules go in the workflow structure, not buried in prompts

**What students say when they get it:** "Oh, so I'm building a flowchart where the LLM helps with decisions, but *I* control the overall flow."

### Concept 4: **Connecting to Real Data**

**The mental model shift:** Agents query databases; they don't guess.

**How we teach it:**
- **Lecture 3 Part 2 (15 min):** Show Supabase queries and how state carries the results
- **Exercise 4 (80 min):** Write nodes that actually query their Supabase database
- **Key insight:** This is where it becomes genuinely useful — no more hallucinated data

**What students say when they get it:** "Wait, it's pulling my *actual* leads? That's incredible."

---

## Why This Structure Works

### 1. **Non-Engineers Can Follow**

- We use **everyday analogies**: train stations (nodes), tracks (edges), shared notebooks (state)
- We avoid jargon where possible
- We explain technical terms when we introduce them, not after
- Cursor AI helps them with syntax — they focus on concepts

### 2. **It's Realistic**

- By end of day, they have a working CRM assistant (not a toy example)
- They're querying a real database they set up
- It solves an actual business problem (managing leads)

### 3. **Safety Is Built In**

- Day 1 is **read-only** — the agent can only query, not modify
- We preview risks at the end of the day
- Tomorrow (Day 2) we add writes *with* human approval gates
- This teaches responsible AI development, not just fast AI development

### 4. **Debugging Is Explicit**

- We reserve 30 minutes at the end for group debugging
- Common errors are addressed proactively in teaching notes
- Students learn that agents fail in specific, diagnosable ways (unlike prompt-only systems that just "don't work")

---

## Key Pedagogical Decisions

### Decision 1: Why Start With Breaking a Chatbot?

**Alternative we rejected:** Start with "here's what an agent is" lecture.

**Why we chose this:** 
- Adults need motivation before information
- Experiencing the problem makes the solution meaningful
- It's more engaging and memorable than lecture-first
- Takes only 45 minutes but creates the conceptual foundation for the whole course

### Decision 2: Why LangGraph Instead of Pure Prompts?

**Alternative we rejected:** Teach prompt engineering patterns (ReAct in text).

**Why we chose LangGraph:**
- **Reliability:** Explicit workflows don't skip steps
- **Debuggability:** You can see exactly where it failed
- **Modularity:** Each node is testable in isolation
- **Safety:** You control what can happen when
- **Industry relevance:** This is how production agents are built

**Trade-off:** More initial complexity. But the payoff is worth it for a 2-day course.

### Decision 3: Why Combine State and Supabase Into One Lecture?

**Alternative we rejected:** Two separate 20-minute lectures.

**Why we combined them:**
- State management naturally leads into "what do we put in state? Database results!"
- Students don't need a break between related concepts
- Saves 10 minutes for longer hands-on Exercise 4
- Reduces cognitive switching

### Decision 4: Why Save Writes and Safety for Day 2?

**Alternative we rejected:** Teach everything in one day.

**Why we split it:**
- **Cognitive load:** Adding writes + approval gates + error handling would overwhelm Day 1
- **Safety:** We want students comfortable with reads before they can do damage
- **Clear milestone:** Day 1 ends with "it works!" Day 2 adds "it's safe and production-ready"
- **Natural narrative:** Build → then secure

---

## How I'd Explain This to My Manager

**"Tell me about your Day 1 design."**

> "Day 1 is about building the right mental model. Non-engineers think AI agents are just chatbots with better prompts, so we start by proving that's wrong — they break a chatbot in Exercise 1 and see exactly where it fails. Then we introduce LangGraph piece by piece: first one node, then multiple nodes, then routing, then real database queries. By the end of the day, they have a working CRM assistant that queries actual lead data. It's 70% hands-on practice, and everything builds toward a real business use case."

**"Why not just teach prompt engineering instead of LangGraph?"**

> "Prompt engineering works for simple tasks, but agents need reliability and safety. LangGraph gives students explicit control over what happens and when. They can debug it when it breaks, they can add approval gates tomorrow, and they learn patterns that scale to production. It's more upfront complexity, but it teaches responsible AI development, not just fast AI hacking."

**"How do you make this accessible to non-engineers?"**

> "Three ways: First, we use everyday analogies — nodes are train stations, state is a shared notebook. Second, we scaffold carefully — each exercise adds just one new concept. Third, we leverage Cursor AI to handle syntax help, so students can focus on understanding concepts instead of memorizing code. The teaching notes flag every common struggle and how to address it."

**"What if students finish early or fall behind?"**

> "We've built in flex time. Exercise 4 is 80 minutes with optional stretch goals — fast students can tackle advanced queries or help slower peers. If the whole class is ahead, we preview tomorrow's safety patterns. If they're behind, we can trim stretch goals in Exercise 3 or shorten Lecture 3. The 30-minute debug session at the end is also adjustable."

**"How do you know it works?"**

> "We have clear checkpoints after each exercise. After Exercise 1, everyone should have seen the chatbot hallucinate. After Exercise 2, students should be able to explain what a node receives and returns. After Exercise 4, they should show me real leads from their database. If those checkpoints fail, we pause and debug together before moving on."

---

## Success Criteria

By end of Day 1, students should be able to:

✅ Explain the difference between agents and chatbots (not just define it, but *explain why* it matters)  
✅ Create LangGraph nodes that take state and return state updates  
✅ Wire multiple nodes together with conditional routing  
✅ Query a Supabase database from their agent  
✅ Debug common issues (missing edges, typos in node names, empty query results)  

**Most importantly:** They should be *excited* to come back for Day 2. Day 1 proves agents are powerful. Day 2 teaches how to make them safe.

---

## Risks and Mitigations

### Risk 1: "I'm Not a Coder" Anxiety

**Mitigation:**
- Exercise 1 has full code provided (just run and observe)
- Exercises 2-4 provide starter templates
- Cursor AI helps with syntax
- Pair programming is encouraged
- Instructor live-codes challenging parts

### Risk 2: Supabase Setup Issues

**Mitigation:**
- Starter kit includes complete schema SQL
- .env.example shows exactly what variables are needed
- Teaching notes list the top 3 Supabase debugging steps
- We test queries in Supabase UI first, then in code

### Risk 3: "Why Not Just Use ChatGPT?" Pushback

**Mitigation:**
- Exercise 1 directly answers this (ChatGPT can't query your database)
- We acknowledge prompts are great for simple cases
- We show when LangGraph is overkill vs. necessary
- We emphasize production needs (reliability, debugging, safety)

### Risk 4: Running Out of Time

**Mitigation:**
- 45 minutes of breaks can be compressed if needed
- Stretch goals are clearly marked as optional
- Lecture 3 can be trimmed if students grasp state quickly
- End-of-day debug session is valuable but flexible

---

## What Makes This Approach Strong

1. **Clear learning progression:** Break → Build → Connect → Query
2. **Realistic outcome:** Working CRM assistant, not a toy demo
3. **Safety-first mindset:** Read-only on Day 1, writes with approval on Day 2
4. **Non-engineer friendly:** Analogies, scaffolding, AI-assisted coding
5. **High hands-on ratio:** 70%+ practical work
6. **Explicit debugging:** We teach troubleshooting, not just happy paths

---

## Final Thoughts

This design prioritizes **understanding over coverage**. We could teach more features, more tools, more complexity. But students who deeply understand nodes, state, and routing can learn the rest independently. Students who skim the surface will struggle as soon as something breaks.

Day 1 is about building confidence through competence: *"I understand how this works, and I can debug it when it doesn't."*

That's the foundation everything else builds on.
