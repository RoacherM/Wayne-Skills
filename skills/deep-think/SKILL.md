---
name: deep-think
description: First-principles architecture thinking using GPT-5.x via OpenRouter. Two modes — "design" generates a system scheme from scratch, "review" critiques an existing design. Use when the user says "deep think", "deep design", "deep review", "/deep-think", "help me design", "review my architecture", or has a system idea or existing design that needs structural thinking. Evaluates through 5 layers (Why → What → How → Quality → Proof). NOT for code style or implementation details.
---

# Deep Think

First-principles architecture thinking via OpenRouter. Default: GPT-5.4 ($2.5/$15 per M tokens). Use `--model openai/gpt-5.4-pro` ($30/$180) for complex designs.

- **`/deep-think design [topic]`** — "What should this system be?" → generates a scheme
- **`/deep-think review [topic-or-files]`** — "Where will this design break?" → critiques an existing design

## The 5-Layer Framework

Top-down. Upper-layer flaws invalidate lower layers.

1. **Why** — Root problem. If only 20% survives, what is it? What's out of scope?
2. **What** — Core objects, relationships, fact vs derived, SSOT.
3. **How** — State transitions, data flow, failure recovery, composition.
4. **Quality** — Fewer concepts? Natural defaults? Composition over special cases?
5. **Proof** — Acceptance path, failure samples, calibration, self-observation.

## Workflow (both modes)

1. **Gather context** — explore project: code, docs, config, tests, schemas. Skip CSS/boilerplate/generated code. For reviews, screen across the 5 layers and form your own hypotheses about weaknesses.

2. **Build a brief** (2,000–5,000 tokens) to a temp file. This is the most important step — the model's output depends entirely on what you feed it. Read `references/brief-templates.md` for the structured templates (design vs review). Keep Evidence and Assumptions clearly separated.

3. **Call the model** — use `run_in_background` (the Bash tool's 120s timeout is too short):
   ```bash
   ~/.claude/skills/deep-think/scripts/deep_review.sh \
     --prompt-file <brief> --mode design|review --budget 10.00 \
     --output-file <path>
   ```

4. **Present results** — Don't dump raw output. Read it, then:
   - Lead with a 3-sentence executive summary
   - Organize by severity (what to fix first), not by layer
   - For each finding: what's wrong, why it matters, a thinking direction (not a solution)
   - Distinguish: "fix before shipping" vs "track as debt" vs "acceptable tradeoff"
   - Flag anything you disagree with or find underexplored
   - Offer next steps

## Follow-up (optional)

After an initial review/design, you can ask follow-up questions without resending the full brief. Only use this when the user explicitly asks to continue a previous conversation.

1. Find the `response_id` from the script's stderr output or from `.deep-think/<topic>/session.json` (last entry in `calls` array)
2. Write the follow-up question to a temp file
3. Call with `--follow-up <response_id> --prompt-file <question-file> --max-tokens 16384`

Follow-up calls are cheap (~$0.001-0.01) since only the new question counts as input. Pass `--session-dir .deep-think/<topic-slug>` to persist the conversation chain.

## Script Reference

```
~/.claude/skills/deep-think/scripts/deep_review.sh
  --prompt-file <path>        # Required: path to brief or follow-up question
  --mode review|design        # Default: review
  --model <model>             # Default: openai/gpt-5.4 (use openai/gpt-5.4-pro for complex)
  --max-tokens <n>            # Default: 32768 (reasoning + visible output combined)
  --reasoning <effort>        # Default: high (minimal|low|medium|high)
  --budget <usd>              # Default: 5.00
  --output-file <path>        # Writes output to file instead of stdout
  --follow-up <response_id>   # Chain to a previous response (multi-turn)
  --session-dir <path>        # Auto-save brief, output, and session.json
```

Cost logged to `~/.deep-review-costs.log`. GPT-5.4: ~$0.05-0.15/call. GPT-5.4-pro: ~$1-3/call. Curl timeout: 45 min, no retry.

## Error Handling

- **Missing OPENROUTER_API_KEY** (exit 4): `export OPENROUTER_API_KEY=sk-or-...`
- **Budget exceeded** (exit 6): Suggest `--budget 10.00` or reduce `--max-tokens`
- **Empty content** (exit 9): Reasoning consumed token budget. Try `--max-tokens 65536` or `--reasoning medium`
- **Timeout** (exit 7): Try `--reasoning medium` for faster response

## Dependencies

- `curl` and `jq` (standard on macOS)
- `OPENROUTER_API_KEY` environment variable
