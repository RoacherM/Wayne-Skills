"""JavaScript and TypeScript static checks for test honesty and silent fallbacks."""

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

_TEST_ROOTS = {"test", "it", "describe", "suite"}
_TEST_HOOKS = {"before", "after", "beforeEach", "afterEach", "beforeAll", "afterAll"}
_SKIP_OR_ONLY_CALLEES = {"xtest", "xit", "xdescribe", "fit", "fdescribe"}
_EMPTY_RETURNS = {'""', "''", "``", "[]", "{}"}
_TIMER_MODULES = {"node:timers/promises", "timers/promises"}
_LOOP_TYPES = {"for_statement", "for_in_statement", "while_statement", "do_statement"}

_MSG_SLEEP = (
    "Replace fixed sleep in tests with a real event, callback, or Promise signal "
    "(or fake timers). Fixed sleeps race CPU load and hide flakiness."
)
_MSG_FLAKE = (
    "Do not mask flaky tests with retries. Fix the underlying race or wait on an explicit signal."
)
_MSG_SKIP = (
    "Do not skip, focus (`.only`), or leave empty test bodies without an explicit reason. "
    "Fix the test, document why it is skipped, or remove `.only`."
)
_MSG_FALLBACK = (
    "Do not swallow errors by returning an empty collection or string (`[]`, `{}`, `\"\"`). "
    "Return `null`/`undefined` to signal unknown state, or let the error propagate."
)


def _collect_timer_specifiers(data: bytes, import_node, aliases: set[str]) -> None:
    for spec in walk(import_node):
        if spec.type != "import_specifier":
            continue
        name = spec.child_by_field_name("name")
        alias = spec.child_by_field_name("alias")
        if name and text(data, name) == "setTimeout":
            aliases.add(text(data, alias or name))


def _timer_aliases(data: bytes, root) -> set[str]:
    aliases: set[str] = set()
    for node in walk(root):
        if node.type != "import_statement":
            continue
        source = node.child_by_field_name("source")
        if source is not None and text(data, source).strip("\"'") in _TIMER_MODULES:
            _collect_timer_specifiers(data, node, aliases)
    return aliases


def _uses_fake_timers(data: bytes, root) -> bool:
    for node in walk(root):
        if node.type != "call_expression":
            continue
        func = node.child_by_field_name("function")
        if func is None:
            continue
        raw = text(data, func)
        if raw.endswith(("useFakeTimers", "timers.enable")):
            return True
    return False


def _callee_root_name(data: bytes, node) -> str:
    cur = node
    while cur is not None and cur.type in {"member_expression", "call_expression"}:
        cur = cur.child_by_field_name("object" if cur.type == "member_expression" else "function")
    return text(data, cur) if cur is not None and cur.type == "identifier" else ""


def _in_test_body(data: bytes, node) -> bool:
    cur = node.parent
    while cur is not None:
        if cur.type in {"arrow_function", "function_expression"}:
            parent = cur.parent
            if parent is not None and parent.type == "arguments":
                call = parent.parent
                if call is not None and call.type == "call_expression":
                    root_name = _callee_root_name(data, call.child_by_field_name("function"))
                    if root_name in _TEST_ROOTS or root_name in _TEST_HOOKS:
                        return True
        cur = cur.parent
    return False


def _is_zero_delay(data: bytes, arg) -> bool:
    if arg is None:
        return True
    raw = text(data, arg).strip()
    try:
        return float(raw) == 0.0
    except ValueError:
        return False


def _is_set_timeout_call(data: bytes, expr) -> tuple[bool, object | None]:
    if expr is None or expr.type != "call_expression":
        return False, None
    func = expr.child_by_field_name("function")
    if func is None or text(data, func) not in {"setTimeout", "globalThis.setTimeout", "window.setTimeout"}:
        return False, None
    args = named_children(expr.child_by_field_name("arguments"))
    delay = args[1] if len(args) >= 2 else None
    return True, delay


def _single_expr(body):
    if body is None:
        return None
    if body.type != "statement_block":
        return body
    stmts = [c for c in named_children(body) if c.type != "comment"]
    if len(stmts) == 1 and stmts[0].type == "expression_statement":
        inner = named_children(stmts[0])
        return inner[0] if inner else None
    return None


def _is_promise_sleep(data: bytes, new_expr) -> bool:
    ctor = new_expr.child_by_field_name("constructor")
    args_node = new_expr.child_by_field_name("arguments")
    if ctor is None or args_node is None or text(data, ctor) != "Promise":
        return False
    args = named_children(args_node)
    if not args or args[0].type not in {"arrow_function", "function_expression"}:
        return False
    inner = _single_expr(args[0].child_by_field_name("body"))
    ok, delay = _is_set_timeout_call(data, inner)
    return ok and not _is_zero_delay(data, delay)


