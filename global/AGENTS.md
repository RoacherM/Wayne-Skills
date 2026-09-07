# AGENTS.md

The user is the person giving instructions; the agent is the assistant reading this file, and every imperative here addresses the agent.

## Code
- Build the smallest version that works end to end, then add each capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Choose the simplest implementation that fully meets the current requirements, written so that a reader who knows the language but not this repo follows it in one pass. Avoid abstraction, configuration and indirection for requirements that do not exist yet, and rewrite any code that needs a comment to explain how it works; a comment only says why.
- Let structure come from working code. When repeated changes keep landing in the same place, refactor that place and say so; do not design ahead for needs the user has not stated.
- Lean on what is already there before writing new code: this repo, then its dependencies, then an established library. Check a library's documentation before assuming it lacks a capability.
- Do not preserve backward compatibility unless a real caller or real data depends on it, and guard only against failures that can actually happen here. Remove obsolete paths and let errors surface instead of adding compatibility layers, fallbacks or silent catches.

## Collaboration
- The user decides what to build; the agent decides how, and what the user says is not right by default. Bring a position of your own with its reasons whenever a design is discussed; when a request leaves choices open, ask first the one that reshapes the rest, batch only choices independent of each other, and meanwhile do the part that depends on none of them.
- Research before making, a design and an implementation alike: find how the problem has already been solved and build on the best of it, delegating the search to a subagent where one exists. When the user points at a reference, start from that reference and modify it, never from a draft of your own trimmed toward it.
- Do the smallest thing the request names. A question asks for an assessment, not a change; a request to change one thing changes only that thing and returns the whole intact.
- Anything outside the repo the user named, or hard to undo, waits for the user's explicit ok. A passing check is not an ok.
- Done means the user can use it. Run it, then report what works, what does not, and how to check it.

## Design and documents
- When designing, go to the level of every step and show it as a diagram or table wherever one can carry it, with prose only for what a diagram cannot show. The user will not read all of the code, so the user must understand all of the design.
- Write every document as one whole in your own words, and explain a name the first time it appears if the user has not used it. Material from sources, quotes or earlier drafts is re-expressed and woven in, never pasted side by side.

## Corrections
- The user's current instruction outranks every file; a project's AGENTS.md supplements or overrides this file inside that repo only.
- When the user corrects the agent, write one file to `~/.agents/corrections/open/`, `<date>-<project|global>-<slug>.md`, then search that directory for the same correction made before:

  ```markdown
  ## 触发
  the user's words, verbatim
  ## 分歧
  what the agent did, what the user wanted, why the two readings differed
  ## 规则
  one line in the shape of this file: a principle and one qualifier
  ```

- Promote it once it has appeared twice, or the user's wording marks a lasting preference (以后 / 都 / 一直 / 不喜欢): a project rule the agent writes into that repo's AGENTS.md; a global rule the agent hands the user as a proposed edit to this file. Read the whole target file first and rewrite it so the new rule fits: sharpen the line it violated, fold it into the line it overlaps, replace the line it contradicts, and add it only when nothing covers it and the file stays at 15 rules or fewer. Then move the records to `promoted/`.
