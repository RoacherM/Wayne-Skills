"""Shared data model, tree-sitter helpers, and inline exemption parsing."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Literal

FileRole = Literal["source", "test"]

ALL_EXTENSIONS = {
    ".py": "python",
    ".rs": "rust",
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
}

_TEST_DIRS = {"test", "tests", "spec", "specs", "__tests__"}
_JS_TEST_INFIXES = (".test.", ".spec.")
_ALLOW_MARKER_RE = re.compile(r"ub-check:\s*allow\b(.*)$")
_ALLOW_BODY_RE = re.compile(r"^\s+([a-z0-9-]+)\s*:\s*(.+?)\s*$")


@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    column: int
    rule: str
    message: str


@dataclass(frozen=True)
class ParsedFile:
    display: str
    grammar: str
    role: FileRole
    data: bytes
    root: object


def grammar_of(path: Path) -> str | None:
    if path.name.endswith(".d.ts"):
        return None
    return ALL_EXTENSIONS.get(path.suffix.lower())


def role_of(rel_path: Path) -> FileRole:
    if any(part in _TEST_DIRS for part in rel_path.parts):
        return "test"
    if any(infix in rel_path.name for infix in _JS_TEST_INFIXES):
        return "test"
    return "source"


@cache
def _parser_for(grammar: str):
    from tree_sitter_language_pack import download, get_parser

    download([grammar])
    return get_parser(grammar)


def parse_file(display: str, rel_path: Path, source: str) -> ParsedFile | None:
    grammar = grammar_of(rel_path)
    if grammar is None:
        return None
    data = source.encode("utf-8")
    tree = _parser_for(grammar).parse(data)
    return ParsedFile(
        display=display,
        grammar=grammar,
        role=role_of(rel_path),
        data=data,
        root=tree.root_node,
    )


def text(data: bytes, node) -> str:
    return data[node.start_byte : node.end_byte].decode("utf-8")


def loc(node) -> tuple[int, int]:
    row, col = node.start_point
    return row + 1, col + 1


def walk(node):
    stack = [node]
    while stack:
        current = stack.pop()
        yield current
        stack.extend(reversed(current.children))


def named_children(node) -> list:
    return [child for child in node.children if child.is_named]


def make_finding(parsed: ParsedFile, node, rule: str, message: str) -> Finding:
    line, col = loc(node)
    return Finding(parsed.display, line, col, f"ub-check({rule})", message)


def in_ancestor_types(node, types: set[str]) -> bool:
    cur = node.parent
    while cur is not None:
        if cur.type in types:
            return True
        cur = cur.parent
    return False


def _extract_allow_directive(parsed: ParsedFile, comment_node) -> tuple[int, str | None, Finding | None] | None:
    raw = text(parsed.data, comment_node)
    match = _ALLOW_MARKER_RE.search(raw)
    if match is None:
        return None
    line, col = loc(comment_node)
    body = match.group(1)
    if comment_node.type == "block_comment":
        body = body.rstrip("*/").strip()
    parsed_body = _ALLOW_BODY_RE.match(body)
    if parsed_body is None:
        bad = Finding(
            parsed.display,
            line,
            col,
            "ub-check(invalid-allow-comment)",
            "Inline exemption must include a rule name and non-empty reason: "
            "`ub-check: allow <rule>: <reason>`.",
        )
        return line, None, bad
    return line, parsed_body.group(1), None


def apply_allow_comments(parsed: ParsedFile, findings: list[Finding]) -> list[Finding]:
    allowed: dict[int, set[str]] = {}
    errors: list[Finding] = []
    for node in walk(parsed.root):
        if node.type not in {"comment", "line_comment", "block_comment"}:
            continue
        directive = _extract_allow_directive(parsed, node)
        if directive is None:
            continue
        line, rule, err = directive
        if err is not None:
            errors.append(err)
        elif rule is not None:
            allowed.setdefault(line, set()).add(rule)
            allowed.setdefault(line + 1, set()).add(rule)
    kept = [
        f
        for f in findings
        if f.rule.removeprefix("ub-check(").removesuffix(")") not in allowed.get(f.line, ())
    ]
    return kept + errors