def _is_sleep_expr(data: bytes, expr, timer_aliases: set[str]) -> bool:
    if expr is None:
        return False
    if expr.type == "new_expression":
        return _is_promise_sleep(data, expr)
    if expr.type != "call_expression":
        return False
    func = expr.child_by_field_name("function")
    args_node = expr.child_by_field_name("arguments")
    if func is None or args_node is None:
        return False
    raw = text(data, func)
    args = named_children(args_node)
    delay = args[0] if args else None
    if raw in timer_aliases or raw in {"scheduler.wait", "Bun.sleep"}:
        return not _is_zero_delay(data, delay)
    return False


def _string_nonempty(data: bytes, node) -> bool:
    if node.type not in {"string", "template_string"}:
        return True
    return text(data, node).strip("\"'`").strip() != ""


def _is_unexplained_skip(data: bytes, val_node) -> bool:
    return val_node.type == "true" or not _string_nonempty(data, val_node)


def _option_finding(parsed: ParsedFile, prop) -> Finding | None:
    if prop.type != "pair":
        return None
    key_node = prop.child_by_field_name("key")
    val_node = prop.child_by_field_name("value")
    if key_node is None or val_node is None:
        return None
    key = text(parsed.data, key_node).strip("\"'")
    if key == "retry":
        return make_finding(parsed, prop, "no-flake-masking", _MSG_FLAKE)
    if key == "only" and val_node.type == "true":
        return make_finding(parsed, prop, "no-skipped-or-empty-test", _MSG_SKIP)
    if key == "skip" and _is_unexplained_skip(parsed.data, val_node):
        return make_finding(parsed, prop, "no-skipped-or-empty-test", _MSG_SKIP)
    return None


def _inspect_test_options(parsed: ParsedFile, obj) -> list[Finding]:
    if obj.type != "object":
        return []
    out: list[Finding] = []
    for prop in named_children(obj):
        found = _option_finding(parsed, prop)
        if found is not None:
            out.append(found)
    return out


def _empty_callback(arg) -> bool:
    if arg.type not in {"arrow_function", "function_expression"}:
        return False
    body = arg.child_by_field_name("body")
    if body is None or body.type != "statement_block":
        return False
    return all(c.type == "comment" for c in named_children(body))


def _returned_expr(body):
    if body is None:
        return None
    if body.type != "statement_block":
        return body
    stmts = [c for c in named_children(body) if c.type != "comment"]
    if len(stmts) != 1 or stmts[0].type != "return_statement":
        return None
    vals = named_children(stmts[0])
    return vals[0] if len(vals) == 1 else None


def _is_sleep_wrapper_fn(data: bytes, fn_node, base_aliases: set[str]) -> bool:
    expr = _returned_expr(fn_node.child_by_field_name("body"))
    return _is_sleep_expr(data, expr, base_aliases)


def _var_sleep_helper_name(data: bytes, node, base_aliases: set[str]) -> str | None:
    name = node.child_by_field_name("name")
    val = node.child_by_field_name("value")
    if name is None or name.type != "identifier" or val is None:
        return None
    if val.type in {"arrow_function", "function_expression"} and _is_sleep_wrapper_fn(data, val, base_aliases):
        return text(data, name)
    return None


def _sleep_helper_name(data: bytes, node, base_aliases: set[str]) -> str | None:
    if node.type == "function_declaration":
        name = node.child_by_field_name("name")
        return text(data, name) if name and _is_sleep_wrapper_fn(data, node, base_aliases) else None
    if node.type == "variable_declarator":
        return _var_sleep_helper_name(data, node, base_aliases)
    return None


def _local_sleep_helpers(data: bytes, root, base_aliases: set[str]) -> set[str]:
    helpers: set[str] = set()
    for node in walk(root):
        found = _sleep_helper_name(data, node, base_aliases)
        if found is not None:
            helpers.add(found)
    return helpers


def _check_skip_member(parsed: ParsedFile, call, args: list) -> list[Finding]:
    is_test_def = bool(args) and args[-1].type in {"arrow_function", "function_expression"}
    if is_test_def or len(args) < 2 or not _string_nonempty(parsed.data, args[1]):
        return [make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP)]
    return []


def _check_t_skip(parsed: ParsedFile, call, args: list) -> list[Finding]:
    if not args or not _string_nonempty(parsed.data, args[0]):
        return [make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP)]
    return []


