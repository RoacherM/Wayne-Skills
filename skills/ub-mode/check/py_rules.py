"""Python static checks for test honesty and silent error fallbacks."""

from __future__ import annotations

from check.model import (
    Finding,
    ParsedFile,
    in_ancestor_types,
    make_finding,
    named_children,
    text,
    walk,
)

_SLEEP_MODULES = {"time", "asyncio"}
_BROAD_EXCEPTS = {"", "Exception", "BaseException"}
_EMPTY_RETURNS = {'""', "''", "[]", "{}", "()", "list()", "dict()", "set()"}
_LOOP_TYPES = {"for_statement", "while_statement"}
_TEST_FIXTURE_DECORATORS = {"pytest.fixture", "fixture"}
_TEST_HOOK_NAMES = {"setUp", "tearDown", "setUpClass", "tearDownClass", "asyncSetUp", "asyncTearDown"}

_MSG_SLEEP = (
    "Replace fixed sleep in tests with a real event, queue, or barrier signal "
    "(or a fake clock). Fixed sleeps race CPU load and hide flakiness."
)
_MSG_FLAKE = (
    "Do not mask flaky tests with retries. Fix the underlying race or wait on an explicit signal."
)
_MSG_SKIP = (
    "Do not skip/xfail tests without an explicit reason or leave empty test bodies. "
    "Fix the test, document why it is skipped, or remove the dead placeholder."
)
_MSG_FALLBACK = (
    "Do not swallow broad errors by returning an empty collection or string (`[]`, `{}`, `\"\"`). "
    "Return `None` to signal unknown state, or let the error propagate."
)


class _PyImports:
    def __init__(self) -> None:
        self.sleep_modules: set[str] = set()
        self.sleep_direct: set[str] = set()
        self.pytest_marks: set[str] = {"pytest.mark"}


def _collect_import_stmt(data: bytes, node, imports: _PyImports) -> None:
    for child in named_children(node):
        if child.type == "dotted_name" and text(data, child) in _SLEEP_MODULES:
            imports.sleep_modules.add(text(data, child))
        elif child.type == "aliased_import":
            parts = named_children(child)
            if len(parts) == 2 and text(data, parts[0]) in _SLEEP_MODULES:
                imports.sleep_modules.add(text(data, parts[1]))


def _collect_from_symbol(data: bytes, items: list, symbol: str, out: set[str]) -> None:
    for item in items:
        if item.type == "dotted_name" and text(data, item) == symbol:
            out.add(symbol)
        elif item.type == "aliased_import":
            pair = named_children(item)
            if len(pair) == 2 and text(data, pair[0]) == symbol:
                out.add(text(data, pair[1]))


def _collect_imports(data: bytes, root) -> _PyImports:
    imports = _PyImports()
    for node in walk(root):
        if node.type == "import_statement":
            _collect_import_stmt(data, node, imports)
        elif node.type == "import_from_statement":
            parts = named_children(node)
            if not parts:
                continue
            mod = text(data, parts[0])
            if mod in _SLEEP_MODULES:
                _collect_from_symbol(data, parts[1:], "sleep", imports.sleep_direct)
            elif mod == "pytest":
                _collect_from_symbol(data, parts[1:], "mark", imports.pytest_marks)
    return imports


def _is_zero_sleep(data: bytes, call) -> bool:
    args_node = call.child_by_field_name("arguments")
    if args_node is None:
        return False
    args = named_children(args_node)
    if len(args) != 1:
        return False
    val = text(data, args[0]).strip()
    try:
        return float(val) == 0.0
    except ValueError:
        return False


def _is_sleep_call(data: bytes, call, imports: _PyImports) -> bool:
    func = call.child_by_field_name("function")
    if func is None:
        return False
    if func.type == "identifier":
        return text(data, func) in imports.sleep_direct
    if func.type != "attribute":
        return False
    obj = func.child_by_field_name("object")
    attr = func.child_by_field_name("attribute")
    if obj is None or attr is None:
        return False
    return text(data, obj) in imports.sleep_modules and text(data, attr) == "sleep"


def _is_test_or_fixture_fn(data: bytes, fn_node) -> bool:
    name_node = fn_node.child_by_field_name("name")
    name = text(data, name_node) if name_node else ""
    if name.startswith("test_") or name in _TEST_HOOK_NAMES:
        return True
    parent = fn_node.parent
    if parent is None or parent.type != "decorated_definition":
        return False
    for child in named_children(parent):
        if child.type == "decorator":
            target, _ = _decorator_target(data, child)
            if target in _TEST_FIXTURE_DECORATORS:
                return True
    return False


def _enclosing_test_fn(data: bytes, node) -> bool:
    cur = node.parent
    while cur is not None:
        if cur.type == "function_definition":
            return _is_test_or_fixture_fn(data, cur)
        cur = cur.parent
    return False


def _string_nonempty(data: bytes, node) -> bool:
    if node.type != "string":
        return True
    raw = text(data, node).strip().lstrip("frbuFRBU")
    return raw.strip("\"'").strip() != ""


def _keyword_arg(data: bytes, arg_list, key: str):
    if arg_list is None:
        return None
    for arg in named_children(arg_list):
        if arg.type == "keyword_argument":
            name = arg.child_by_field_name("name")
            if name and text(data, name) == key:
                return arg.child_by_field_name("value")
    return None


