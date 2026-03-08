#!/usr/bin/env bash
# Deep Think — calls OpenRouter Responses API for first-principles architecture thinking
# Usage: deep_review.sh --prompt-file <path> [--mode review|design] [--model <model>] [--max-tokens <n>] [--reasoning <effort>] [--budget <usd>] [--output-file <path>] [--follow-up <response_id>] [--session-dir <path>]
set -euo pipefail

# Defaults
MODE="review"
MODEL="openai/gpt-5.4"
MAX_TOKENS=32768
REASONING="high"
BUDGET="5.00"
OUTPUT_FILE=""
PROMPT_FILE=""
FOLLOW_UP=""
SESSION_DIR=""
COST_LOG="${DEEP_REVIEW_COST_LOG:-$HOME/.deep-review-costs.log}"

get_price() {
  local model="$1" type="$2"
  case "$model" in
    openai/gpt-5.2-pro) [[ "$type" == "input" ]] && echo 21 || echo 168 ;;
    openai/gpt-5.4) [[ "$type" == "input" ]] && echo 2.5 || echo 15 ;;
    openai/gpt-5.4-pro) [[ "$type" == "input" ]] && echo 30 || echo 180 ;;
    *) echo 0 ;;
  esac
}

usage() {
  echo "Usage: $0 --prompt-file <path> [--mode review|design] [--model <model>] [--max-tokens <n>] [--reasoning <effort>] [--budget <usd>] [--output-file <path>] [--follow-up <response_id>] [--session-dir <path>]"
  exit 1
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --max-tokens) MAX_TOKENS="$2"; shift 2 ;;
    --reasoning) REASONING="$2"; shift 2 ;;
    --budget) BUDGET="$2"; shift 2 ;;
    --output-file) OUTPUT_FILE="$2"; shift 2 ;;
    --follow-up) FOLLOW_UP="$2"; shift 2 ;;
    --session-dir) SESSION_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; usage ;;
  esac
done

[[ -z "$PROMPT_FILE" ]] && { echo "Error: --prompt-file required" >&2; exit 2; }
[[ -s "$PROMPT_FILE" ]] || { echo "Error: brief not found or empty: $PROMPT_FILE" >&2; exit 2; }
[[ -z "${OPENROUTER_API_KEY:-}" ]] && { echo "Error: OPENROUTER_API_KEY not set" >&2; exit 1; }

INPUT_RATE=$(get_price "$MODEL" input)
OUTPUT_RATE=$(get_price "$MODEL" output)
[[ "$INPUT_RATE" == "0" ]] && { echo "Error: unknown model: $MODEL" >&2; exit 2; }

# Estimate cost (chars / 4 ≈ tokens)
PROMPT_CHARS=$(wc -c < "$PROMPT_FILE" | tr -d ' ')
EST_INPUT_TOKENS=$(( PROMPT_CHARS / 4 ))
if [[ -n "$FOLLOW_UP" ]]; then
  EST_INPUT_COST=$(awk "BEGIN {printf \"%.3f\", $EST_INPUT_TOKENS / 1000000 * $INPUT_RATE}")
  echo "Follow-up mode: chaining from $FOLLOW_UP"
else
  EST_INPUT_COST=$(awk "BEGIN {printf \"%.3f\", $EST_INPUT_TOKENS / 1000000 * $INPUT_RATE}")
fi
EST_OUTPUT_COST=$(awk "BEGIN {printf \"%.3f\", $MAX_TOKENS / 1000000 * $OUTPUT_RATE}")
EST_TOTAL=$(awk "BEGIN {printf \"%.2f\", $EST_INPUT_COST + $EST_OUTPUT_COST}")

# Budget check
OVER=$(awk "BEGIN {print ($EST_TOTAL > $BUDGET) ? 1 : 0}")
if [[ "$OVER" == "1" ]]; then
  echo "Estimated cost \$$EST_TOTAL exceeds budget \$$BUDGET" >&2
  exit 6
fi

echo "Estimated cost: \$$EST_TOTAL max (input: \$$EST_INPUT_COST, output cap: \$$EST_OUTPUT_COST)"
echo "max_output_tokens=$MAX_TOKENS, reasoning_effort=$REASONING"

# System prompt — shared 5-layer framework, mode-specific framing
BASE_PROMPT='You are a principal systems architect. Work top-down through 5 layers. Upper-layer flaws invalidate lower layers.

