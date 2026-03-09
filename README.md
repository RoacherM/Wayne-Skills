# Wayne Skills

A collection of Claude Code skills for augmenting AI-assisted workflows.

## Skills

### Deep Think

First-principles architecture thinking via GPT-5.x reasoning models (OpenRouter).

- **`/deep-think design [topic]`** — Generate a system architecture from scratch
- **`/deep-think review [topic]`** — Critique an existing design

Evaluates through 5 layers: **Why → What → How → Quality → Proof**.

**Setup:** `export OPENROUTER_API_KEY=sk-or-...` (requires `curl` + `jq`)

### OKR

Git-native OKR tracking with AI intelligence and metro map visualization.

- **3 event types**: progress (●), done (◆), blocked (■)
- **3 line styles**: active solid, blocked dashed, merge-back arc
- **Thick/thin** distinguishes KR trunks from project sub-tracks
- **Safety gate**: ambiguous KR matching always asks, never guesses

Intents: `init` · `commit` · `status` · `revise` · `close` · `metro map`

```
~/.okr/bin/metro              # generate metro visualization
~/.okr/bin/metro --quarter 2026Q1
```

## Install

```bash
# Install a specific skill
cp -r skills/<skill-name> ~/.claude/skills/<skill-name>
```

## License

MIT
