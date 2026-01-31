# Building Autonomous AI Agents with LangGraph

A 2-day intensive module teaching non-engineers how to build, deploy, and safely operate AI agents that interact with databases and external APIs.

## What You'll Build

By the end of this module, you'll have a working **CRM Assistant Agent** that can:

- Understand natural language requests ("Show me hot leads", "Send a follow-up to Sophie")
- Query your Supabase database for real lead information
- Update lead records (with human approval for high-value leads)
- Send actual emails via Resend (with approval)
- Handle errors gracefully with retry logic
- Run as a deployed Edge Function your frontend can call

This isn't a toy demo. It's production-ready code with real safety guardrails.

## Prerequisites

Before starting this module, you should be comfortable with:

- **React basics** — You've built UIs with components, state, and props
- **Supabase fundamentals** — You've done CRUD operations, authentication, and understand RLS
- **Basic prompt engineering** — You've used Claude or ChatGPT for more than chat
- **n8n or similar automation** — You understand the concept of workflows and triggers

You **don't need** prior experience with:
- AI agents or agentic systems
- LangGraph or LangChain
- Graph theory or state machines
- Backend deployment

We'll teach you everything else.

## Module Structure

### Day 1: From Chatbot to Agent (7 hours)

**Theme**: Understanding the mental model shift and building your first working agent.

| Session | Type | Topic | Duration |
|---------|------|-------|----------|
| 1 | Lecture | What's an Agent, Really? | 20 min |
| 2 | Exercise | Break a Chatbot (Intentionally) | 45 min |
| 3 | Lecture | The LangGraph Mental Model | 20 min |
| 4 | Exercise | Your First Node | 60 min |
| 5 | Lecture | State & Data (combined) | 30 min |
| 6 | Exercise | Multi-Node Flow | 60 min |
| 7 | Exercise | Query Your Leads | 80 min |
| 8 | Wrap-up | Debug Session + Q&A | 30 min |

**Optimized for 73% hands-on learning** (305 minutes of exercises + debugging out of 420 total)

**Day 1 Outcome**: An agent that understands requests, routes intelligently, and queries real database data.

### Day 2: Making It Production-Ready (7 hours)

**Theme**: From "it works on my machine" to "I'd trust this in production."

| Session | Type | Topic |
|---------|------|-------|
| 1 | Lecture | When Agents Go Wrong |
| 2 | Exercise | The Infinite Loop Challenge |
| 3 | Lecture | Human-in-the-Loop |
| 4 | Exercise | Add Approval Gate |
| 5 | Lecture | Error Handling That Works |
| 6 | Exercise | Make It Resilient |
| 7 | Lecture | Deploy to the Edge |
| 8 | Exercise | Ship It |
| 9 | Capstone | Polish & Demo |

**Day 2 Outcome**: A deployed agent with human approval flows, error handling, email integration, and production observability.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Primary language (aligns with React/Lovable) |
| **LangGraph** | Agent orchestration (nodes, edges, state) |
| **Supabase** | Database (PostgreSQL) + Edge Functions |
| **Claude 3.5 Sonnet** | LLM for intent classification and reasoning |
| **Resend** | Email sending API |
| **Cursor** | AI-assisted IDE |

## Setup Instructions

### 1. Clone and Install

```bash
# Clone the module materials
git clone <repository-url>
cd Instructional-Design-Challenge

# If you're using the starter kit
cd starter-kit
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `starter-kit/supabase-schema.sql`
3. Copy your project URL and keys from Project Settings > API

### 3. Configure Environment

Copy the environment template:

```bash
cp starter-kit/.env.example .env
```

Fill in your values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...  # Optional for Day 2
```

### 4. Verify Setup

Run the Day 1 Exercise 4 solution to verify everything works:

```bash
deno run --allow-env --allow-net Day-01_From-Chatbot-to-Agent/03-Instructors/Solutions/exercise-04-solution.ts
```

You should see lead data from your database.

## Folder Structure

```
Instructional-Design-Challenge/
├── README.md                          # This file
├── starter-kit/
│   ├── supabase-schema.sql           # Database setup
│   ├── .env.example                  # Environment template
│   └── edge-function-scaffold/       # Starter code
│       ├── index.ts
│       └── types.ts
│
├── Day-01_From-Chatbot-to-Agent/
│   ├── 00-Lectures/
│   │   ├── 01-What-Is-An-Agent.md
│   │   ├── 02-LangGraph-Mental-Model.md
│   │   ├── 03-State-Is-Everything.md
│   │   └── 04-Talking-To-Supabase.md
│   ├── 01-Exercises/
│   │   ├── 01-Break-A-Chatbot.md
│   │   ├── 02-Your-First-Node.md
│   │   ├── 03-Multi-Node-Flow.md
│   │   └── 04-Query-Your-Leads.md
│   └── 03-Instructors/
│       ├── Solutions/
│       │   └── [4 TypeScript files]
│       └── Teaching_Notes.md
│
└── Day-02_Production-Ready/
    ├── 00-Lectures/
    │   ├── 01-When-Agents-Go-Wrong.md
    │   ├── 02-Human-In-The-Loop.md
    │   ├── 03-Error-Handling-That-Works.md
    │   └── 04-Deploy-To-The-Edge.md
    ├── 01-Exercises/
    │   ├── 01-Infinite-Loop-Challenge.md
    │   ├── 02-Add-Approval-Gate.md
    │   ├── 03-Make-It-Resilient.md
    │   └── 04-Ship-It.md
    └── 03-Instructors/
        ├── Solutions/
        │   └── [4 TypeScript files]
        └── Teaching_Notes.md
```

## For Instructors

Each day's `03-Instructors` folder contains:

- **Solutions/**: Complete, working code for all exercises with comments explaining key decisions
- **Teaching_Notes.md**: Timing guides, common struggles, intervention strategies, and discussion prompts

Read the Teaching Notes before each day. They'll help you anticipate where students get stuck.

## Learning Philosophy

This module follows Jedha's **practice-driven** approach:

- **70% hands-on, 30% theory** — You learn by building, not by watching
- **Progressive complexity** — Each exercise builds on the last
- **Real business context** — You're building a CRM assistant, not a toy
- **Safe failure** — Exercises include intentional bugs to debug
- **AI-assisted** — Cursor is part of the workflow, not cheating

We believe the best way to understand agents is to build one, break it, fix it, and deploy it.

## Troubleshooting

### "Module not found" errors

Make sure you're using Deno-compatible imports:

```typescript
// Good (Deno)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Bad (Node)
import { createClient } from "@supabase/supabase-js";
```

### "CORS error" when calling Edge Function

Check that your Edge Function handles OPTIONS requests:

```typescript
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}
```

### Agent loops forever

Check your router's termination conditions. Every path must eventually reach `END`.

### Email not sending

1. Verify `RESEND_API_KEY` is set
2. Check the "from" address is verified in Resend
3. Look at Resend dashboard for error details

## Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Anthropic API Reference](https://docs.anthropic.com/)
- [Resend Documentation](https://resend.com/docs)

## Support

If you get stuck during the module:

1. Check the exercise's "Debugging Tips" section
2. Ask your instructor
3. Use Cursor AI to help diagnose issues (but understand the fix before moving on!)

Remember: Getting stuck is part of learning. The struggle is where the understanding comes from.

---

**Good luck! Go build something amazing.**
