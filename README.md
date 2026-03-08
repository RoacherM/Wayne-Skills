# Deep Think

A Claude Code skill that delegates first-principles architecture thinking to GPT-5.x reasoning models via OpenRouter.

Two modes:
- **`/deep-think design [topic]`** — Generate a system architecture from scratch
- **`/deep-think review [topic]`** — Critique an existing design

Evaluates through 5 layers: **Why → What → How → Quality → Proof**. Upper-layer flaws invalidate lower layers.

## How It Works

1. Claude gathers project context (code, docs, config)
2. Claude writes a structured brief (2,000–5,000 tokens)
3. A bash script sends the brief to GPT-5.x via OpenRouter Responses API
4. Claude reads the output, synthesizes findings, and presents them

## Install

```bash
cp -r skills/deep-think ~/.claude/skills/deep-think
```

## Setup

```bash
export OPENROUTER_API_KEY=sk-or-...
```

Requires `curl` and `jq` (standard on macOS).

## Cost

| Model | Input | Output | Typical call |
|-------|-------|--------|-------------|
| GPT-5.4 (default) | $2.5/M | $15/M | $0.05–0.15 |
| GPT-5.4-pro | $30/M | $180/M | $1–3 |

Use `--model openai/gpt-5.4-pro` for complex designs. Follow-up calls cost ~$0.001–0.01.

## License

MIT