def _check_member_test_call(parsed: ParsedFile, call, func, args: list) -> list[Finding]:
    obj = func.child_by_field_name("object")
    prop = func.child_by_field_name("property")
    if obj is None or prop is None:
        return []
    obj_name = text(parsed.data, obj)
    prop_name = text(parsed.data, prop)
    if obj_name in _TEST_ROOTS and prop_name == "only":
        return [make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP)]
    if obj_name in _TEST_ROOTS and prop_name == "skip":
        return _check_skip_member(parsed, call, args)
    if obj_name == "t" and prop_name == "skip":
        return _check_t_skip(parsed, call, args)
    return []


def _check_ident_test_call(parsed: ParsedFile, call, name: str, args: list) -> list[Finding]:
    if name in _SKIP_OR_ONLY_CALLEES:
        return [make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP)]
    if name not in _TEST_ROOTS:
        return []
    out: list[Finding] = []
    for arg in args[1:3]:
        out.extend(_inspect_test_options(parsed, arg))
    if name in {"test", "it"} and args and _empty_callback(args[-1]):
        out.append(make_finding(parsed, call, "no-skipped-or-empty-test", _MSG_SKIP))
    return out


def _check_test_call(parsed: ParsedFile, call) -> list[Finding]:
    func = call.child_by_field_name("function")
    args_node = call.child_by_field_name("arguments")
    if func is None or args_node is None:
        return []
    args = named_children(args_node)
    if func.type == "member_expression":
        return _check_member_test_call(parsed, call, func, args)
    if func.type == "identifier":
        return _check_ident_test_call(parsed, call, text(parsed.data, func), args)
    return []


def _is_empty_literal(data: bytes, expr) -> bool:
    if expr is None:
        return False
    target = expr
    if target.type == "parenthesized_expression":
        inner = named_children(target)
        target = inner[0] if len(inner) == 1 else target
    return text(data, target).replace(" ", "") in _EMPTY_RETURNS


def _block_trailing_empty_return(data: bytes, body) -> object | None:
    if body is None or any(n.type == "throw_statement" for n in walk(body)):
        return None
    stmts = [c for c in named_children(body) if c.type != "comment"]
    if not stmts or stmts[-1].type != "return_statement":
        return None
    values = named_children(stmts[-1])
    if len(values) == 1 and _is_empty_literal(data, values[0]):
        return stmts[-1]
    return None


def _dot_catch_handler(data: bytes, call):
    func = call.child_by_field_name("function")
    args_node = call.child_by_field_name("arguments")
    if func is None or args_node is None or func.type != "member_expression":
        return None
    prop = func.child_by_field_name("property")
    if prop is None or text(data, prop) != "catch":
        return None
    args = named_children(args_node)
    if args and args[0].type in {"arrow_function", "function_expression"}:
        return args[0]
    return None


def _dot_catch_fallback_node(data: bytes, call) -> object | None:
    handler = _dot_catch_handler(data, call)
    if handler is None:
        return None
    body = handler.child_by_field_name("body")
    if body is None:
        return None
    if body.type != "statement_block":
        return call if _is_empty_literal(data, body) else None
    return _block_trailing_empty_return(data, body)


def _check_await_sleep(parsed: ParsedFile, node, timer_aliases: set[str], *, fake_timers: bool) -> list[Finding]:
    if parsed.role != "test" or fake_timers:
        return []
    children = named_children(node)
    arg = children[0] if children else None
    if (
        _is_sleep_expr(parsed.data, arg, timer_aliases)
        and _in_test_body(parsed.data, node)
        and not in_ancestor_types(node, _LOOP_TYPES)
    ):
        return [make_finding(parsed, node, "no-fixed-sleep", _MSG_SLEEP)]
    return []


def _check_js_node(parsed: ParsedFile, node, timer_aliases: set[str], *, fake_timers: bool) -> list[Finding]:
    if node.type == "call_expression":
        out = _check_test_call(parsed, node) if parsed.role == "test" else []
        fb = _dot_catch_fallback_node(parsed.data, node)
        if fb is not None:
            out.append(make_finding(parsed, fb, "no-silent-fallback", _MSG_FALLBACK))
        return out
    if node.type == "await_expression":
        return _check_await_sleep(parsed, node, timer_aliases, fake_timers=fake_timers)
    if node.type == "catch_clause":
        fb = _block_trailing_empty_return(parsed.data, node.child_by_field_name("body"))
        if fb is not None:
            return [make_finding(parsed, fb, "no-silent-fallback", _MSG_FALLBACK)]
    return []


def check_jsts(parsed: ParsedFile) -> list[Finding]:
    timer_aliases = _timer_aliases(parsed.data, parsed.root)
    timer_aliases.update(_local_sleep_helpers(parsed.data, parsed.root, timer_aliases))
    fake_timers = _uses_fake_timers(parsed.data, parsed.root)
    findings: list[Finding] = []
    for node in walk(parsed.root):
        findings.extend(_check_js_node(parsed, node, timer_aliases, fake_timers=fake_timers))
    return findings
