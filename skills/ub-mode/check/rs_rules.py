"""Rust static checks for test honesty."""

from __future__ import annotations

import re

from check.model import (
    Finding,
    ParsedFile,
    in_ancestor_types,
    make_finding,
    named_children,
    text,
    walk,
)

_SLEEP_PATHS = {
    "thread::sleep",
    "std::thread::sleep",
    "tokio::time::sleep",
    "async_std::task::sleep",
    "smol::Timer::after",
}
_TEST_ATTRS = {"test", "tokio::test", "async_std::test", "rstest"}
_LOOP_TYPES = {"loop_expression", "while_expression", "for_expression"}
_USE_SLEEP_PREFIXES = ("std::thread", "tokio::time", "async_std::task")
_ZERO_DURATION_RE = re.compile(r"(?:Duration::ZERO|from_(?:secs|millis|micros|nanos)\(\s*0\s*\))")

_MSG_SLEEP = (
    "Replace fixed sleep in tests with a channel, Notify, or barrier signal "
    "(or `#[tokio::test(start_paused = true)]`). Fixed sleeps race CPU load and hide flakiness."
)
_MSG_SKIP = (
    "Do not ignore tests without an explicit reason (`#[ignore = \"...\"]`) or leave empty test bodies."
)


_NESTED_USE_PATHS = (
    ("std", "thread::sleep"),
    ("tokio", "time::sleep"),
    ("async_std", "task::sleep"),
)


def _match_brace_item(item: str, expected: str) -> str | None:
    if item == expected:
        return "sleep"
    if item.startswith(f"{expected} as "):
        return item.split(" as ", 1)[1].strip()
    return None


def _extract_brace_aliases(cleaned: str, prefix: str, expected: str) -> set[str]:
    if not (cleaned.startswith(f"{prefix}::{{") and cleaned.endswith("}")):
        return set()
    inside = cleaned[len(prefix) + 3 : -1]
    out: set[str] = set()
    for part in inside.split(","):
        alias = _match_brace_item(part.strip(), expected)
        if alias is not None:
            out.add(alias)
    return out


def _extract_use_sleep_aliases(raw_use: str) -> set[str]:
    aliases: set[str] = set()
    cleaned = " ".join(raw_use.removeprefix("use").rstrip(";").split())
    for prefix in _USE_SLEEP_PREFIXES:
        alias = _match_brace_item(cleaned, f"{prefix}::sleep")
        if alias is not None:
            aliases.add(alias)
        aliases.update(_extract_brace_aliases(cleaned, prefix, "sleep"))
    for root_pkg, sub in _NESTED_USE_PATHS:
        aliases.update(_extract_brace_aliases(cleaned, root_pkg, sub))
    return aliases


def _collect_sleep_aliases(data: bytes, root) -> set[str]:
    aliases: set[str] = set()
    for node in walk(root):
        if node.type == "use_declaration":
            aliases.update(_extract_use_sleep_aliases(text(data, node)))
    return aliases


def _preceding_attrs(node) -> list:
    attrs = []
    sib = node.prev_named_sibling
    while sib is not None and sib.type in {"attribute_item", "line_comment", "block_comment"}:
        if sib.type == "attribute_item":
            attrs.append(sib)
        sib = sib.prev_named_sibling
    return attrs


def _attr_name(data: bytes, attr_item) -> str:
    attr = next((c for c in named_children(attr_item) if c.type == "attribute"), None)
    if attr is None:
        return ""
    children = named_children(attr)
    return text(data, children[0]) if children else ""


def _fn_is_test(data: bytes, fn_node) -> bool:
    return any(_attr_name(data, a) in _TEST_ATTRS for a in _preceding_attrs(fn_node))


def _fn_uses_paused_time(data: bytes, fn_node) -> bool:
    for attr in _preceding_attrs(fn_node):
        raw = text(data, attr).replace(" ", "")
        if "start_paused=true" in raw:
            return True
    return False


def _is_cfg_test_mod(data: bytes, mod_node) -> bool:
    for attr in _preceding_attrs(mod_node):
        if text(data, attr).replace(" ", "").startswith("#[cfg(test)]"):
            return True
    return False


def _test_scope_state(data: bytes, node, role: str) -> tuple[bool, bool]:
    cur = node.parent
    in_test = role == "test"
    paused = False
    while cur is not None:
        if cur.type == "function_item":
            if _fn_uses_paused_time(data, cur):
                paused = True
            if _fn_is_test(data, cur):
                in_test = True
        elif cur.type == "mod_item" and _is_cfg_test_mod(data, cur):
            in_test = True
        cur = cur.parent
    return in_test, paused


def _ignore_has_reason(data: bytes, attr_item) -> bool:
    inner = next((c for c in named_children(attr_item) if c.type == "attribute"), None)
    if inner is None:
        return False
    return any(
        c.type == "string_literal" and text(data, c).strip('"').strip() != ""
        for c in named_children(inner)
    )


def _check_test_fn(parsed: ParsedFile, fn_node) -> list[Finding]:
    out: list[Finding] = []
    for attr in _preceding_attrs(fn_node):
        if _attr_name(parsed.data, attr) == "ignore" and not _ignore_has_reason(parsed.data, attr):
            out.append(make_finding(parsed, attr, "no-skipped-or-empty-test", _MSG_SKIP))
    body = fn_node.child_by_field_name("body")
    if body is not None:
        stmts = [c for c in named_children(body) if c.type not in {"line_comment", "block_comment"}]
        if not stmts:
            out.append(make_finding(parsed, fn_node, "no-skipped-or-empty-test", _MSG_SKIP))
    return out


def _is_zero_sleep_call(data: bytes, call) -> bool:
    args = call.child_by_field_name("arguments")
    if args is None:
        return False
    return _ZERO_DURATION_RE.search(text(data, args)) is not None


def _check_sleep_call(parsed: ParsedFile, call, aliases: set[str]) -> Finding | None:
    func = call.child_by_field_name("function")
    if func is None:
        return None
    target = text(parsed.data, func)
    if target not in _SLEEP_PATHS and target not in aliases:
        return None
    in_test, paused = _test_scope_state(parsed.data, call, parsed.role)
    if (
        in_test
        and not paused
        and not _is_zero_sleep_call(parsed.data, call)
        and not in_ancestor_types(call, _LOOP_TYPES)
    ):
        return make_finding(parsed, call, "no-fixed-sleep", _MSG_SLEEP)
    return None


def check_rust(parsed: ParsedFile) -> list[Finding]:
    aliases = _collect_sleep_aliases(parsed.data, parsed.root)
    findings: list[Finding] = []
    for node in walk(parsed.root):
        if node.type == "call_expression":
            found = _check_sleep_call(parsed, node, aliases)
            if found is not None:
                findings.append(found)
        elif node.type == "function_item" and _fn_is_test(parsed.data, node):
            findings.extend(_check_test_fn(parsed, node))
    return findings
