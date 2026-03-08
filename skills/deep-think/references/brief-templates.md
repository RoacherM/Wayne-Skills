# Brief Templates

The brief is the single most important thing you produce. The model's output quality depends entirely on what you feed it. A good brief is **information-dense and structured** — write it as a document the model can think about, not a vague request.

**Bad brief**: "Design a notification system" (too vague)
**Good brief**: Describes the domain, constraints, what's already built, specific tensions to resolve

## Design Brief Template

Use when the user has a new idea that needs architectural thinking.

```
## System Purpose
[One paragraph: what this system does and why it needs to exist]

## Constraints
- Technical: [languages, infra, latency requirements, scale]
- Organizational: [team size, timeline, existing systems to integrate]
- Resource: [budget, compute, storage limits]

## Locked Decisions
[Things already decided that the model should not redesign]

## Open Questions
[Specific architectural questions — not "how should I build this?" but
 "should X be sync or async given Y constraint?" or
 "is a separate service justified for Z or should it be a library?"]

## Evidence (from code/docs — verified facts)
[Things you confirmed by reading actual code/config/docs.
 Prefix each with source: "auth.py:42 — sessions stored in Redis"
 "docker-compose.yml — single Postgres instance, no read replicas"]

## Assumptions (your inferences — may be wrong)
[Things you inferred but didn't verify directly.
 "Likely single-tenant based on no tenant_id in schema"
 "Appears to be ~1K RPM based on rate limiter config, but no load test data"]

## Context
[Relevant code snippets, API shapes, data models — only what's needed
 to reason about the architecture, not full file dumps]
```

## Review Brief Template

Use when the user has an existing design or codebase to critique. Before writing the brief, screen across the 5 layers and form your own hypotheses about where the design is weak — this makes the brief much better because you can ask targeted questions.

```
## System Overview
[What the system does, its core data model, main flows]

## Architecture Snapshot
[Key components, how they connect, deployment topology]

## Evidence (from code/docs — verified facts)
[Things you confirmed by reading actual code/config/docs.
 Prefix each with source: "auth.py:42 — sessions stored in Redis"
 "schema.sql:15 — no tenant_id column anywhere"]

## Assumptions (your inferences — may be wrong)
[Things you inferred but didn't verify directly.
 "Likely ~1K RPM based on rate limiter, but no load test data"
 "Appears to use eventual consistency, but no explicit documentation"]

## Suspected Weaknesses
[Your hypotheses, framed as questions for the model:
 "The auth service stores sessions in memory — does this break under X?"
 "The event system has no dead-letter queue — what happens when Y fails?"]

## Code Snippets
[Minimal snippets that illustrate the architectural patterns in question.
 Do NOT paste entire files — extract the 10-20 lines that matter.]
```

Frame questions around the 5 layers, not around files. "Is the Why solid?" not "Is auth.py correct?"
