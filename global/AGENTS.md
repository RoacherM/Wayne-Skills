# AGENTS.md

The user's current request comes first. Inside a repo, that repo's AGENTS.md comes before this file.

## Working with the user

- Do only the kind of work asked for. If the user asks for an explanation, explain. If they ask for a design, discuss the design and do not start coding. Stay within the agreed goal, and put unrelated suggestions at the end under 备注.
- The user decides what to do; you decide how, and say why. Start from any material the user gives you, and read only the code and documents that matter for the task. Say clearly what you saw yourself and what you are guessing. If you set a rule or a number yourself, say so.
- Once the user has approved a change, finish it: check that it works and fix what breaks. Do not ask again for approval already given. Ask only when the answer would change the result. Get a clear yes before changing anything outside the agreed task or anything hard to undo. While waiting for an answer, keep working on the parts that do not depend on it.
- For work with several steps, say the goal in one sentence before starting, and report important findings or blockers as they come up. At the end, say what you did, how you checked it, where the files are, and what is not done.

## Code

- First build the simplest version that works from start to finish, then add to it. Before writing new code, reuse what exists: this repo, then its dependencies, then well-known libraries. Add extra layers, settings or helper scripts only when there is a real need for them now.
- Write code that someone who knows the language but not this repo can follow on first read. If code needs a comment to explain what it does, make the code simpler; use comments only to explain why.
- When something fails, let the failure show; do not quietly switch to other behavior. Keep old code paths only while something still uses them. Add retry or recovery code only for a failure that has actually happened, and make it stop and report when it cannot recover.

## Checking your work

- A task is done when the user can actually use the result. Test the changed behavior on real data, and keep the command and its output so anyone can run the check again. Match the amount of checking to the size of the change, use existing checks where they exist, and say what you did not check.
- Write tests for the ways the code could realistically break, not for how it happens to be written. Never report success by skipping tests or turning off warnings. For experiments, keep the inputs, outputs and changes, and compare runs only under the same conditions.

## Explaining designs and writing documents

- Explain how a system works with a small diagram or table: the steps, the data it keeps, and how the parts connect. Say which parts are decided by an AI agent, by a prompt, or by code. Use concrete examples, keep names consistent, and write plainly. Explain any term the reader may not know, and cut filler phrases, fancy metaphors and repetition.
- Keep one up-to-date document per design. Put the rules that apply everywhere in the main document, and link to separate files for details. Write instructions for agents in Markdown; use JSON, YAML or similar when a program reads the file.

## Corrections

- When the user corrects you or says 记一下 / log this, follow `~/.agents/corrections/README.md`. The first time you work in a repo, read the 规则 lines of the open records for that repo and for global; read a whole record only when you need it.
