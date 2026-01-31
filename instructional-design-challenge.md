# Instructional Design Challenge 

Hello there! 👋

If you've made it to this step of the recruiting process, it means we believe you might be a great fit for a **Content Creator** role at Jedha. Congratulations! That's already an achievement.

Now, an important part of your future job will be to **create hands-on, technically sound, and learner-friendly content**. To evaluate your skills in this area, we've designed the following instructional design challenge.

This challenge will help us assess how you structure a learning experience, how you balance practice with theory, and how you guide learners through complex technical concepts using clear and accessible instruction.

## Your Goal

Design a **2-day module** (7 hours per day) teaching learners how to build **autonomous AI agents with LangGraph** that can interact with their Supabase database and external APIs.

By the end of the module, students should be able to **design, build, and deploy a multi-step AI agent** that reasons about user requests, queries their application's database, and takes actions autonomously — all while maintaining human oversight and graceful error handling.

Students will:

* Understand what **AI agents** are and how they differ from simple chatbots or prompt chains
* Learn the **ReAct pattern** (Reasoning + Acting) and why it matters for autonomous systems
* Build a **LangGraph workflow** with multiple nodes, conditional edges, and state management
* Connect their agent to **Supabase** (read/write operations) and at least one **external API**
* Implement **human-in-the-loop checkpoints** for sensitive operations
* Handle **errors gracefully** with retry logic and fallback behaviors
* Deploy the agent as a **backend endpoint** callable from their Lovable frontend

## Project Spec

Here are some specifications to guide you:

* The course should be **70% hands-on / 30% theory** (you can stretch to 50/50 if needed)
* Learners will use **Cursor** as their AI-assisted IDE — leverage this in your pedagogy
* Content must be accessible to **non-engineers** who have completed earlier modules on React basics and Supabase integration
* The focus is on **agent architecture**, **workflow design**, and **safe automation** — not on LLM fine-tuning or model deployment
* Include at least one **realistic business scenario** (e.g., a CRM assistant that qualifies leads, updates records, and sends follow-up emails)
* Emphasize **observability and debugging** — agents fail in unexpected ways, and learners need to understand why

## Audience

Your learners have already:
- Built a React frontend with Lovable
- Connected it to a Supabase database (CRUD operations, authentication, RLS)
- Used basic prompt engineering with Claude or GPT
- Completed intro modules on n8n automation

They've heard about "agents" and "autonomous AI" but have **no practical experience building agentic systems**. They don't know what a "graph" means in this context, and terms like "state," "nodes," and "edges" will be new.

This is their **first agentic AI project**, and your mission is to help them understand how LangGraph orchestrates complex AI behaviors — clearly, safely, and confidently.

## Constraints & Considerations

As you design this module, keep in mind:

1. **Conceptual difficulty**: The leap from "chatbot" to "agent" is significant. How will you scaffold this?
2. **Debugging complexity**: Agents fail silently or loop infinitely. How will you teach troubleshooting?
3. **The "magic" problem**: AI-assisted coding can make things work without understanding. How will you ensure genuine comprehension?
4. **Safety and ethics**: Autonomous systems that write to databases and call APIs carry real risks. How will you address this responsibly?
5. **Tool orchestration**: Learners must juggle Cursor, LangGraph, Supabase, and external APIs simultaneously. How will you manage cognitive load?


## Deliverables

Submit a folder with this structure:

```Instructional-Design-Challenge/
├── Day-01_.../
│   ├── 00-Lectures/
│   │   
│   ├── 01-Exercises/
│   │   
│   └── 03-Instructors/
│       ├── Solutions/
│       └── Teaching_Notes.md
│
├── Day-02_.../
│   ├── 00-Lectures/
│   │   
│   ├── 01-Exercises/
│   │  
│   └── 03-Instructors/
│       ├── Solutions/
│       └── Teaching_Notes.md
```

Use **Markdown** for all materials.

You don't need to build a working application — we're interested in your **instructional clarity**, **technical accuracy**, **structure**, and **ability to make complex ideas accessible and exciting**.

## Evaluation Criteria

We'll assess your submission on:

| Criteria | Weight |
|----------|--------|
| **Technical accuracy** — Are the concepts and code correct? | 25% |
| **Pedagogical structure** — Is there a clear learning progression? | 25% |
| **Accessibility** — Can a non-engineer follow along confidently? | 20% |
| **Hands-on balance** — Is it practice-driven, not lecture-heavy? | 15% |
| **Creativity & engagement** — Does it make learners *want* to build? | 15% |

## Timeline

You have **1 week** to complete this challenge.

If you have any questions about scope, tools, or expectations, don't hesitate to reach out. We're happy to clarify.

We're looking forward to seeing how you teach! 🚀

— The Jedha Content Team