1. WHY (Existence) — Root problem, scope, non-goals. If only 20% survives, what is it? Is v1 carrying v3 complexity?
2. WHAT (Ontology) — Core objects, relationships, fact vs derived, SSOT, domain alignment.
3. HOW (Mechanism) — State transitions, data flow, decision ownership, failure recovery, composition.
4. QUALITY (Elegance) — Concept count, redundant abstractions, natural defaults, composition over special-cases.
5. PROOF (Falsifiability) — Acceptance path, failure samples, threshold calibration, self-observation.'

if [[ "$MODE" == "design" ]]; then
  SYSTEM_PROMPT="${BASE_PROMPT}

Your task: derive a system design from first principles. Be concrete and specific. Output a clear design document organized by the 5 layers."
else
  SYSTEM_PROMPT="${BASE_PROMPT}

Your task: perform a first-principles critique. For each finding state: the layer, what is wrong, the principle violated, a concrete break scenario, a thinking direction (not a solution), and urgency (fix before shipping / track as debt / acceptable tradeoff). Max 7 findings, prioritized top-down. Skip code style unless it signals structural problems."
fi

# Build Responses API payload using jq
PROMPT_TEXT=$(cat "$PROMPT_FILE")

if [[ -n "$FOLLOW_UP" ]]; then
  PAYLOAD=$(jq -n \
    --arg model "$MODEL" \
    --arg user "$PROMPT_TEXT" \
    --argjson max_tokens "$MAX_TOKENS" \
    --arg reasoning "$REASONING" \
    --arg prev_id "$FOLLOW_UP" \
    '{
      model: $model,
      input: [
        {type: "message", role: "user", content: [{type: "input_text", text: $user}]}
      ],
      previous_response_id: $prev_id,
      reasoning: {effort: $reasoning},
      max_output_tokens: $max_tokens
    }')
else
  PAYLOAD=$(jq -n \
    --arg model "$MODEL" \
    --arg system "$SYSTEM_PROMPT" \
    --arg user "$PROMPT_TEXT" \
    --argjson max_tokens "$MAX_TOKENS" \
    --arg reasoning "$REASONING" \
    '{
      model: $model,
      input: [
        {type: "message", role: "system", content: [{type: "input_text", text: $system}]},
        {type: "message", role: "user", content: [{type: "input_text", text: $user}]}
      ],
      reasoning: {effort: $reasoning},
      max_output_tokens: $max_tokens
    }')
fi

# Call OpenRouter Responses API (45 min timeout, no retry — reasoning models need time)
CURL_EXIT=0
RESPONSE=$(curl -X POST -s --max-time 2700 \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://deep-think.local" \
  -H "X-Title: Deep Think" \
  -d "$PAYLOAD" \
  "https://openrouter.ai/api/v1/responses") || CURL_EXIT=$?

[[ $CURL_EXIT -ne 0 ]] && { echo "curl failed (exit $CURL_EXIT)" >&2; exit 7; }

# Check for API error
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  echo "API error: $ERROR" >&2
  exit 7
fi

# Extract response ID for follow-up chaining
RESPONSE_ID=$(echo "$RESPONSE" | jq -r '.id // empty')

# Extract content from Responses API format
# With reasoning enabled, output array has: [reasoning_block, message_block]
# Without reasoning: [message_block]. Find the last message-type entry.
CONTENT=$(echo "$RESPONSE" | jq -r '[.output[] | select(.type == "message")] | last | .content[0].text // empty')
if [[ -z "$CONTENT" ]]; then
  echo "Error: model returned no content (reasoning may have consumed entire token budget). Try --max-tokens 65536 or --reasoning medium" >&2
  exit 9
fi
INPUT_TOKENS=$(echo "$RESPONSE" | jq -r '.usage.input_tokens // 0')
OUTPUT_TOKENS=$(echo "$RESPONSE" | jq -r '.usage.output_tokens // 0')
REASONING_TOKENS=$(echo "$RESPONSE" | jq -r '.usage.output_tokens_details.reasoning_tokens // 0')

# Use provider-reported cost if available, fall back to manual calculation
PROVIDER_COST=$(echo "$RESPONSE" | jq -r '.usage.cost // empty')
if [[ -n "$PROVIDER_COST" ]]; then
  ACTUAL_COST=$(awk "BEGIN {printf \"%.4f\", $PROVIDER_COST}")