def _has_reason(data: bytes, arg_list) -> bool:
    if arg_list is None:
        return False
    reason_val = _keyword_arg(data, arg_list, "reason")
    if reason_val is not None:
        return _string_nonempty(data, reason_val)
    for arg in named_children(arg_list):
        if arg.type != "keyword_argument" and _string_nonempty(data, arg):
            return True
    return False


def _decorator_target(data: bytes, decorator) -> tuple[str, object | None]:
    children = named_children(decorator)
    if not children:
        return "", None
    expr = children[0]
    if expr.type == "call":
        func = expr.child_by_field_name("function")
        return (text(data, func) if func else ""), expr.child_by_field_name("arguments")
    return text(data, expr), None


def _mark_suffix(target: str, marks: set[str]) -> str | None:
    for prefix in marks:
        if target.startswith(f"{prefix}."):
            return target[len(prefix) + 1 :]
    return None


def _is_flake_decorator(data: bytes, target: str, suffix: str | None, args) -> bool:
    if target == "flaky" or suffix in {"flaky", "retries"}:
        return True
    return _keyword_arg(data, args, "reruns") is not None


def _is_missing_skip_reason(data: bytes, target: str, suffix: str | None, args) -> bool:
    if suffix in {"skip", "xfail"} or target in {"unittest.skip", "unittest.expectedFailure"}:
        return not _has_reason(data, args)
    if suffix == "skipif":
        reason_val = _keyword_arg(data, args, "reason")
        return reason_val is None or not _string_nonempty(data, reason_val)
    return False


def _check_decorator(parsed: ParsedFile, decorator, imports: _PyImports) -> list[Finding]:
    target, args = _decorator_target(parsed.data, decorator)
    suffix = _mark_suffix(target, imports.pytest_marks)
    out: list[Finding] = []
    if _is_flake_decorator(parsed.data, target, suffix, args):
        out.append(make_finding(parsed, decorator, "no-flake-masking", _MSG_FLAKE))
    if _is_missing_skip_reason(parsed.data, target, suffix, args):
        out.append(make_finding(parsed, decorator, "no-skipped-or-empty-test", _MSG_SKIP))
    return out


def _is_placeholder_stmt(stmt) -> bool:
    if stmt.type in {"pass_statement", "ellipsis", "string"}:
        return True
    if stmt.type == "expression_statement":
        inner = named_children(stmt)
        return len(inner) == 1 and inner[0].type in {"ellipsis", "string"}
    return False


def _body_is_empty(fn_node) -> bool:
    body = fn_node.child_by_field_name("body")
    if body is None:
        return False
    stmts = [c for c in named_children(body) if c.type != "comment"]
    return not stmts or all(_is_placeholder_stmt(s) for s in stmts)


def _is_bare_skip_call(data: bytes, call) -> bool:
    func = call.child_by_field_name("function")
    if func is None or text(data, func) not in {"pytest.skip", "self.skipTest"}:
        return False
    return not _has_reason(data, call.child_by_field_name("arguments"))


def _except_is_broad(data: bytes, clause) -> bool:
    for child in named_children(clause):
        if child.type == "block":
            return True
        if child.type == "as_pattern":
            head = named_children(child)[0] if named_children(child) else None
            return head is not None and text(data, head) in _BROAD_EXCEPTS
        return text(data, child) in _BROAD_EXCEPTS
    return True


def _block_trailing_empty_return(data: bytes, block) -> object | None:
    if any(n.type == "raise_statement" for n in walk(block)):
        return None
    stmts = [c for c in named_children(block) if c.type != "comment"]
    if not stmts or stmts[-1].type != "return_statement":
        return None
    values = named_children(stmts[-1])
    if len(values) == 1 and text(data, values[0]).replace(" ", "") in _EMPTY_RETURNS:
        return stmts[-1]
    return None


def _silent_fallback_node(data: bytes, clause) -> object | None:
    if not _except_is_broad(data, clause):
        return None
    block = next((c for c in named_children(clause) if c.type == "block"), None)
    return _block_trailing_empty_return(data, block) if block is not None else None


def _check_call(parsed: ParsedFile, call, imports: _PyImports) -> list[Finding]:
    if not _enclosing_test_fn(parsed.data, call):
        return []
    if _is_sleep_call(parsed.data, call, imports):
        if not _is_zero_sleep(parsed.data, call) and not in_ancestor_types(call, _LOOP_TYPES):
            return [make_finding(parsed, call, "no-fixed-sleep", _MSG_SLEEP)]
    elif _is_bare_skip_call(parsed.data, call):
        return [make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP)]
    return []


def _check_py_node(parsed: ParsedFile, node, imports: _PyImports) -> list[Finding]:
    if node.type == "decorator":
        return _check_decorator(parsed, node, imports)
    if node.type == "call":
        return _check_call(parsed, node, imports)
    if node.type == "function_definition":
        name = node.child_by_field_name("name")
        if name and text(parsed.data, name).startswith("test_") and _body_is_empty(node):
            return [make_finding(parsed, node, "no-skipped-or-empty-test", _MSG_SKIP)]
    elif node.type == "except_clause":
        ret = _silent_fallback_node(parsed.data, node)
        if ret is not None:
            return [make_finding(parsed, ret, "no-silent-fallback", _MSG_FALLBACK)]
    return []


def check_python(parsed: ParsedFile) -> list[Finding]:
    imports = _collect_imports(parsed.data, parsed.root)
    findings: list[Finding] = []
    for node in walk(parsed.root):
        findings.extend(_check_py_node(parsed, node, imports))
    return findings