else
  ACTUAL_COST=$(awk "BEGIN {printf \"%.4f\", $INPUT_TOKENS / 1000000 * $INPUT_RATE + $OUTPUT_TOKENS / 1000000 * $OUTPUT_RATE}")
fi

# Simple conformance check (skip for follow-ups which may not use 5-layer format)
if [[ -z "$FOLLOW_UP" ]] && ! echo "$CONTENT" | grep -qiE '(WHY|WHAT|HOW|QUALITY|PROOF|layer|層)'; then
  echo "Warning: output may not follow the 5-layer framework" >&2
fi

# Timestamp for file naming
TS=$(date '+%Y-%m-%dT%H:%M')

# Output to file or stdout
if [[ -n "$OUTPUT_FILE" ]]; then
  echo "$CONTENT" > "$OUTPUT_FILE"
  echo "Report saved to: $OUTPUT_FILE"
else
  echo "$CONTENT"
fi

# Session persistence: save brief, output, and update session.json
if [[ -n "$SESSION_DIR" ]]; then
  mkdir -p "$SESSION_DIR"

  # Determine call type for file naming
  if [[ -n "$FOLLOW_UP" ]]; then
    CALL_TYPE="followup"
  else
    CALL_TYPE="$MODE"
  fi

  # Derive sequential number from existing calls in session.json
  SESSION_FILE="$SESSION_DIR/session.json"
  if [[ -f "$SESSION_FILE" ]]; then
    EXISTING=$(jq '.calls | length' "$SESSION_FILE")
  else
    EXISTING=0
  fi
  SEQ=$(printf '%03d' $(( EXISTING + 1 )))

  # Save brief and output with sequential numbering
  cp "$PROMPT_FILE" "$SESSION_DIR/${SEQ}-${CALL_TYPE}.brief.md"
  echo "$CONTENT" > "$SESSION_DIR/${SEQ}-${CALL_TYPE}.md"

  # Build call entry as JSON
  CALL_ENTRY=$(jq -n \
    --arg ts "$TS" \
    --arg seq "$SEQ" \
    --arg mode "$CALL_TYPE" \
    --arg model "$MODEL" \
    --arg cost "$ACTUAL_COST" \
    --arg response_id "$RESPONSE_ID" \
    --argjson input_tokens "$INPUT_TOKENS" \
    --argjson output_tokens "$OUTPUT_TOKENS" \
    --argjson reasoning_tokens "$REASONING_TOKENS" \
    --arg parent_id "$FOLLOW_UP" \
    '{
      seq: $seq,
      ts: $ts,
      mode: $mode,
      model: $model,
      cost: ($cost | tonumber),
      response_id: $response_id,
      tokens: {in: $input_tokens, out: $output_tokens, reasoning: $reasoning_tokens}
    } + (if $parent_id != "" then {parent_id: $parent_id} else {} end)')

  # Append to session.json
  if [[ -f "$SESSION_FILE" ]]; then
    jq --argjson entry "$CALL_ENTRY" '.calls += [$entry]' "$SESSION_FILE" > "${SESSION_FILE}.tmp" \
      && mv "${SESSION_FILE}.tmp" "$SESSION_FILE"
  else
    TOPIC=$(basename "$SESSION_DIR")
    jq -n --arg topic "$TOPIC" --argjson entry "$CALL_ENTRY" \
      '{topic: $topic, calls: [$entry]}' > "$SESSION_FILE"
  fi

  echo "Session saved to: $SESSION_DIR" >&2
fi

# Emit response ID for follow-up chaining
if [[ -n "$RESPONSE_ID" ]]; then
  echo "response_id=$RESPONSE_ID" >&2
fi

# Log cost with response ID
FOLLOW_UP_TAG=""
[[ -n "$FOLLOW_UP" ]] && FOLLOW_UP_TAG=" follow-up"
echo "$(date '+%Y-%m-%d %H:%M:%S') | $MODEL | \$$ACTUAL_COST | ${INPUT_TOKENS}in/${OUTPUT_TOKENS}out(${REASONING_TOKENS}reasoning)${FOLLOW_UP_TAG} | $RESPONSE_ID" >> "$COST_LOG"

echo "Actual cost: \$$ACTUAL_COST (reasoning: ${REASONING_TOKENS} tokens)" >&2
