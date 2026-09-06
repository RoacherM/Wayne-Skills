#!/usr/bin/env node
// okr CLI, bundled by scripts/build.mjs from github.com/RoacherM/Wayne-Skills — do not edit, edit src/.
import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str2) => str2.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str2, indent, comment) => str2.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str2.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str2) => /^(%|---|\.\.\.)/m.test(str2);
    function lineLengthOverLimit(str2, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str2.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str2[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json2 = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json2;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str2 = "";
      let start = 0;
      for (let i = 0, ch = json2[i]; ch; ch = json2[++i]) {
        if (ch === " " && json2[i + 1] === "\\" && json2[i + 2] === "n") {
          str2 += json2.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json2[i + 1]) {
            case "u":
              {
                str2 += json2.slice(start, i);
                const code = json2.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str2 += "\\0";
                    break;
                  case "0007":
                    str2 += "\\a";
                    break;
                  case "000b":
                    str2 += "\\v";
                    break;
                  case "001b":
                    str2 += "\\e";
                    break;
                  case "0085":
                    str2 += "\\N";
                    break;
                  case "00a0":
                    str2 += "\\_";
                    break;
                  case "2028":
                    str2 += "\\L";
                    break;
                  case "2029":
                    str2 += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str2 += "\\x" + code.substr(2);
                    else
                      str2 += json2.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json2[i + 2] === '"' || json2.length < minMultiLineLength) {
                i += 1;
              } else {
                str2 += json2.slice(start, i) + "\n\n";
                while (json2[i + 2] === "\\" && json2[i + 3] === "n" && json2[i + 4] !== '"') {
                  str2 += "\n";
                  i += 2;
                }
                str2 += indent;
                if (json2[i + 2] === " ")
                  str2 += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str2 = start ? str2 + json2.slice(start) : json2;
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str2 = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str2);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str2 = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str2;
      return identity.isScalar(node) || str2[0] === "{" || str2[0] === "[" ? `${props} ${str2}` : `${props}
${ctx.indent}${str2}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str2 = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str2.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str2 === "" ? "?" : explicitKey ? `? ${str2}` : str2;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str2 = `? ${str2}`;
        if (keyComment && !keyCommentDone) {
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str2;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        str2 = `? ${str2}
${indent}:`;
      } else {
        str2 = `${str2}:`;
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str2.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str2 += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str2;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str3 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str3 += stringifyComment.lineComment(str3, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str3);
      }
      let str2;
      if (lines.length === 0) {
        str2 = flowChars.start + flowChars.end;
      } else {
        str2 = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str2 += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str2 += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str2;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str2 = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str2.includes("\n"));
        if (i < items.length - 1) {
          str2 += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str2.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str2 += ",";
          }
        }
        if (comment)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment));
        lines.push(str2);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str2 = start;
          for (const line of lines)
            str2 += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str2}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str2) => str2,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str2) => new Scalar.Scalar(str2[0] === "t" || str2[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num2 = typeof value === "number" ? value : Number(value);
      if (!isFinite(num2))
        return isNaN(num2) ? ".nan" : num2 < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2),
      stringify(node) {
        const num2 = Number(node.value);
        return isFinite(num2) ? num2.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2));
        const dot = str2.indexOf(".");
        if (dot !== -1 && str2[str2.length - 1] === "0")
          node.minFractionDigits = str2.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str2, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str2) => str2,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str2) => str2 === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str2, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str2) => parseFloat(str2),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str2, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str2)}`);
        return str2;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str2 = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str2.length);
          for (let i = 0; i < str2.length; ++i)
            buffer[i] = str2.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str2;
        if (typeof node_buffer.Buffer === "function") {
          str2 = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str2 = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str2.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str2.substr(o, lineWidth);
          }
          str2 = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str2 }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2.replace(/_/g, "")),
      stringify(node) {
        const num2 = Number(node.value);
        return isFinite(num2) ? num2.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2.replace(/_/g, "")));
        const dot = str2.indexOf(".");
        if (dot !== -1) {
          const f = str2.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str2, offset, radix, { intAsBigInt }) {
      const sign = str2[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str2 = str2.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str2 = `0b${str2}`;
            break;
          case 8:
            str2 = `0o${str2}`;
            break;
          case 16:
            str2 = `0x${str2}`;
            break;
        }
        const n2 = BigInt(str2);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str2, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str2 = value.toString(radix);
        return value < 0 ? "-" + prefix + str2.substr(1) : prefix + str2;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str2, asBigInt) {
      const sign = str2[0];
      const parts = sign === "-" || sign === "+" ? str2.substring(1) : str2;
      const num2 = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num2(60) + num2(p), num2(0));
      return sign === "-" ? num2(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num2 = (n) => n;
      if (typeof value === "bigint")
        num2 = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num2(-1);
      }
      const _60 = num2(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str2, _onError, { intAsBigInt }) => parseSexagesimal(str2, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str2) => parseSexagesimal(str2, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str2) {
        const match = str2.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json: json2, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json2,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok2 = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok2 ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state2) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state2;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list2, type) {
      for (let i = 0; i < list2.length; ++i)
        if (list2[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list2) {
      for (let i = 0; i < list2.length; ++i) {
        switch (list2[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/cli.ts
var import_yaml3 = __toESM(require_dist(), 1);
import { existsSync as existsSync6, readFileSync as readFileSync5, statSync as statSync2 } from "node:fs";
import { basename as basename3, dirname as dirname2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/ansi.ts
var E = "\x1B[";
var reset = `${E}0m`;
var fg = (n) => `${E}38;5;${n}m`;
var bold = (s) => `${E}1m${s}${E}22m`;
var dim = (s) => `${E}2m${s}${E}22m`;
var color = (n, s) => `${fg(n)}${s}${E}39m`;
var inverse = (s) => `${E}7m${s}${E}27m`;
var GRAY = 245;
var RED = 203;
var GREEN = 41;
var AMBER = 214;
var PALETTE = [203, 75, 41, 214, 141, 44, 209, 111];
var goalColor = (i) => PALETTE[i % PALETTE.length];
var HEALTH = {
  "on-track": { sym: "\u25CF", c: GREEN, label: "\u6B63\u5E38" },
  "at-risk": { sym: "\u25B2", c: AMBER, label: "\u6709\u98CE\u9669" },
  behind: { sym: "\u25BC", c: RED, label: "\u843D\u540E" },
  done: { sym: "\u25C6", c: GREEN, label: "\u5B8C\u6210" },
  blocked: { sym: "\u25A0", c: RED, label: "\u963B\u585E" },
  idle: { sym: "\u25CB", c: GRAY, label: "\u505C\u6EDE" },
  frozen: { sym: "\u2744", c: GRAY, label: "\u51BB\u7ED3" },
  canceled: { sym: "\xD7", c: GRAY, label: "\u53D6\u6D88" }
};
var EVENT_SYM = {
  progress: "\u25CF",
  done: "\u25C6",
  blocked: "\u25A0",
  claim: "\u25B7",
  submit: "\u25C7",
  reject: "\u21A9",
  assess: "\u2248",
  change: "\u270E",
  plan: "\u2630",
  check: "\u2713",
  report: "\xB6"
};
var STAGE_SYM = {
  todo: { sym: "\u25CB", c: GRAY },
  doing: { sym: "\u25D0", c: 75 },
  blocked: { sym: "\u25A0", c: RED },
  review: { sym: "\u25C7", c: AMBER },
  done: { sym: "\u25C6", c: GREEN }
};
var KIND_ICON = { objective: "\u25CE", metric: "\u25A4", milestone: "\u2691", task: "\xB7", habit: "\u21BB" };
var FLAG_LABEL = {
  overdue: "\u5DF2\u903E\u671F",
  "due-soon": "\u5C06\u5230\u671F",
  blocked: "\u963B\u585E",
  stale: "\u505C\u6EDE",
  "review-stale": "\u5F85\u9A8C\u6536\u8D85\u65F6",
  claimed: "\u5DF2\u9886\u53D6",
  "carry-over": "\u9057\u7559"
};
function eventSym(type, c) {
  return type === "blocked" || type === "reject" ? color(RED, EVENT_SYM[type]) : color(c, EVENT_SYM[type]);
}
function healthTag(h) {
  const x = HEALTH[h];
  return color(x.c, `${x.sym} ${x.label}`);
}
function strip(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
function isWide(cp) {
  return cp >= 4352 && cp <= 4447 || cp >= 11904 && cp <= 42191 || cp >= 44032 && cp <= 55203 || cp >= 63744 && cp <= 64255 || cp >= 65072 && cp <= 65103 || cp >= 65280 && cp <= 65376 || cp >= 65504 && cp <= 65510 || cp >= 127744 && cp <= 129791 || cp >= 131072 && cp <= 262141;
}
function width(s) {
  let w = 0;
  for (const ch of strip(s)) w += isWide(ch.codePointAt(0)) ? 2 : 1;
  return w;
}
function pad(s, n, align = "left") {
  const w = width(s);
  if (w >= n) return s;
  const fill = " ".repeat(n - w);
  return align === "left" ? s + fill : fill + s;
}
function truncate(s, n) {
  if (width(s) <= n) return s;
  let out = "";
  let w = 0;
  const re = /(\x1b\[[0-9;]*m)|([\s\S])/gu;
  for (const m of s.matchAll(re)) {
    if (m[1]) {
      out += m[1];
      continue;
    }
    const cw = isWide(m[2].codePointAt(0)) ? 2 : 1;
    if (w + cw > n - 1) break;
    out += m[2];
    w += cw;
  }
  return out + "\u2026" + reset;
}
function bar(pct2, n, c) {
  const filled = Math.round(Math.max(0, Math.min(100, pct2)) / 100 * n);
  return color(c, "\u2588".repeat(filled)) + color(238, "\u2591".repeat(n - filled));
}
function rule(n) {
  return color(238, "\u2500".repeat(n));
}

// src/dates.ts
var DAY = 864e5;
function ms(d) {
  return Date.parse(d + "T00:00:00Z");
}
function iso(t) {
  return new Date(t).toISOString().slice(0, 10);
}
function two(n) {
  return String(n).padStart(2, "0");
}
function todayIso() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}
function nowIso(d = /* @__PURE__ */ new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}${sign}${two(Math.floor(a / 60))}:${two(a % 60)}`;
}
function parseTs(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (Number.isNaN(ms(s))) return null;
    const [y, m, d] = s.split("-").map(Number);
    return nowIso(new Date(y, m - 1, d, 12, 0, 0));
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return nowIso(new Date(t));
}
function isValidTs(s) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
function tsMs(ts) {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? Number.MIN_SAFE_INTEGER : t;
}
function sortEvents(events) {
  return events.map((e, i) => ({ e, i, t: tsMs(e.ts) })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.e);
}
function dayOf(ts) {
  return ts.slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((ms(dayOf(b)) - ms(dayOf(a))) / DAY);
}
function addDays(d, n) {
  return iso(ms(d) + n * DAY);
}
function weekStart(d) {
  const t = ms(d);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return iso(t - dow * DAY);
}
function monthStart(d) {
  return d.slice(0, 7) + "-01";
}
function nextMonth(d) {
  const y = +d.slice(0, 4);
  const m = +d.slice(5, 7);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${two(m + 1)}-01`;
}
function weekLabel(d) {
  const t = new Date(ms(d));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${two(week)}`;
}
function weekMonday(label) {
  const m = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!m) return null;
  const y = +m[1];
  const jan4 = Date.UTC(y, 0, 4);
  const mon1 = jan4 - (new Date(jan4).getUTCDay() + 6) % 7 * DAY;
  const monday = iso(mon1 + (+m[2] - 1) * 7 * DAY);
  return weekLabel(monday) === label ? monday : null;
}
function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s));
}
function isValidWeek(s) {
  return weekMonday(s) !== null;
}

// src/demo.ts
var DEMO_TODAY = "2026-09-03";
var DEMO_NODES = [
  { id: "o1", name: "\u63A8\u8350\u7CFB\u7EDF\u4E8C\u671F\u4E0A\u7EBF", kind: "objective", area: "\u5DE5\u4F5C", start: "2026-07-01", end: "2026-09-30" },
  { id: "kr1", name: "\u63A8\u8350\u6A21\u578B\u7CBE\u5EA6", kind: "metric", parent: "o1", unit: "%", from: 76, to: 95, start: "2026-07-01", end: "2026-09-30", weight: 2 },
  { id: "kr1.1", name: "\u7279\u5F81\u5DE5\u7A0B v2", kind: "task", parent: "kr1", priority: "P1", week: "2026-W34" },
  {
    id: "kr1.2",
    name: "\u7528\u6237\u5206\u7FA4\u7279\u5F81",
    kind: "task",
    parent: "kr1",
    priority: "P1",
    deadline: "2026-09-05",
    week: "2026-W36",
    order: 1,
    spec: {
      goal: "\u5728 recsys \u4ED3\u5E93 features/ \u4E0B\u52A0\u5165\u7528\u6237\u5206\u7FA4\u7279\u5F81\uFF0C\u4E0D\u52A8\u7EBF\u4E0A\u6253\u5206\u670D\u52A1",
      accept: ["\u79BB\u7EBF AUC \u63D0\u5347 \u2265 0.5pt", "\u7279\u5F81\u56DE\u586B\u811A\u672C\u53EF\u91CD\u8DD1", "\u65B0\u589E\u7279\u5F81\u6709\u5355\u6D4B"],
      verify: "make test && make eval",
      links: ["https://github.com/acme/recsys/issues/412"]
    }
  },
  {
    id: "kr1.3",
    name: "\u7279\u5F81 v3\uFF1A\u5B9E\u65F6\u5E8F\u5217",
    kind: "task",
    parent: "kr1",
    priority: "P2",
    deadline: "2026-09-12",
    deps: ["kr1.2"],
    week: "2026-W36",
    order: 2,
    spec: {
      goal: "\u63A5\u5165\u5B9E\u65F6\u884C\u4E3A\u5E8F\u5217\u7279\u5F81\uFF0C\u53EA\u6539 features/ \u548C train/\uFF0C\u4E0D\u52A8 serving",
      accept: ["\u5E8F\u5217\u7279\u5F81\u5728\u8BAD\u7EC3\u96C6\u8986\u76D6\u7387 > 90%", "\u8BAD\u7EC3\u8017\u65F6\u589E\u52A0 < 20%"],
      verify: "make test",
      links: ["docs/design/seq-features.md"]
    }
  },
  { id: "m1", name: "\u6570\u636E\u5E73\u53F0\u4E0A\u7EBF", kind: "milestone", parent: "o1", start: "2026-07-15", end: "2026-09-20" },
  { id: "m1.1", name: "\u6253\u901A\u6570\u636E\u56E2\u961F\u63A5\u53E3", kind: "task", parent: "m1", priority: "P0", deadline: "2026-09-01", week: "2026-W35" },
  { id: "m1.2", name: "\u7070\u5EA6\u53D1\u5E03\u65B9\u6848", kind: "task", parent: "m1", priority: "P1", week: "2026-W35", spec: { goal: "\u5199\u7070\u5EA6\u65B9\u6848\u6587\u6863", accept: ["\u8BC4\u5BA1\u901A\u8FC7"] } },
  { id: "m1.3", name: "\u76D1\u63A7\u770B\u677F", kind: "task", parent: "m1", priority: "P2" },
  { id: "kr2", name: "\u4ECA\u5E74\u8BFB\u5B8C 12 \u672C\u4E66", kind: "metric", area: "\u6210\u957F", unit: "\u672C", from: 0, to: 12, start: "2026-01-01", end: "2026-12-31" },
  { id: "h1", name: "\u6BCF\u5468\u8DD1\u6B65\u4E09\u6B21", kind: "habit", area: "\u5065\u5EB7", cadence: "3/week", start: "2026-07-01" },
  { id: "t1", name: "\u7EED\u7B7E\u57DF\u540D", kind: "task", area: "\u6742\u52A1", priority: "P3", deadline: "2026-09-04", week: "2026-W36", order: 3 },
  { id: "o0", name: "\u65E7\u9879\u76EE\u6536\u5C3E", kind: "objective", area: "\u5DE5\u4F5C", status: "canceled", start: "2026-05-01", end: "2026-06-30" }
];
var T = (d) => `${d}T10:00:00+08:00`;
var ev = (d, node, type, note, extra = {}) => ({
  ts: T(d),
  rec: T(d),
  node,
  type,
  note,
  by: "claude",
  ...extra
});
var DEMO_EVENTS = [
  ev("2026-07-01", null, "report", "\u521D\u59CB\u5316", { kind: "daily", by: void 0 }),
  ev("2026-07-08", "kr1", "progress", "\u57FA\u7EBF\u8DD1\u901A", { value: 76 }),
  ev("2026-07-20", "kr1.1", "progress", "\u7279\u5F81\u6E05\u5355\u786E\u5B9A"),
  ev("2026-08-05", "kr1.1", "progress", "\u7279\u5F81\u5DE5\u7A0B v2 \u8BAD\u7EC3\u5B8C\u6210"),
  ev("2026-08-06", "kr1", "progress", "v2 \u7279\u5F81\u4E0A\u7EBF\u79BB\u7EBF\u8BC4\u6D4B", { value: 82 }),
  ev("2026-08-14", "kr1.1", "done", "v2 \u5408\u5165\u4E3B\u5E72", { links: ["https://github.com/acme/recsys/pull/398"] }),
  ev("2026-08-20", "m1.1", "progress", "\u63A5\u53E3\u6587\u6863\u8BC4\u5BA1"),
  ev("2026-08-25", "m1.1", "blocked", "\u7B49\u6570\u636E\u56E2\u961F\u5F00\u63A5\u53E3\u6743\u9650"),
  ev("2026-08-26", "kr1.2", "claim", "\u9886\u53D6", { by: "codex", session: "wt-userseg" }),
  ev("2026-08-28", "kr1.2", "progress", "\u5206\u7FA4\u7279\u5F81\u56DE\u586B\u5B8C\u6210\uFF0CAUC +0.6", { by: "codex", session: "wt-userseg" }),
  ev("2026-08-31", "kr1", "progress", "\u5206\u7FA4\u7279\u5F81\u79BB\u7EBF\u8BC4\u6D4B", { value: 86 }),
  ev("2026-08-31", "kr1.2", "submit", "PR \u5DF2\u63D0", { by: "codex", session: "wt-userseg", links: ["https://github.com/acme/recsys/pull/421"] }),
  ev("2026-09-01", "o1", "assess", "kr1 \u5DF2\u5230 86\uFF0Cm1 \u88AB\u63A5\u53E3\u5361\u4F4F\u4E24\u5468\uFF0C\u6574\u4F53\u7565\u843D\u540E", { value: 45, derived: 41 }),
  ev("2026-09-01", null, "plan", "2026-W36 \u8BA1\u5212\u843D\u5730", { source: "2026-W36.plan.yaml", confirmed: true }),
  ev("2026-09-02", "kr2", "progress", "\u8BFB\u5B8C\u300A\u7CFB\u7EDF\u4E4B\u7F8E\u300B", { value: 7 }),
  ev("2026-07-02", "h1", "check", "\u6668\u8DD1 5km"),
  ev("2026-07-04", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-06", "h1", "check", "\u591C\u8DD1"),
  ev("2026-07-08", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-10", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-13", "h1", "check", "\u957F\u8DD1 10km"),
  ev("2026-07-15", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-17", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-22", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-25", "h1", "check", "\u6668\u8DD1"),
  ev("2026-07-26", "h1", "check", "\u591C\u8DD1"),
  ev("2026-08-03", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-05", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-08", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-11", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-13", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-15", "h1", "check", "\u957F\u8DD1"),
  ev("2026-08-18", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-21", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-23", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-25", "h1", "check", "\u6668\u8DD1"),
  ev("2026-08-27", "h1", "check", "\u6668\u8DD1"),
  ev("2026-09-01", "h1", "check", "\u6668\u8DD1")
];

// src/migrate.ts
var import_yaml2 = __toESM(require_dist(), 1);
import { existsSync as existsSync3, readFileSync as readFileSync3, renameSync as renameSync2, rmSync as rmSync3 } from "node:fs";

// src/store.ts
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
var import_yaml = __toESM(require_dist(), 1);
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
var DIR = process.env.OKR_DIR ?? join(homedir(), ".okr");
var NODES = join(DIR, "nodes.yaml");
var EVENTS = join(DIR, "events.jsonl");
var REPOS = join(DIR, "repos.yaml");
var REPORTS = join(DIR, "reports");
var LOGS = join(DIR, "logs");
var OLD_GOALS = join(DIR, "goals.yaml");
var GITIGNORE = ["# iCloud conflict copies and job logs never enter history", "* [0-9].*", "logs/", ""].join("\n");
function exists() {
  return existsSync(NODES);
}
function hasOldLayout() {
  return existsSync(OLD_GOALS) && !existsSync(NODES);
}
function init() {
  if (exists()) return { created: false };
  mkdirSync(REPORTS, { recursive: true });
  mkdirSync(LOGS, { recursive: true });
  writeFileSync(NODES, import_yaml.default.stringify({ nodes: [] }));
  if (!existsSync(EVENTS)) writeFileSync(EVENTS, "");
  if (!existsSync(REPOS)) writeFileSync(REPOS, import_yaml.default.stringify({ repos: [] }));
  writeFileSync(join(DIR, ".gitignore"), GITIGNORE);
  if (!existsSync(join(DIR, ".git"))) git(["init", "-q", "-b", "main"]);
  commit("init: okr tracking");
  return { created: true };
}
function loadNodes() {
  if (!exists()) return [];
  const doc = import_yaml.default.parse(readFileSync(NODES, "utf8")) ?? {};
  return doc.nodes ?? [];
}
function saveNodes(nodes) {
  atomicWrite(NODES, import_yaml.default.stringify({ nodes: nodes.map(cleanNode) }));
}
function cleanNode(n) {
  const out = {};
  for (const [k, v] of Object.entries(n)) if (v !== void 0 && v !== null && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  if (n.end === null) out.end = null;
  return out;
}
function loadEvents() {
  if (!existsSync(EVENTS)) return [];
  return sortEvents(
    readFileSync(EVENTS, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))
  );
}
function appendEvent(e) {
  appendFileSync(EVENTS, JSON.stringify(e) + "\n");
}
function rewriteEvents(events) {
  atomicWrite(EVENTS, events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
}
function loadRepos() {
  if (!existsSync(REPOS)) return [];
  const doc = import_yaml.default.parse(readFileSync(REPOS, "utf8")) ?? {};
  return doc.repos ?? [];
}
function saveRepos(repos) {
  atomicWrite(REPOS, import_yaml.default.stringify({ repos }));
}
function atomicWrite(path, content) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}
var LockTimeout = class extends Error {
};
var lockPath = () => join(tmpdir(), `okr-${createHash("sha1").update(DIR).digest("hex").slice(0, 12)}.lock`);
function withLock(fn, timeoutMs = 5e3) {
  const path = lockPath();
  const deadline = Date.now() + timeoutMs;
  for (; ; ) {
    try {
      const fd = openSync(path, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      let pid = 0;
      let age = 0;
      try {
        pid = Number(readFileSync(path, "utf8").trim()) || 0;
        age = Date.now() - statSync(path).mtimeMs;
      } catch (e2) {
        if (e2.code === "ENOENT") continue;
        throw e2;
      }
      if (pid && !alive(pid) || !pid && age > 2e3) {
        reclaim(path);
        continue;
      }
      if (Date.now() > deadline) throw new LockTimeout(`\u53E6\u4E00\u4E2A okr \u8FDB\u7A0B\uFF08pid ${pid || "?"}\uFF09\u6301\u6709\u5199\u9501\u8D85\u8FC7 ${timeoutMs / 1e3}s`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(path, { force: true });
  }
}
function reclaim(path) {
  const stale = `${path}.${process.pid}.stale`;
  try {
    renameSync(path, stale);
    rmSync(stale, { force: true });
  } catch {
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
function commit(msg) {
  if (!existsSync(join(DIR, ".git"))) return { committed: false, error: "no .git" };
  try {
    git(["add", "-A"]);
    if (!git(["status", "--porcelain"]).trim()) return { committed: true };
    git(["commit", "-q", "-m", msg]);
    return { committed: true };
  } catch (err) {
    return { committed: false, error: String(err.message).split("\n")[0] };
  }
}
function git(args2) {
  return execFileSync("git", ["-C", DIR, ...args2], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// src/validate.ts
import { existsSync as existsSync2, readdirSync, readFileSync as readFileSync2, rmSync as rmSync2 } from "node:fs";
import { join as join2, basename } from "node:path";

// src/types.ts
var STAGE_EVENTS = /* @__PURE__ */ new Set(["progress", "done", "blocked", "claim", "submit", "reject"]);
var KIND_LABEL = {
  objective: "\u76EE\u6807",
  metric: "\u6307\u6807",
  milestone: "\u91CC\u7A0B\u7891",
  task: "\u4EFB\u52A1",
  habit: "\u4E60\u60EF"
};
var STAGE_LABEL = {
  todo: "\u5F85\u529E",
  doing: "\u8FDB\u884C\u4E2D",
  blocked: "\u963B\u585E",
  review: "\u5F85\u9A8C\u6536",
  done: "\u5B8C\u6210"
};

// src/project.ts
var UPPER = /* @__PURE__ */ new Set(["objective", "metric", "milestone"]);
function isActive(n) {
  return (n.status ?? "active") === "active";
}
function project(nodes, events, today2) {
  const week = weekLabel(today2);
  const sorted = sortEvents(events);
  const seq = /* @__PURE__ */ new Map();
  sorted.forEach((e, i) => seq.set(e, i));
  const own = /* @__PURE__ */ new Map();
  for (const e of sorted) {
    if (!e.node) continue;
    if (!own.has(e.node)) own.set(e.node, []);
    own.get(e.node).push(e);
  }
  const byId = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    byId.set(n.id, {
      node: n,
      parent: null,
      children: [],
      depth: 0,
      effective: "active",
      events: own.get(n.id) ?? [],
      stage: "todo",
      derived: null,
      assess: null,
      progress: null,
      current: null,
      elapsed: null,
      health: "on-track",
      flags: [],
      last: null,
      lastInTree: null,
      daysSinceLast: null,
      blocked: null,
      claimed: null,
      planned: false,
      carryOver: false,
      dispatchable: false,
      undecomposed: 0
    });
  }
  const roots = [];
  for (const s of byId.values()) {
    const p = s.node.parent ? byId.get(s.node.parent) : void 0;
    if (p) {
      s.parent = p;
      p.children.push(s);
    } else roots.push(s);
  }
  const all = [];
  const walk = (s, depth, inherited) => {
    s.depth = depth;
    s.effective = effectiveStatus(s.node.status ?? "active", inherited);
    all.push(s);
    for (const c of s.children) walk(c, depth + 1, s.effective);
  };
  for (const r of roots) walk(r, 0, "active");
  const ctx = { today: today2, week, seq };
  for (const s of [...all].reverse()) deriveOne(s, ctx);
  for (const s of all) {
    s.dispatchable = s.node.kind === "task" && s.effective === "active" && s.stage !== "done" && specComplete(s.node) && (s.node.deps ?? []).every((d) => {
      const dep = byId.get(d);
      return !dep || dep.stage === "done" || dep.effective === "canceled";
    });
  }
  return { roots, all, byId, today: today2, week };
}
function effectiveStatus(own, inherited) {
  if (own === "canceled" || inherited === "canceled") return "canceled";
  if (own === "frozen" || inherited === "frozen") return "frozen";
  return "active";
}
function specComplete(n) {
  const sp = n.spec;
  return !!sp && !!sp.goal && !!sp.accept?.length && !!sp.verify && !!sp.links?.length;
}
function deriveOne(s, ctx) {
  const { today: today2, week, seq } = ctx;
  const n = s.node;
  const ev2 = s.events.filter((e) => dayOf(e.ts) <= today2);
  const stageEv = ev2.filter((e) => STAGE_EVENTS.has(e.type));
  s.stage = stageOf(stageEv);
  s.last = ev2.length ? ev2[ev2.length - 1] : null;
  s.lastInTree = s.last;
  for (const c of s.children) {
    if (!isActive(c.node)) continue;
    if (c.lastInTree && (!s.lastInTree || seq.get(c.lastInTree) > seq.get(s.lastInTree))) s.lastInTree = c.lastInTree;
  }
  s.daysSinceLast = s.last ? daysBetween(s.last.ts, today2) : null;
  const lastStage = stageEv[stageEv.length - 1];
  s.blocked = s.stage === "blocked" && lastStage ? { since: dayOf(lastStage.ts), note: lastStage.note } : null;
  const claimIdx = stageEv.findLastIndex((e) => e.type === "claim");
  const releaseIdx = stageEv.findLastIndex((e) => e.type === "submit" || e.type === "done" || e.type === "reject");
  const claim = claimIdx >= 0 && claimIdx > releaseIdx ? stageEv[claimIdx] : void 0;
  s.claimed = claim ? { by: claim.by ?? "?", session: claim.session, ts: claim.ts } : null;
  if (n.kind === "metric") {
    const v = [...ev2].reverse().find((e) => e.type === "progress" && typeof e.value === "number");
    s.current = v ? v.value : null;
  }
  const active = s.children.filter((c) => isActive(c.node));
  s.undecomposed = active.filter((c) => c.progress === null).length;
  if (s.stage === "done") s.derived = 1;
  else if (n.kind === "metric") {
    const from = n.from ?? 0;
    const to = n.to ?? 1;
    s.derived = to === from ? null : clamp(((s.current ?? from) - from) / (to - from));
  } else if (n.kind === "task" && !active.length) s.derived = s.stage === "review" ? 0.5 : 0;
  else if (n.kind === "habit") s.derived = null;
  else s.derived = weightedMean(active);
  const assess = [...ev2].reverse().find((e) => e.type === "assess" && typeof e.value === "number");
  if (assess && UPPER.has(n.kind)) {
    const stale = staleAfter(s, assess, ctx);
    s.assess = { value: clamp(assess.value / 100), ts: assess.ts, derived: typeof assess.derived === "number" ? assess.derived / 100 : null, note: assess.note, stale };
  }
  s.progress = s.assess && !s.assess.stale ? s.assess.value : s.derived;
  if (n.start && n.end) {
    const total = daysBetween(n.start, n.end);
    s.elapsed = total > 0 ? clamp(daysBetween(n.start, today2) / total) : 1;
  }
  s.planned = n.kind === "task" && n.week === week;
  s.carryOver = n.kind === "task" && !!n.week && n.week < week && s.stage !== "done" && s.effective === "active";
  if (n.kind === "habit") s.habit = habitStats(n, ev2, today2);
  s.flags = flagsOf(s, today2);
  s.health = healthOf(s, today2);
}
function stageOf(stageEv) {
  if (!stageEv.length) return "todo";
  const lastIdx = (t) => stageEv.findLastIndex((e) => e.type === t);
  const done = lastIdx("done");
  const reject = lastIdx("reject");
  if (done >= 0 && done > reject) return "done";
  if (stageEv[stageEv.length - 1].type === "blocked") return "blocked";
  const submit = lastIdx("submit");
  if (submit >= 0 && submit > reject) return "review";
  return "doing";
}
function staleAfter(s, assess, ctx) {
  const after = ctx.seq.get(assess);
  const hit = (x) => x.events.some(
    (e) => ctx.seq.get(e) > after && dayOf(e.ts) <= ctx.today && (e.type === "done" || e.type === "reject" || e.type === "submit" || e.type === "change")
  ) || x.children.some((c) => isActive(c.node) && hit(c));
  return hit(s);
}
function weightedMean(children) {
  let sum = 0;
  let w = 0;
  for (const c of children) {
    if (c.progress === null) continue;
    const cw = c.node.weight ?? 1;
    sum += c.progress * cw;
    w += cw;
  }
  return w ? sum / w : null;
}
function flagsOf(s, today2) {
  const n = s.node;
  const f = [];
  if (n.kind !== "task" || s.effective !== "active" || s.stage === "done") return f;
  if (n.deadline) {
    const left = daysBetween(today2, n.deadline);
    if (left < 0) f.push("overdue");
    else if (left <= 3) f.push("due-soon");
  }
  if (s.stage === "blocked") f.push("blocked");
  if ((s.stage === "doing" || s.stage === "blocked") && (s.daysSinceLast ?? 0) >= 7) f.push("stale");
  if (s.stage === "review" && (s.daysSinceLast ?? 0) > 3) f.push("review-stale");
  if (s.claimed) f.push("claimed");
  if (s.carryOver) f.push("carry-over");
  return f;
}
function healthOf(s, today2) {
  const n = s.node;
  if (s.effective === "canceled") return "canceled";
  if (s.effective === "frozen") return "frozen";
  if (s.stage === "done") return "done";
  if (s.stage === "blocked") return "blocked";
  if (n.kind === "habit" && s.habit) {
    const h = s.habit;
    if (h.thisPeriod >= h.times) return "on-track";
    if (h.period === "day") {
      const y = addDays(today2, -1);
      const since = n.start ?? [...h.days].sort()[0];
      return since && since <= y && !h.days.has(y) ? "behind" : "on-track";
    }
    return h.times - h.thisPeriod > daysLeft(h.period, today2) ? "behind" : "on-track";
  }
  if (n.kind === "task") {
    if (s.flags.includes("overdue")) return "behind";
    if (s.flags.includes("stale") || s.flags.includes("review-stale")) return "idle";
    return "on-track";
  }
  if (s.lastInTree && daysBetween(s.lastInTree.ts, today2) >= 14) return "idle";
  if (!s.lastInTree && n.start && daysBetween(n.start, today2) >= 14) return "idle";
  if (!n.end || s.elapsed === null || s.progress === null) return "on-track";
  const gap = s.progress - s.elapsed;
  if (gap >= -0.1) return "on-track";
  if (gap >= -0.25) return "at-risk";
  return "behind";
}
function daysLeft(period, today2) {
  if (period === "week") return daysBetween(today2, addDays(weekStart(today2), 7));
  return daysBetween(today2, nextMonth(monthStart(today2)));
}
function parseCadence(c) {
  if (!c) return null;
  if (c === "daily") return { times: 1, period: "day" };
  const m = /^(\d+)\/(week|month)$/.exec(c);
  return m ? { times: +m[1], period: m[2] } : null;
}
function habitStats(n, ev2, today2) {
  const cad = parseCadence(n.cadence) ?? { times: 1, period: "week" };
  const days = new Set(ev2.filter((e) => e.type === "check" || e.type === "progress").map((e) => dayOf(e.ts)));
  const periodOf = (d) => cad.period === "day" ? d : cad.period === "week" ? weekStart(d) : monthStart(d);
  const nextPeriod = (p2) => cad.period === "day" ? addDays(p2, 1) : cad.period === "week" ? addDays(p2, 7) : nextMonth(p2);
  const prevPeriod = (p2) => {
    if (cad.period === "day") return addDays(p2, -1);
    if (cad.period === "week") return addDays(p2, -7);
    return monthStart(addDays(p2, -1));
  };
  const count = /* @__PURE__ */ new Map();
  for (const d of days) {
    const p2 = periodOf(d);
    count.set(p2, (count.get(p2) ?? 0) + 1);
  }
  const cur = periodOf(today2);
  const thisPeriod = count.get(cur) ?? 0;
  let streak = 0;
  let p = thisPeriod >= cad.times ? cur : prevPeriod(cur);
  while ((count.get(p) ?? 0) >= cad.times) {
    streak++;
    p = prevPeriod(p);
  }
  void nextPeriod;
  return { period: cad.period, times: cad.times, thisPeriod, streak, total: days.size, days };
}
function clamp(x) {
  return Math.max(0, Math.min(1, x));
}
function progressAt(s, day) {
  const n = s.node;
  const ev2 = s.events.filter((e) => dayOf(e.ts) <= day);
  if (n.kind === "metric") {
    const v = [...ev2].reverse().find((e) => e.type === "progress" && typeof e.value === "number");
    const from = n.from ?? 0;
    const to = n.to ?? 1;
    if (stageOf(ev2.filter((e) => STAGE_EVENTS.has(e.type))) === "done") return 1;
    return to === from ? null : clamp(((v?.value ?? from) - from) / (to - from));
  }
  if (stageOf(ev2.filter((e) => STAGE_EVENTS.has(e.type))) === "done") return 1;
  if (!s.children.length) return n.kind === "task" && stageOf(ev2.filter((e) => STAGE_EVENTS.has(e.type))) === "review" ? 0.5 : 0;
  let sum = 0;
  let w = 0;
  for (const c of s.children) {
    if (!isActive(c.node)) continue;
    const p = progressAt(c, day);
    if (p === null) continue;
    sum += p * (c.node.weight ?? 1);
    w += c.node.weight ?? 1;
  }
  return w ? sum / w : null;
}
function velocity(t, weeks = 4) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(weekStart(t.today), -7 * i);
    const end = addDays(start, 7);
    const ids = [];
    let hours = 0;
    let anyHours = false;
    for (const s of t.all) {
      if (s.node.kind !== "task") continue;
      const d = [...s.events].reverse().find((e) => e.type === "done");
      if (!d || dayOf(d.ts) < start || dayOf(d.ts) >= end) continue;
      if (s.stage !== "done") continue;
      ids.push(s.node.id);
      for (const e of s.events) if (typeof e.hours === "number") hours += e.hours, anyHours = true;
    }
    out.push({ week: weekLabel(start), start, done: ids.length, hours: anyHours ? hours : null, ids });
  }
  return out;
}
function matchNode(nodes, q) {
  const exact = nodes.find((n) => n.id === q);
  if (exact) return { node: exact, candidates: [exact] };
  const lq = q.toLowerCase();
  const hits = nodes.filter((n) => n.id.toLowerCase().includes(lq) || n.name.toLowerCase().includes(lq) || (n.area ?? "").toLowerCase().includes(lq));
  return hits.length === 1 ? { node: hits[0], candidates: hits } : { candidates: hits };
}
function takenIds(nodes, events = []) {
  const taken = new Set(nodes.map((n) => n.id));
  for (const n of nodes) for (const d of n.deps ?? []) taken.add(d);
  for (const e of events) if (e.node) taken.add(e.node);
  return taken;
}
function newId(nodes, kind, parent, events = []) {
  const taken = takenIds(nodes, events);
  const prefix = parent ? `${parent}.` : { objective: "o", metric: "kr", milestone: "m", task: "t", habit: "h" }[kind];
  for (let i = 1; ; i++) {
    const id = `${prefix}${i}`;
    if (!taken.has(id)) return id;
  }
}
function descendants(s) {
  return s.children.flatMap((c) => [c, ...descendants(c)]);
}
function isAncestor(t, ancestor, id) {
  let cur = t.byId.get(id)?.parent ?? null;
  while (cur) {
    if (cur.node.id === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

// src/validate.ts
var KINDS = /* @__PURE__ */ new Set(["objective", "metric", "milestone", "task", "habit"]);
var STATUSES = /* @__PURE__ */ new Set(["active", "canceled", "frozen"]);
var TYPES = /* @__PURE__ */ new Set(["progress", "done", "blocked", "claim", "submit", "reject", "assess", "change", "plan", "check", "report"]);
var PRIORITIES = /* @__PURE__ */ new Set(["P0", "P1", "P2", "P3"]);
function validateData(nodes, events) {
  const errors = [];
  const warnings = [];
  const ids = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (!n.id) errors.push(`\u8282\u70B9\u7F3A id: ${JSON.stringify(n)}`);
    else if (ids.has(n.id)) errors.push(`id \u91CD\u590D: ${n.id}`);
    else ids.set(n.id, n);
  }
  for (const n of nodes) {
    const at = `\u8282\u70B9 ${n.id}`;
    if (!n.name) errors.push(`${at} \u7F3A name`);
    if (!KINDS.has(n.kind)) errors.push(`${at} kind \u975E\u6CD5: ${n.kind}`);
    if (n.status && !STATUSES.has(n.status)) errors.push(`${at} status \u975E\u6CD5: ${n.status}`);
    if (n.parent && !ids.has(n.parent)) errors.push(`${at} parent \u4E0D\u5B58\u5728: ${n.parent}`);
    for (const k of ["start", "end", "deadline"]) if (n[k] && !isValidDate(n[k])) errors.push(`${at} ${k} \u4E0D\u662F\u65E5\u671F: ${n[k]}`);
    if (n.start && n.end && n.end < n.start) errors.push(`${at} end \u65E9\u4E8E start`);
    if (n.kind === "metric") {
      if (typeof n.from !== "number" || typeof n.to !== "number") errors.push(`${at} metric \u9700\u8981 from / to`);
      else if (n.from === n.to) errors.push(`${at} from \u4E0E to \u76F8\u7B49`);
    }
    if (n.kind === "habit" && !parseCadence(n.cadence)) errors.push(`${at} cadence \u975E\u6CD5: ${n.cadence}\uFF08N/week | daily | N/month\uFF09`);
    if (n.kind !== "task") {
      for (const k of ["priority", "deadline", "deps", "week", "order", "spec"])
        if (n[k] !== void 0) warnings.push(`${at} \u662F ${n.kind}\uFF0C\u5B57\u6BB5 ${k} \u53EA\u5BF9 task \u6709\u610F\u4E49`);
    } else {
      if (n.priority && !PRIORITIES.has(n.priority)) errors.push(`${at} priority \u975E\u6CD5: ${n.priority}`);
      if (n.week && !isValidWeek(n.week)) errors.push(`${at} week \u975E\u6CD5: ${n.week}`);
      if (n.end !== void 0) warnings.push(`${at} task \u7528 deadline\uFF0C\u4E0D\u7528 end`);
      for (const d of n.deps ?? []) {
        const dep = ids.get(d);
        if (!dep) errors.push(`${at} \u4F9D\u8D56\u4E0D\u5B58\u5728: ${d}`);
        else if (d === n.id) errors.push(`${at} \u4F9D\u8D56\u81EA\u5DF1`);
        else if (dep.status === "canceled") warnings.push(`${at} \u4F9D\u8D56 ${d} \u5DF2\u53D6\u6D88\uFF0C\u89C6\u4E3A\u5DF2\u6EE1\u8DB3`);
      }
    }
    const seen = /* @__PURE__ */ new Set([n.id]);
    let p = n.parent;
    while (p) {
      if (seen.has(p)) {
        errors.push(`${at} \u7684\u7956\u5148\u94FE\u6210\u73AF`);
        break;
      }
      seen.add(p);
      p = ids.get(p)?.parent;
    }
  }
  const explored = /* @__PURE__ */ new Set();
  const reported = /* @__PURE__ */ new Set();
  const dfs = (id, path) => {
    if (explored.has(id)) return;
    const i = path.indexOf(id);
    if (i >= 0) {
      const cyc = path.slice(i);
      const key = [...cyc].sort().join(",");
      if (!reported.has(key)) {
        reported.add(key);
        errors.push(`\u4F9D\u8D56\u6210\u73AF: ${[...cyc, id].join(" \u2192 ")}`);
      }
      return;
    }
    for (const d of ids.get(id)?.deps ?? []) if (d !== id) dfs(d, [...path, id]);
    explored.add(id);
  };
  for (const n of nodes) dfs(n.id, []);
  events.forEach((e, i) => {
    const at = `\u4E8B\u4EF6 #${i + 1}`;
    if (!TYPES.has(e.type)) errors.push(`${at} type \u975E\u6CD5: ${e.type}`);
    if (!e.ts || !isValidTs(e.ts)) errors.push(`${at} ts \u975E\u6CD5: ${e.ts}\uFF08\u8981\u672C\u5730\u65F6\u95F4\u52A0\u6570\u5B57\u65F6\u533A\uFF0C\u5982 2026-09-03T20:45:12+08:00\uFF09`);
    else if (e.rec && !isValidTs(e.rec)) warnings.push(`${at} rec \u683C\u5F0F\u4E0D\u5BF9: ${e.rec}`);
    if (e.type === "plan" || e.type === "report") {
      if (e.node) warnings.push(`${at} ${e.type} \u4E8B\u4EF6\u4E0D\u5E94\u6709 node`);
    } else if (!e.node) errors.push(`${at} ${e.type} \u7F3A node`);
    else if (!ids.has(e.node)) (e.type === "change" ? warnings : errors).push(`${at} node \u4E0D\u5B58\u5728: ${e.node}${e.type === "change" ? "\uFF08\u5DF2\u5220\u9664\u8282\u70B9\u7684\u53D8\u66F4\u8BB0\u5F55\uFF09" : ""}`);
    if (e.type === "assess" && !e.note) errors.push(`${at} assess \u7F3A\u7406\u7531`);
    if (e.type === "submit" && !e.links?.length) errors.push(`${at} submit \u7F3A links`);
  });
  return { errors, warnings };
}
var EVENT_COPY = /^events \d+\.jsonl$/;
function validateDir() {
  const errors = [];
  const warnings = [];
  if (!existsSync2(DIR)) return { errors: [`\u76EE\u5F55\u4E0D\u5B58\u5728: ${DIR}`], warnings };
  for (const f of readdirSync(DIR)) {
    if (f.endsWith(".icloud")) errors.push(`iCloud \u5360\u4F4D\u6587\u4EF6\uFF08\u5185\u5BB9\u672A\u4E0B\u8F7D\uFF09: ${f}`);
    if (/ \d+\.(yaml|jsonl)$/.test(f)) {
      if (EVENT_COPY.test(f)) errors.push(`iCloud \u51B2\u7A81\u526F\u672C: ${f}\uFF08validate --merge-events \u53EF\u5E76\u5165\uFF09`);
      else errors.push(`iCloud \u51B2\u7A81\u526F\u672C: ${f}\uFF08\u9700\u624B\u5DE5\u6BD4\u5BF9\u540E\u5220\u9664\uFF09`);
    }
  }
  if (existsSync2(EVENTS)) {
    readFileSync2(EVENTS, "utf8").split("\n").forEach((l, i) => {
      if (!l.trim()) return;
      try {
        JSON.parse(l);
      } catch {
        errors.push(`events.jsonl \u7B2C ${i + 1} \u884C\u4E0D\u662F\u5408\u6CD5 JSON`);
      }
    });
  }
  if (existsSync2(join2(DIR, ".git"))) {
    try {
      git(["fsck", "--no-dangling", "--no-progress"]);
    } catch (err) {
      errors.push(`git fsck \u5931\u8D25: ${firstLine(err)}`);
    }
    try {
      const st = git(["status", "--porcelain"]).trim();
      if (st) errors.push(`git \u5DE5\u4F5C\u533A\u4E0D\u5E72\u51C0\uFF08\u6709\u9759\u9ED8\u5931\u8D25\u7684 commit\uFF1F\uFF09:
${st}`);
    } catch (err) {
      errors.push(`git status \u5931\u8D25: ${firstLine(err)}`);
    }
  } else warnings.push("\u6CA1\u6709 .git\uFF0C\u6CA1\u6709\u5386\u53F2\u5907\u4EFD");
  return { errors, warnings };
}
function mergeEventFiles() {
  if (!existsSync2(DIR)) return [];
  return readdirSync(DIR).filter((f) => EVENT_COPY.test(f)).sort().map((f) => mergeEventFile(join2(DIR, f)));
}
function firstLine(err) {
  return String(err.message).split("\n")[0];
}
function mergeEventFile(path) {
  const name = basename(path);
  const errors = [];
  const extra = [];
  readFileSync2(path, "utf8").split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let e;
    try {
      e = JSON.parse(line);
    } catch (err) {
      errors.push(`${name} \u7B2C ${i + 1} \u884C\u4E0D\u662F\u5408\u6CD5 JSON: ${firstLine(err)}`);
      return;
    }
    if (!e || typeof e !== "object" || typeof e.ts !== "string") {
      errors.push(`${name} \u7B2C ${i + 1} \u884C\u7F3A ts`);
      return;
    }
    const ts = parseTs(e.ts);
    if (!ts) {
      errors.push(`${name} \u7B2C ${i + 1} \u884C ts \u65E0\u6CD5\u89E3\u6790: ${e.ts}`);
      return;
    }
    e.ts = ts;
    if (typeof e.rec === "string") e.rec = parseTs(e.rec) ?? ts;
    else e.rec = ts;
    extra.push(e);
  });
  if (errors.length) return { file: path, added: 0, skipped: 0, errors };
  const main = loadEvents();
  const key = (e) => `${e.ts} ${e.node ?? ""} ${e.type} ${e.note}`;
  const have = new Set(main.map(key));
  let added = 0;
  let skipped = 0;
  for (const e of extra) {
    if (have.has(key(e))) skipped++;
    else {
      main.push(e);
      have.add(key(e));
      added++;
    }
  }
  const merged = sortEvents(main);
  const bare = (x) => x.replace(/^事件 #\d+ /, "");
  const nodes = loadNodes();
  const before = new Set(validateData(nodes, main.slice(0, main.length - added)).errors.map(bare));
  const fresh = validateData(nodes, merged).errors.map(bare).filter((x) => !before.has(x));
  if (fresh.length) return { file: path, added: 0, skipped: 0, errors: fresh.map((x) => `${name} \u5E76\u5165\u540E: ${x}`) };
  rewriteEvents(merged);
  rmSync2(path);
  return { file: path, added, skipped, errors: [] };
}

// src/migrate.ts
var MigrateError = class extends Error {
  errors;
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
};
function migrate() {
  if (!existsSync3(OLD_GOALS)) throw new Error(`\u6CA1\u6709 ${OLD_GOALS}\uFF0C\u65E0\u9700\u8FC1\u79FB`);
  if (exists()) throw new Error(`${NODES} \u5DF2\u5B58\u5728\uFF0C\u4E0D\u4F1A\u8986\u76D6`);
  const goals = (import_yaml2.default.parse(readFileSync3(OLD_GOALS, "utf8")) ?? {}).goals ?? [];
  const old = existsSync3(EVENTS) ? readFileSync3(EVENTS, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const nodes = goals.map((g) => {
    const n = { id: g.id, name: g.name, kind: g.kind, area: g.area, start: g.start };
    if (g.end) n.end = g.end;
    if (g.weight !== void 0) n.weight = g.weight;
    if (g.status === "canceled" || g.status === "frozen") n.status = g.status;
    if (g.kind === "metric" && g.metric) {
      n.unit = g.metric.unit;
      n.from = g.metric.base;
      n.to = g.metric.target;
    }
    if (g.kind === "habit") n.cadence = `${g.habit?.times ?? 1}/week`;
    return n;
  });
  const warnings = [];
  const events = [];
  old.forEach((e, i) => {
    const at = `\u65E7\u4E8B\u4EF6 #${i + 1}\uFF08${e.ts} ${e.goal} ${e.type}\uFF09`;
    const goal = goals.find((g) => g.id === e.goal);
    if (!goal) {
      warnings.push(`${at} \u6307\u5411\u4E0D\u5B58\u5728\u7684 goal\uFF0C\u5DF2\u8DF3\u8FC7`);
      return;
    }
    const ts = parseTs(e.ts);
    if (!ts) {
      warnings.push(`${at} \u65F6\u95F4\u65E0\u6CD5\u89E3\u6790\uFF0C\u5DF2\u8DF3\u8FC7`);
      return;
    }
    if (goal.kind === "habit" && e.type === "blocked") {
      warnings.push(`${at} \u4E60\u60EF\u6CA1\u6709\u963B\u585E\uFF0C\u5DF2\u8DF3\u8FC7`);
      return;
    }
    const type = goal.kind === "habit" && e.type === "progress" ? "check" : e.type;
    const out = { ts, rec: ts, node: e.goal, type, note: e.scope ? `${e.scope}: ${e.note}` : e.note };
    if (typeof e.value === "number") out.value = e.value;
    events.push(out);
  });
  for (const g of goals) {
    if (g.status !== "done") continue;
    const own = sortEvents(events.filter((e) => e.node === g.id));
    if (own.some((e) => e.type === "done")) continue;
    const ts = own.length ? own[own.length - 1].ts : parseTs(g.end ?? g.start) ?? nowIso();
    events.push({ ts, rec: ts, node: g.id, type: "done", note: "\uFF08\u8FC1\u79FB\uFF1A\u65E7 status: done\uFF09", confirmed: true });
  }
  const now = nowIso();
  events.push({ ts: now, rec: now, node: null, type: "report", kind: "daily", note: "\u8FC1\u79FB\u5B8C\u6210\uFF0C\u4F5C\u4E3A changes / commits \u7684\u521D\u59CB\u951A\u70B9" });
  const sorted = sortEvents(events);
  const v = validateData(nodes, sorted);
  if (v.errors.length) throw new MigrateError(v.errors);
  warnings.push(...v.warnings);
  const hadEvents = existsSync3(EVENTS);
  if (hadEvents) renameSync2(EVENTS, EVENTS + ".migrated");
  renameSync2(OLD_GOALS, OLD_GOALS + ".migrated");
  try {
    init();
    saveNodes(nodes);
    rewriteEvents(sorted);
  } catch (err) {
    try {
      if (existsSync3(NODES)) rmSync3(NODES);
      if (hadEvents) renameSync2(EVENTS + ".migrated", EVENTS);
      else if (existsSync3(EVENTS)) rmSync3(EVENTS);
      renameSync2(OLD_GOALS + ".migrated", OLD_GOALS);
    } catch {
    }
    throw err;
  }
  return { nodes, events: sorted, warnings };
}

// src/plan.ts
import { execFileSync as execFileSync2 } from "node:child_process";
import { existsSync as existsSync4, readdirSync as readdirSync2 } from "node:fs";
import { basename as basename2, join as join3 } from "node:path";
var PLAN_FILE = /^(\d{4}-W\d{2})\.plan(?:-\d+)?\.yaml$/;
function proposalFiles(reportsDir, week, events) {
  if (!existsSync4(reportsDir)) return [];
  const plans = sortEvents(events.filter((e) => e.type === "plan" && e.source));
  return readdirSync2(reportsDir).filter((f) => PLAN_FILE.test(f) && f.startsWith(week + ".")).sort().map((file) => {
    const last = [...plans].reverse().find((e) => e.source === file);
    return { file, path: join3(reportsDir, file), week, status: !last ? "pending" : last.dismissed ? "dismissed" : "applied", ts: last?.ts ?? null, by: last?.by };
  });
}
function proposalStatus(files) {
  if (!files.length) return "none";
  if (files.some((f) => f.status === "pending")) return "pending";
  if (files.some((f) => f.status === "applied")) return "applied";
  return "dismissed";
}
function taskFacts(s, today2) {
  const n = s.node;
  const path = [];
  for (let p = s.parent; p; p = p.parent) path.unshift(p.node.id);
  return {
    id: n.id,
    name: n.name,
    path,
    parent: n.parent ?? null,
    stage: s.stage,
    priority: n.priority ?? null,
    deadline: n.deadline ?? null,
    daysLeft: n.deadline ? daysBetween(today2, n.deadline) : null,
    week: n.week ?? null,
    order: typeof n.order === "number" ? n.order : null,
    flags: s.flags,
    daysSinceLast: s.daysSinceLast,
    blocked: s.blocked,
    claimed: s.claimed,
    planned: s.planned,
    carryOver: s.carryOver,
    dispatchable: s.dispatchable
  };
}
var activeTasks = (t) => t.all.filter((s) => s.node.kind === "task" && s.effective === "active");
function byOrder(a, b) {
  const ao = typeof a.node.order === "number" ? a.node.order : Number.POSITIVE_INFINITY;
  const bo = typeof b.node.order === "number" ? b.node.order : Number.POSITIVE_INFINITY;
  return ao - bo || a.node.id.localeCompare(b.node.id);
}
function weekView(t, events, reportsDir, label = t.week) {
  const start = weekMonday(label);
  const planned = activeTasks(t).filter((s) => s.node.week === label).sort(byOrder).map((s) => taskFacts(s, t.today));
  const carryOver = activeTasks(t).filter((s) => s.stage !== "done" && !!s.node.week && s.node.week < label).sort(byOrder).map((s) => taskFacts(s, t.today));
  const proposals = proposalFiles(reportsDir, label, events);
  return { week: label, start, end: addDays(start, 6), current: label === t.week, planned, carryOver, proposal: proposalStatus(proposals), proposals };
}
function brief(t, events, reportsDir) {
  const tasks = activeTasks(t).filter((s) => s.stage !== "done");
  const withFlag = (f) => tasks.filter((s) => s.flags.includes(f)).map((s) => taskFacts(s, t.today));
  const behind = t.all.filter((s) => s.node.kind !== "task" && s.node.kind !== "habit" && s.effective === "active" && (s.health === "at-risk" || s.health === "behind" || s.health === "idle")).map((s) => ({
    id: s.node.id,
    name: s.node.name,
    kind: s.node.kind,
    health: s.health,
    progress: s.progress,
    elapsed: s.elapsed,
    daysQuiet: s.lastInTree ? daysBetween(s.lastInTree.ts, t.today) : null
  }));
  const b = {
    today: t.today,
    week: t.week,
    overdue: withFlag("overdue"),
    dueSoon: withFlag("due-soon"),
    blocked: withFlag("blocked"),
    stale: withFlag("stale"),
    reviewStale: withFlag("review-stale"),
    claimed: withFlag("claimed"),
    behind,
    proposals: proposalFiles(reportsDir, t.week, events).filter((f) => f.status === "pending"),
    empty: false
  };
  b.empty = !b.overdue.length && !b.dueSoon.length && !b.blocked.length && !b.stale.length && !b.reviewStale.length && !b.claimed.length && !b.behind.length && !b.proposals.length;
  return b;
}
function specMissing(n) {
  const sp = n.spec ?? {};
  const m = [];
  if (!sp.goal) m.push("goal");
  if (!sp.accept?.length) m.push("accept");
  if (!sp.verify) m.push("verify");
  if (!sp.links?.length) m.push("links");
  return m;
}
function candidates(t, opts = {}) {
  const dependents = /* @__PURE__ */ new Map();
  for (const s of t.all) for (const d of s.node.deps ?? []) dependents.set(d, [...dependents.get(d) ?? [], s.node.id]);
  const prio = (p) => p ? Number(p.slice(1)) : 9;
  return activeTasks(t).filter((s) => s.stage !== "done" && (!opts.dispatchable || s.dispatchable)).map((s) => {
    let up = s.parent;
    while (up && (up.node.kind === "task" || up.node.kind === "habit")) up = up.parent;
    const deps = (s.node.deps ?? []).map((d) => {
      const dep = t.byId.get(d);
      return { id: d, name: dep?.node.name ?? "?", done: !!dep && (dep.stage === "done" || dep.effective === "canceled") };
    });
    return {
      ...taskFacts(s, t.today),
      weight: s.node.weight ?? 1,
      upper: up ? { id: up.node.id, name: up.node.name, health: up.health, progress: up.progress, elapsed: up.elapsed, gap: up.progress !== null && up.elapsed !== null ? Math.round((up.progress - up.elapsed) * 100) / 100 : null } : null,
      deps,
      depsOpen: deps.filter((d) => !d.done).length,
      dependents: dependents.get(s.node.id) ?? [],
      specMissing: specMissing(s.node)
    };
  }).sort((a, b) => prio(a.priority) - prio(b.priority) || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.id.localeCompare(b.id));
}
function resolveSince(events, spec) {
  if (spec === "last-daily" || spec === "last-weekly") {
    const kind = spec === "last-daily" ? "daily" : "weekly";
    const anchor = [...sortEvents(events)].reverse().find((e) => e.type === "report" && e.kind === kind) ?? null;
    return { spec, since: anchor ? anchor.rec ?? anchor.ts : null, anchor };
  }
  if (isValidDate(spec)) {
    const [y, m, d] = spec.split("-").map(Number);
    return { spec, since: nowIso(new Date(y, m - 1, d, 0, 0, 0)), anchor: null };
  }
  const ts = parseTs(spec);
  return ts ? { spec, since: ts, anchor: null } : null;
}
function changes(events, since) {
  const cut = since ? tsMs(since) : Number.NEGATIVE_INFINITY;
  return sortEvents(events.filter((e) => e.type !== "report" && e.type !== "plan" && tsMs(e.rec ?? e.ts) > cut)).reverse();
}
function repoCommits(repos, since, limit = 200, run = gitLog) {
  return repos.map((r) => {
    const base = { path: r.path, node: r.node ?? null, commits: [] };
    if (!existsSync4(r.path)) return { ...base, error: "\u76EE\u5F55\u4E0D\u5B58\u5728" };
    if (!existsSync4(join3(r.path, ".git"))) return { ...base, error: "\u4E0D\u662F git \u4ED3\u5E93" };
    try {
      const out = run(r.path, since, limit);
      base.commits = out.split("\n").filter(Boolean).map((l) => {
        const [hash, author, date, subject] = l.split("");
        return { hash, author, date, subject };
      });
      return base;
    } catch (err) {
      return { ...base, error: String(err.message).split("\n")[0] };
    }
  });
}
function gitLog(path, since, limit) {
  const args2 = ["-C", path, "log", "--no-merges", `--max-count=${limit}`, "--format=%h%an%aI%s"];
  if (since) args2.push(`--since=${since}`);
  return execFileSync2("git", args2, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
var PlanError = class extends Error {
  code;
  extra;
  constructor(msg, code = 1, extra = {}) {
    super(msg);
    this.code = code;
    this.extra = extra;
  }
};
var KINDS2 = ["objective", "metric", "milestone", "task", "habit"];
var PRIORITIES2 = ["P0", "P1", "P2", "P3"];
var NEW_REF = /^new:(\d+)$/;
function applyPlan(nodes, events, t, file) {
  if (typeof file !== "object" || file === null || Array.isArray(file)) throw new PlanError("plan.yaml \u9876\u5C42\u8981\u662F\u4E00\u4E2A\u6620\u5C04");
  const week = file.week ?? t.week;
  if (!isValidWeek(week)) throw new PlanError(`week \u683C\u5F0F\uFF1A2026-W36\uFF0C\u5F97\u5230 "${week}"`);
  const warnings = [];
  if (week < t.week) warnings.push(`\u8BA1\u5212\u7684\u5468 ${week} \u65E9\u4E8E\u672C\u5468 ${t.week}`);
  for (const k of Object.keys(file)) if (!["week", "new", "plan", "drop"].includes(k)) throw new PlanError(`plan.yaml \u4E0D\u8BA4\u8BC6\u7684\u5B57\u6BB5: ${k}`);
  const newList = file.new ?? [];
  const planList = file.plan ?? [];
  const dropList = file.drop ?? [];
  if (!Array.isArray(newList) || !Array.isArray(planList) || !Array.isArray(dropList)) throw new PlanError("new / plan / drop \u90FD\u8981\u662F\u5217\u8868");
  if (!newList.length && !planList.length && !dropList.length) throw new PlanError("plan.yaml \u91CC\u6CA1\u6709 new / plan / drop\uFF0C\u6CA1\u4E8B\u53EF\u505A");
  const all = nodes.map((n) => ({ ...n }));
  const byId = new Map(all.map((n) => [n.id, n]));
  const notes = [];
  const created = [];
  const newIds = [];
  newList.forEach((item, i) => {
    if (typeof item !== "object" || item === null) throw new PlanError(`new[${i}] \u8981\u662F\u4E00\u4E2A\u6620\u5C04`);
    if (!item.name || typeof item.name !== "string") throw new PlanError(`new[${i}] \u7F3A name`);
    const kind = item.kind ?? "task";
    if (!KINDS2.includes(kind)) throw new PlanError(`new[${i}] kind \u975E\u6CD5: ${kind}`);
    if (item.id !== void 0) {
      if (!/^[A-Za-z0-9][\w.-]*$/.test(item.id)) throw new PlanError(`new[${i}] id \u53EA\u80FD\u7528\u5B57\u6BCD\u6570\u5B57 . _ -\uFF1A${item.id}`);
      if (byId.has(item.id) || newIds.includes(item.id)) throw new PlanError(`new[${i}] \u8282\u70B9 ${item.id} \u5DF2\u5B58\u5728`);
      if (takenIds(all, events).has(item.id)) throw new PlanError(`new[${i}] ${item.id} \u5728\u4E8B\u4EF6\u5386\u53F2\u6216 deps \u91CC\u51FA\u73B0\u8FC7\uFF0Cid \u4E0D\u80FD\u590D\u7528`);
    }
    newIds.push(item.id ?? "");
  });
  const ref = (x, where) => {
    if (typeof x !== "string") throw new PlanError(`${where} \u8981\u662F\u8282\u70B9 id \u6216 new:N\uFF0C\u5F97\u5230 ${JSON.stringify(x)}`);
    const m = NEW_REF.exec(x);
    if (!m) return x;
    const i = Number(m[1]);
    if (i >= newList.length) throw new PlanError(`${where} \u5F15\u7528 ${x}\uFF0C\u4F46 new \u53EA\u6709 ${newList.length} \u9879\uFF08\u4E0B\u6807\u4ECE 0 \u8D77\uFF09`);
    return newIds[i];
  };
  newList.forEach((item, i) => {
    const kind = item.kind ?? "task";
    const parentRef = item.parent ?? null;
    let parent = null;
    if (parentRef) {
      const m = NEW_REF.exec(parentRef);
      if (m && Number(m[1]) >= i) throw new PlanError(`new[${i}] \u7684 parent ${parentRef} \u5FC5\u987B\u662F\u6392\u5728\u5B83\u524D\u9762\u7684 new \u9879`);
      parent = m ? newIds[Number(m[1])] : parentRef;
      if (!byId.has(parent)) throw new PlanError(`new[${i}] parent \u4E0D\u5B58\u5728: ${parent}`);
    }
    const id = item.id || newId(all, kind, parent, events);
    newIds[i] = id;
    const node = { id, name: item.name, kind };
    if (parent) node.parent = parent;
    const copy = (k) => {
      const v = item[k];
      if (v !== void 0 && v !== null) node[k] = v;
    };
    for (const k of ["area", "status", "start", "end", "weight", "unit", "from", "to", "cadence", "priority", "deadline", "order"]) copy(k);
    if (item.spec && typeof item.spec === "object") node.spec = item.spec;
    if (item.deps) node.deps = item.deps.map((d, j) => ref(d, `new[${i}].deps[${j}]`));
    if (node.priority && !PRIORITIES2.includes(node.priority)) throw new PlanError(`new[${i}] priority \u53EA\u80FD\u662F P0\u2013P3`);
    if (node.deadline && !isValidDate(node.deadline)) throw new PlanError(`new[${i}] deadline \u9700\u8981 YYYY-MM-DD`);
    if (kind === "metric" && (typeof node.from !== "number" || typeof node.to !== "number")) throw new PlanError(`new[${i}] metric \u9700\u8981 unit / from / to`);
    if (kind === "habit" && !node.cadence) node.cadence = "1/week";
    if (kind !== "task" && kind !== "habit" && !node.start) node.start = t.today;
    if (kind !== "task") {
      for (const k of ["priority", "deadline", "deps", "week", "order", "spec"]) if (k in node) throw new PlanError(`new[${i}] ${k} \u53EA\u5BF9 task \u6709\u610F\u4E49`);
    }
    all.push(node);
    byId.set(id, node);
    created.push(node);
  });
  for (const n of created) for (const d of n.deps ?? []) if (!byId.has(d)) throw new PlanError(`${n.id} \u7684\u4F9D\u8D56\u4E0D\u5B58\u5728: ${d}`);
  const planIds = planList.map((x, i) => ref(x, `plan[${i}]`));
  const dropIds = dropList.map((x, i) => ref(x, `drop[${i}]`));
  const dupe = planIds.find((x, i) => planIds.indexOf(x) !== i);
  if (dupe) throw new PlanError(`plan \u91CC ${dupe} \u51FA\u73B0\u4E86\u4E24\u6B21`);
  const both = planIds.filter((x) => dropIds.includes(x));
  if (both.length) throw new PlanError(`${both.join(", ")} \u540C\u65F6\u5728 plan \u548C drop \u91CC`);
  const stateOf = (id) => t.byId.get(id);
  for (const id of planIds) {
    const n = byId.get(id);
    if (!n) throw new PlanError(`plan \u91CC\u7684\u8282\u70B9\u4E0D\u5B58\u5728: ${id}`, 1, { candidates: [] });
    if (n.kind !== "task") throw new PlanError(`${id} \u662F${n.kind}\uFF0C\u53EA\u6709 task \u80FD\u6392\u8FDB\u5468\u8BA1\u5212`, 3);
    const s = stateOf(id);
    if (s && s.stage === "done") throw new PlanError(`${id} \u5DF2\u5B8C\u6210\uFF0C\u4E0D\u80FD\u6392\u8FDB ${week}`, 3);
    if (s && s.effective !== "active") throw new PlanError(`${id} \u5DF2${s.effective === "canceled" ? "\u53D6\u6D88" : "\u51BB\u7ED3"}\uFF08\u81EA\u8EAB\u6216\u7956\u5148\uFF09\uFF0C\u4E0D\u80FD\u6392\u8FDB ${week}`, 3);
    if (!s && created.some((c) => c.id === id) && (n.status ?? "active") !== "active") throw new PlanError(`${id} \u72B6\u6001\u4E0D\u662F active\uFF0C\u4E0D\u80FD\u6392\u8FDB ${week}`, 3);
  }
  for (const id of dropIds) {
    const n = byId.get(id);
    if (!n) throw new PlanError(`drop \u91CC\u7684\u8282\u70B9\u4E0D\u5B58\u5728: ${id}`, 1, { candidates: [] });
    if (n.kind !== "task") throw new PlanError(`drop \u91CC\u7684 ${id} \u4E0D\u662F task`, 3);
  }
  const undecided = all.filter((n) => n.kind === "task" && !!n.week && n.week < week && !planIds.includes(n.id) && !dropIds.includes(n.id)).filter((n) => {
    const s = stateOf(n.id);
    return !s || s.stage !== "done" && s.effective === "active";
  }).map((n) => n.id);
  if (undecided.length) throw new PlanError(`\u9057\u7559\u4EFB\u52A1\u8981\u4E48\u8FDB plan \u8981\u4E48\u8FDB drop\uFF0C\u672A\u51B3\u5B9A: ${undecided.join(", ")}`, 3, { carryOver: undecided });
  const kept = all.filter((n) => n.kind === "task" && n.week === week && !planIds.includes(n.id) && !dropIds.includes(n.id)).map((n) => n.id);
  let base = 0;
  for (const id of kept) {
    const o = byId.get(id).order;
    if (typeof o === "number" && o > base) base = o;
  }
  const planned = [];
  planIds.forEach((id, i) => {
    const n = byId.get(id);
    const before = { week: n.week ?? null, order: typeof n.order === "number" ? n.order : null };
    const order = base + i + 1;
    n.week = week;
    n.order = order;
    planned.push({ id, order, before });
    if (!created.some((c) => c.id === id)) {
      const diff = [before.week !== week ? `week: ${before.week ?? "none"} \u2192 ${week}` : "", before.order !== order ? `order: ${before.order ?? "none"} \u2192 ${order}` : ""].filter(Boolean).join("; ");
      if (diff) notes.push({ id, note: `edit ${id}: ${diff}` });
    }
    if (!specComplete(n)) warnings.push(`${id} spec \u7F3A ${specMissing(n).join("\u3001")}\uFF0C\u4E0D\u53EF\u6D3E\u5DE5`);
  });
  const dropped = [];
  for (const id of dropIds) {
    const n = byId.get(id);
    if (!n.week) {
      warnings.push(`${id} \u672C\u6765\u5C31\u4E0D\u5728\u4EFB\u4F55\u4E00\u5468\u91CC\uFF0Cdrop \u6CA1\u6709\u6548\u679C`);
      continue;
    }
    dropped.push({ id, before: n.week });
    notes.push({ id, note: `edit ${id}: week: ${n.week} \u2192 none${typeof n.order === "number" ? `; order: ${n.order} \u2192 none` : ""}` });
    delete n.week;
    delete n.order;
  }
  return { week, nodes: all, created, planned, kept, dropped, warnings, notes };
}
function reportData(t, events, reportsDir, label = t.week) {
  const start = weekMonday(label);
  const end = addDays(start, 6);
  const before = addDays(start, -1);
  const inWeek = (ts) => dayOf(ts) >= start && dayOf(ts) <= end;
  const nodes = t.all.filter((s) => s.effective === "active").map((s) => {
    const prev = progressAt(s, before);
    return {
      id: s.node.id,
      name: s.node.name,
      kind: s.node.kind,
      depth: s.depth,
      parent: s.node.parent ?? null,
      health: s.health,
      stage: s.stage,
      progress: s.progress,
      before: prev,
      delta: s.progress !== null && prev !== null ? Math.round((s.progress - prev) * 100) / 100 : null,
      current: s.current,
      unit: s.node.unit ?? null,
      assess: s.assess,
      events: s.events.filter((e) => inWeek(e.ts)).length
    };
  });
  const done = t.all.filter((s) => s.node.kind === "task" && s.stage === "done").flatMap((s) => {
    const d = [...s.events].reverse().find((e) => e.type === "done");
    if (!d || !inWeek(d.ts)) return [];
    const hours = s.events.reduce((acc, e) => typeof e.hours === "number" ? (acc ?? 0) + e.hours : acc, null);
    return [{ id: s.node.id, name: s.node.name, parent: s.node.parent ?? null, ts: d.ts, hours }];
  });
  const counts = {};
  for (const e of events) if (inWeek(e.ts)) counts[e.type] = (counts[e.type] ?? 0) + 1;
  const habits = t.all.filter((s) => s.node.kind === "habit" && s.effective === "active" && s.habit).map((s) => ({
    id: s.node.id,
    name: s.node.name,
    cadence: s.node.cadence ?? "1/week",
    thisPeriod: s.habit.thisPeriod,
    times: s.habit.times,
    streak: s.habit.streak,
    checksInWeek: [...s.habit.days].filter((d) => d >= start && d <= end).length
  }));
  return {
    week: label,
    start,
    end,
    today: t.today,
    current: label === t.week,
    nodes,
    done,
    events: counts,
    velocity: velocity(t, 4),
    plan: weekView(t, events, reportsDir, label),
    brief: brief(t, events, reportsDir),
    candidates: candidates(t),
    habits
  };
}

// src/skill.ts
import { createHash as createHash2 } from "node:crypto";
import { cpSync, existsSync as existsSync5, lstatSync, mkdirSync as mkdirSync2, readdirSync as readdirSync3, readFileSync as readFileSync4, readlinkSync, realpathSync, rmSync as rmSync4, symlinkSync, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { delimiter, dirname, join as join4, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var SKILL_NAME = "okr";
var HERE = dirname(fileURLToPath(import.meta.url));
var SKILL_SRC = true ? resolve(HERE, "..") : resolve(HERE, "..", "skills", SKILL_NAME);
var SKILL_STAMP = ".wayne-skills";
function skillHash(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync3(d, { withFileTypes: true })) {
      const full = join4(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name !== SKILL_STAMP) files.push(full);
    }
  };
  walk(dir);
  const h = createHash2("sha1");
  for (const f of files.sort()) h.update(relative(dir, f)).update("\0").update(readFileSync4(f)).update("\0");
  return h.digest("hex");
}
function skillPaths(home = homedir2()) {
  return { agents: join4(home, ".agents", "skills", SKILL_NAME), claude: join4(home, ".claude", "skills", SKILL_NAME) };
}
var isSymlink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
var samePlace = (a, b) => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
};
function installSkill(opts = {}) {
  const src = opts.src ?? SKILL_SRC;
  if (!existsSync5(join4(src, "SKILL.md"))) throw new Error(`\u627E\u4E0D\u5230 skill \u6E90\u76EE\u5F55 ${src}`);
  const p = skillPaths(opts.home);
  let agentsAction = "copied";
  if (isSymlink(p.agents) && !opts.force) {
    agentsAction = "kept-symlink";
  } else if (!isSymlink(p.agents) && samePlace(src, p.agents)) {
    agentsAction = "in-place";
  } else {
    mkdirSync2(dirname(p.agents), { recursive: true });
    rmSync4(p.agents, { recursive: true, force: true });
    cpSync(src, p.agents, { recursive: true });
    writeFileSync2(join4(p.agents, SKILL_STAMP), `${skillHash(src)}
`);
  }
  const target = join4("..", "..", ".agents", "skills", SKILL_NAME);
  let claudeAction = "linked";
  if (isSymlink(p.claude)) {
    if (readlinkSync(p.claude) === target) claudeAction = "kept";
    else {
      rmSync4(p.claude);
      symlinkSync(target, p.claude);
    }
  } else if (existsSync5(p.claude)) {
    claudeAction = "skipped-dir";
  } else {
    mkdirSync2(dirname(p.claude), { recursive: true });
    symlinkSync(target, p.claude);
  }
  return { agents: { path: p.agents, action: agentsAction }, claude: { path: p.claude, action: claudeAction } };
}
function removeSkill(opts = {}) {
  const p = skillPaths(opts.home);
  const removed = [];
  const kept = [];
  if (isSymlink(p.claude)) {
    rmSync4(p.claude);
    removed.push(p.claude);
  } else if (existsSync5(p.claude)) kept.push(p.claude);
  if (isSymlink(p.agents)) kept.push(p.agents);
  else if (existsSync5(p.agents)) {
    rmSync4(p.agents, { recursive: true, force: true });
    removed.push(p.agents);
  }
  return { removed, kept };
}
function ensureSkill(opts = {}) {
  const env = opts.env ?? process.env;
  if (env.OKR_SKIP_SKILL === "1") return null;
  const src = opts.src ?? SKILL_SRC;
  const p = skillPaths(opts.home);
  try {
    if (!existsSync5(join4(src, "SKILL.md"))) return null;
    if (isSymlink(p.agents) || existsSync5(p.agents) && samePlace(src, p.agents)) return null;
    if (!existsSync5(p.agents)) return { action: "installed", result: installSkill({ home: opts.home, src }) };
    const stamp = join4(p.agents, SKILL_STAMP);
    if (!existsSync5(stamp)) return null;
    if (readFileSync4(stamp, "utf8").trim() === skillHash(src)) return null;
    return { action: "updated", result: installSkill({ home: opts.home, src, force: true }) };
  } catch {
    return null;
  }
}
function linkCli(opts = {}) {
  const env = opts.env ?? process.env;
  const dir = resolve(opts.dir ?? join4(opts.home ?? homedir2(), ".local", "bin"));
  const target = realpathSync(opts.script ?? process.argv[1]);
  const link = join4(dir, SKILL_NAME);
  mkdirSync2(dir, { recursive: true });
  if (isSymlink(link)) rmSync4(link);
  else if (existsSync5(link)) throw new Error(`${link} \u5DF2\u5B58\u5728\u4E14\u4E0D\u662F\u8F6F\u94FE\uFF0C\u4E0D\u8986\u76D6`);
  symlinkSync(target, link);
  const onPath = (env.PATH ?? "").split(delimiter).some((d) => d && samePlace(d, dir));
  return { link, target, dir, onPath };
}

// src/views/common.ts
function rootIndex(t, s) {
  let r = s;
  while (r.parent) r = r.parent;
  return Math.max(0, t.roots.indexOf(r));
}
function colorOf(t, s) {
  return goalColor(rootIndex(t, s));
}
function pct(p) {
  return p === null ? "\u2014" : `${Math.round(p * 100)}%`;
}
var FLAG_COLOR = { overdue: RED, blocked: RED, "due-soon": AMBER, stale: GRAY, "review-stale": AMBER };
function flagTags(flags) {
  return flags.map((f) => FLAG_COLOR[f] ? color(FLAG_COLOR[f], FLAG_LABEL[f]) : dim(FLAG_LABEL[f])).join(" ");
}
function isInactive(s) {
  return s.effective !== "active";
}

// src/views/habit.ts
function renderHabit(s, o) {
  const c = goalColor(o.colorIdx);
  const days = s.habit?.days ?? /* @__PURE__ */ new Set();
  const start = s.node.start ?? (s.events.length ? dayOf(s.events[0].ts) : o.today);
  const thisWeek = weekStart(o.today);
  const firstWeek = weekStart(start);
  const nWeeks = Math.max(1, Math.min(o.weeks, Math.floor(daysBetween(firstWeek, thisWeek) / 7) + 1));
  const weeks = [];
  for (let i = nWeeks - 1; i >= 0; i--) weeks.push(addDays(thisWeek, -7 * i));
  const out = [];
  let header = "      ";
  let lastMonth = "";
  let skip = 0;
  for (const w of weeks) {
    const m = addDays(w, 6).slice(0, 7);
    if (skip > 0) {
      skip--;
      continue;
    }
    if (m !== lastMonth) {
      const t = `${+m.slice(5, 7)}\u6708`;
      header += t;
      skip = Math.ceil(width(t) / 2) - 1;
      lastMonth = m;
    } else header += "  ";
  }
  out.push(dim(header));
  const dow = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
  for (let r = 0; r < 7; r++) {
    let line = ` ${dim(dow[r])}   `;
    for (const w of weeks) {
      const d = addDays(w, r);
      if (d > o.today || d < start) line += "  ";
      else line += (days.has(d) ? color(c, "\u25A0") : color(238, "\xB7")) + " ";
    }
    out.push(line);
  }
  const h = s.habit;
  if (h) {
    const unit = { day: "\u5929", week: "\u5468", month: "\u6708" }[h.period];
    const last = s.daysSinceLast === null ? "\u8FD8\u6CA1\u5F00\u59CB" : s.daysSinceLast === 0 ? "\u4ECA\u5929\u505A\u4E86" : `\u4E0A\u6B21 ${s.daysSinceLast} \u5929\u524D`;
    out.push("");
    out.push(` ${dim("\u603B\u8BA1")} ${h.total} \u6B21${dim(`  \xB7  \u672C${unit}`)} ${h.thisPeriod}/${h.times}${dim("  \xB7  \u8FDE\u7EED\u8FBE\u6807")} ${h.streak} ${unit}${dim("  \xB7  ")}${last}`);
  }
  return out;
}

// src/views/tree.ts
function visibleNodes(t, showDone = false) {
  const out = [];
  const walk = (s) => {
    if (!showDone && (s.effective === "canceled" || s.node.kind === "task" && s.stage === "done" && !s.children.length)) return;
    out.push(s);
    for (const c of s.children) walk(c);
  };
  for (const r of t.roots) walk(r);
  return out;
}
function renderTree(t, o) {
  const W = o.width;
  const out = [];
  let selectedLine = -1;
  const list2 = visibleNodes(t, o.showDone);
  if (!o.bare) {
    const left = ` ${bold("OKR \u6811")}`;
    const right = `${t.all.length} \u8282\u70B9 \xB7 ${t.week}   ${dim("today")} ${t.today} `;
    out.push(left + " ".repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  }
  list2.forEach((s, i) => {
    if (i === o.selected) selectedLine = out.length;
    out.push(treeRow(t, s, i === o.selected, W));
  });
  if (!list2.length) out.push(dim("  \u8FD8\u6CA1\u6709\u8282\u70B9\u3002okr add \u5EFA\u4E00\u4E2A\u3002"));
  return { lines: out, selectedLine };
}
function treeRow(t, s, selected, W) {
  const n = s.node;
  const c = colorOf(t, s);
  const inactive = isInactive(s);
  const cursor = selected ? color(c, "\u25B8") : " ";
  const indent = "  ".repeat(s.depth);
  const icon = inactive ? dim(KIND_ICON[n.kind]) : color(c, KIND_ICON[n.kind]);
  const id = inactive ? dim(n.id) : color(c, n.id);
  const name = inactive ? dim(n.name) : n.name;
  let tail;
  if (n.kind === "task") {
    const st = STAGE_SYM[s.stage];
    const parts = [color(st.c, `${st.sym} ${STAGE_LABEL[s.stage]}`)];
    if (n.priority) parts.push(dim(n.priority));
    if (n.deadline && s.stage !== "done") parts.push(dim(`\u23F1 ${n.deadline.slice(5)}`));
    if (s.planned) parts.push(dim("\u672C\u5468"));
    if (s.flags.length) parts.push(flagTags(s.flags.filter((f) => f !== "blocked")));
    if (s.children.length) parts.push(dim(`\u5B50\u4EFB\u52A1 ${pct(s.derived)}`));
    tail = parts.join("  ");
  } else if (n.kind === "habit" && s.habit) {
    tail = `${dim("\u672C\u5468\u671F")} ${s.habit.thisPeriod}/${s.habit.times}  ${healthTag(s.health)}`;
  } else {
    const parts = [bar((s.progress ?? 0) * 100, 12, inactive ? 238 : c), pad(pct(s.progress), 4, "right")];
    if (s.assess?.stale) parts.push(dim(`\u8BC4\u4F30 ${pct(s.assess.value)} \u5DF2\u8FC7\u671F`));
    else if (s.assess) parts.push(dim(`\u8BC4\u4F30`));
    parts.push(healthTag(s.health));
    if (s.undecomposed) parts.push(dim(`${s.undecomposed} \u4E2A\u672A\u62C6\u89E3`));
    if (n.kind === "metric") parts.push(dim(`${s.current ?? n.from ?? 0}${n.unit ?? ""} \u2192 ${n.to ?? ""}${n.unit ?? ""}`));
    tail = parts.join("  ");
  }
  return truncate(`${cursor}${indent}${icon} ${id} ${name}  ${tail}`, W);
}

// src/views/detail.ts
function renderDetail(s, o) {
  const n = s.node;
  const c = goalColor(o.colorIdx);
  const out = [];
  const meta = [n.area, KIND_LABEL[n.kind], n.weight && n.weight !== 1 ? `\u6743\u91CD ${n.weight}` : "", n.status && n.status !== "active" ? n.status : ""].filter(Boolean).join(" \xB7 ");
  const crumbs = s.parent ? dim(pathOf(s) + " \u203A ") : "";
  const title = ` ${crumbs}${color(c, bold(n.id))}  ${bold(n.name)}`;
  out.push(title + " ".repeat(Math.max(1, o.width - width(title) - width(meta) - 1)) + dim(meta));
  const facts = [];
  if (n.kind === "metric") {
    facts.push(`${n.unit ?? ""} ${n.from ?? 0} \u2192 ${n.to ?? "?"}`);
    facts.push(`\u5F53\u524D ${bold(String(s.current ?? n.from ?? 0))}`);
    facts.push(`\u8FDB\u5EA6 ${bold(pct(s.derived))}`);
  } else if (n.kind === "task") {
    const st = STAGE_SYM[s.stage];
    facts.push(color(st.c, `${st.sym} ${STAGE_LABEL[s.stage]}`));
    if (n.priority) facts.push(n.priority);
    if (n.deadline) facts.push(`\u622A\u6B62 ${n.deadline}`);
    if (n.week) facts.push(`\u8BA1\u5212 ${n.week}`);
    if (s.claimed) facts.push(`${s.claimed.by} \u5DF2\u9886\u53D6${s.claimed.session ? dim(` (${s.claimed.session})`) : ""}`);
    if (s.flags.length) facts.push(flagTags(s.flags));
  } else if (s.habit) {
    facts.push(`${n.cadence ?? "1/week"}`);
    facts.push(`\u672C\u5468\u671F ${bold(`${s.habit.thisPeriod}/${s.habit.times}`)}`);
    facts.push(`\u8FDE\u7EED\u8FBE\u6807 ${bold(String(s.habit.streak))}`);
  } else {
    facts.push(`\u63A8\u5BFC ${bold(pct(s.derived))}`);
    if (s.assess) facts.push(`\u8BC4\u4F30 ${bold(pct(s.assess.value))}${s.assess.stale ? color(RED, ` \u5DF2\u8FC7\u671F (${daysBetween(s.assess.ts, o.today)} \u5929\u524D)`) : dim(` (${daysBetween(s.assess.ts, o.today)} \u5929\u524D)`)}`);
    if (s.undecomposed) facts.push(`${s.undecomposed} \u4E2A\u672A\u62C6\u89E3`);
  }
  if (n.kind !== "task") facts.push(healthTag(s.health));
  if (n.kind !== "task" && n.kind !== "habit") {
    const period = n.end ? `${n.start ?? "?"} \u2192 ${n.end}${s.elapsed !== null ? dim(`  \u5DF2\u8FC7 ${Math.round(s.elapsed * 100)}%`) : ""}` : `${n.start ?? "?"} \u2192 ${dim("\u4E0D\u8BBE\u622A\u6B62")}`;
    facts.push(period);
  }
  out.push(" " + facts.join(dim("   ")));
  if (s.blocked) out.push(" " + color(RED, `\u25A0 \u963B\u585E ${daysBetween(s.blocked.since, o.today)} \u5929`) + dim("  ") + s.blocked.note);
  if (s.assess) out.push(" " + dim("\u8BC4\u4F30\u7406\u7531 ") + s.assess.note);
  out.push(rule(o.width));
  if (n.kind === "habit") {
    out.push(...renderHabit(s, { today: o.today, weeks: Math.min(26, Math.floor((o.width - 8) / 2)), colorIdx: o.colorIdx }));
    out.push(rule(o.width));
  } else if (n.kind === "task") {
    out.push(...specBlock(s, o.tree));
  } else if (n.start) {
    out.push(...burnup(s, { width: Math.min(o.width - 9, 72), height: 8, today: o.today, c }));
    out.push(rule(o.width));
  }
  if (s.children.length && o.tree) {
    out.push(dim(" \u5B50\u8282\u70B9"));
    const walk = (x) => {
      out.push(treeRow(o.tree, x, false, o.width));
      for (const y of x.children) walk(y);
    };
    for (const ch of s.children) walk(ch);
    out.push(rule(o.width));
  }
  out.push(dim(" \u6700\u8FD1\u4E8B\u4EF6"));
  const evs = [...s.events].reverse().slice(0, o.maxEvents ?? 8);
  for (const e of evs) {
    const val = typeof e.value === "number" ? pad(`${e.value}${n.unit === "%" ? "%" : ""}`, 5, "right") : pad("", 5);
    const by2 = e.by ? dim(`@${e.by} `) : "";
    out.push(truncate(` ${dim(dayOf(e.ts))}  ${eventSym(e.type, c)} ${pad(e.type, 8)} ${val}  ${by2}${e.note}`, o.width));
  }
  if (!evs.length) out.push(dim("  \u8FD8\u6CA1\u6709\u8BB0\u5F55"));
  return out;
}
function pathOf(s) {
  const ids = [];
  let p = s.parent;
  while (p) {
    ids.unshift(p.node.id);
    p = p.parent;
  }
  return ids.join(" \u203A ");
}
function specBlock(s, t) {
  const n = s.node;
  const out = [];
  const sp = n.spec ?? {};
  const line = (k, v) => out.push(` ${dim(pad(k, 6))} ${v ? v : color(RED, "\uFF08\u7F3A\uFF09")}`);
  line("\u76EE\u6807", sp.goal);
  if (sp.accept?.length) sp.accept.forEach((a, i) => out.push(` ${dim(pad(i ? "" : "\u9A8C\u6536", 6))} ${i + 1}. ${a}`));
  else line("\u9A8C\u6536", void 0);
  line("\u9A8C\u8BC1", sp.verify);
  if (sp.links?.length) sp.links.forEach((l, i) => out.push(` ${dim(pad(i ? "" : "\u94FE\u63A5", 6))} ${l}`));
  else line("\u94FE\u63A5", void 0);
  if (n.deps?.length) {
    const deps = n.deps.map((d) => {
      const dep = t?.byId.get(d);
      return dep ? dep.stage === "done" || dep.effective === "canceled" ? dim(d) : color(RED, d) : color(RED, `${d}?`);
    });
    out.push(` ${dim(pad("\u4F9D\u8D56", 6))} ${deps.join(" ")}`);
  }
  out.push(` ${dim(pad("\u6D3E\u5DE5", 6))} ${s.dispatchable ? color(41, "\u53EF\u6D3E\u5DE5") : dim("\u4E0D\u53EF\u6D3E\u5DE5")}`);
  out.push(rule(40));
  return out;
}
function burnup(s, o) {
  const n = s.node;
  const start = n.start;
  const end = n.end ?? addDays(o.today, 14);
  const total = Math.max(1, daysBetween(start, end));
  const W = Math.max(20, o.width);
  const H = o.height;
  const dayAt = (col) => addDays(start, Math.round(col / (W - 1) * total));
  const colOf = (d2) => Math.max(0, Math.min(W - 1, Math.round(daysBetween(start, d2) / total * (W - 1))));
  const rowOf = (p) => H - 1 - Math.round(clamp(p ?? 0) * (H - 1));
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: " ", col: 0 })));
  const put = (r, c, ch, col) => {
    if (r >= 0 && r < H && c >= 0 && c < W) grid[r][c] = { ch, col };
  };
  if (n.end) for (let c = 0; c < W; c++) put(rowOf(c / (W - 1)), c, "\xB7", GRAY);
  const todayCol = o.today < start ? -1 : colOf(o.today > end ? end : o.today);
  let prev = rowOf(progressAt(s, dayAt(0)));
  for (let c = 0; c <= todayCol; c++) {
    const r = rowOf(progressAt(s, dayAt(c)));
    if (r === prev) put(r, c, "\u2501", o.c);
    else {
      const up = r < prev;
      put(prev, c, up ? "\u251B" : "\u2513", o.c);
      for (let rr = Math.min(r, prev) + 1; rr < Math.max(r, prev); rr++) put(rr, c, "\u2503", o.c);
      put(r, c, up ? "\u250F" : "\u2517", o.c);
      prev = r;
    }
  }
  const stageEv = s.events.filter((e) => STAGE_EVENTS.has(e.type));
  for (const e of stageEv) {
    const d2 = dayOf(e.ts);
    if (d2 > o.today || d2 > end) continue;
    if (e.type === "progress" && typeof e.value !== "number") continue;
    put(rowOf(progressAt(s, d2)), colOf(d2), EVENT_SYM[e.type], e.type === "blocked" ? RED : o.c);
  }
  const axis = Array.from({ length: W }, () => color(238, "\u2500"));
  stageEv.forEach((e, i) => {
    if (e.type !== "blocked") return;
    const next = stageEv[i + 1];
    const to = next ? dayOf(next.ts) : o.today;
    for (let c = colOf(dayOf(e.ts)); c <= colOf(to > end ? end : to); c++) axis[c] = color(RED, "\u2592");
  });
  const lines = [];
  const label = (r) => r === 0 ? "100%" : r === H - 1 ? "  0%" : r === rowOf(0.5) ? " 50%" : "";
  for (let r = 0; r < H; r++) {
    const cells = grid[r].map((x) => x.col ? color(x.col, x.ch) : x.ch).join("");
    lines.push(` ${dim(pad(label(r), 4, "right"))} ${color(238, "\u2502")}${cells}`);
  }
  lines.push(`      ${color(238, "\u2514")}${axis.join("")}`);
  const ticks = Array.from({ length: W }, () => " ");
  let d = start.slice(0, 7) + "-01";
  if (d < start) d = nextMonth(d);
  for (; d <= end; d = nextMonth(d)) {
    const c = colOf(d);
    const t = `${+d.slice(5, 7)}\u6708`;
    if (c + t.length + 1 < W) for (let i = 0; i < t.length; i++) ticks[c + i] = t[i];
  }
  let tickLine = ticks.join("");
  if (todayCol >= 0 && todayCol < W - 6) tickLine = tickLine.slice(0, todayCol) + "today" + tickLine.slice(todayCol + 5);
  lines.push(`       ${dim(tickLine)}`);
  return lines;
}

// src/views/events.ts
function renderEvents(t, o) {
  const rows = [];
  const src = o.events ?? t.all.flatMap((s) => s.events);
  for (const e of src) rows.push({ e, s: e.node ? t.byId.get(e.node) ?? null : null });
  const ordered = sortEvents(rows.map((r) => ({ ts: r.e.ts, r }))).map((x) => x.r).reverse();
  const shown = o.limit ? ordered.slice(0, o.limit) : ordered;
  const out = [];
  out.push(dim(` ${pad("\u65E5\u671F", 12)}${pad("\u8282\u70B9", 9)}${pad("\u7C7B\u578B", 11)}${pad("\u503C", 6)}\u5907\u6CE8`));
  let lastMonth = "";
  for (const { e, s } of shown) {
    const m = e.ts.slice(0, 7);
    if (m !== lastMonth) {
      out.push(dim(` ${m.replace("-", " \xB7 ")}`));
      lastMonth = m;
    }
    const c = s ? colorOf(t, s) : 245;
    const unit = s?.node.unit ?? "";
    const val = typeof e.value === "number" ? pad(`${e.value}${unit === "%" ? "%" : ""}`, 5, "right") : pad("", 5);
    const by2 = e.by ? dim(`@${e.by} `) : "";
    out.push(truncate(` ${dim(dayOf(e.ts))}  ${pad(e.node ?? dim("\u2014"), 8)} ${eventSym(e.type, c)} ${pad(e.type, 9)}${val} ${by2}${e.note}`, o.width));
  }
  if (!rows.length) out.push(dim("  \u8FD8\u6CA1\u6709\u4E8B\u4EF6\u3002"));
  return out;
}

// src/views/status.ts
function boardNodes(t) {
  const roots = t.roots.filter((s) => s.effective !== "canceled");
  const areas = [...new Set(roots.map((s) => s.node.area ?? ""))];
  return areas.flatMap((a) => roots.filter((s) => (s.node.area ?? "") === a));
}
function renderStatus(t, o) {
  return renderStatusLines(t, o).lines;
}
function renderStatusLines(t, o) {
  const W = o.width;
  const ordered = boardNodes(t);
  const out = [];
  let selectedLine = -1;
  const tasks = t.all.filter((s) => s.node.kind === "task" && s.effective !== "canceled");
  const nBlocked = tasks.filter((s) => s.stage === "blocked").length;
  const nReview = tasks.filter((s) => s.stage === "review").length;
  const nPlanned = tasks.filter((s) => s.planned && s.stage !== "done").length;
  const summary = [
    `${ordered.length} \u76EE\u6807`,
    nPlanned ? `\u672C\u5468 ${nPlanned} \u4EFB\u52A1` : "",
    nReview ? color(214, `${nReview} \u5F85\u9A8C\u6536`) : "",
    nBlocked ? color(203, `${nBlocked} \u963B\u585E`) : ""
  ].filter(Boolean).join(dim(" \xB7 "));
  if (!o.bare) {
    const left = ` ${bold("OKR \u770B\u677F")}`;
    const right = `${summary}   ${dim("today")} ${t.today} `;
    out.push(left + " ".repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  }
  let lastArea = null;
  ordered.forEach((s, idx) => {
    const area = s.node.area ?? "";
    if (area !== lastArea) {
      out.push(dim(` ${area || "\u672A\u5206\u7C7B"}`));
      lastArea = area;
    }
    if (idx === o.selected) selectedLine = out.length;
    out.push(row(t, s, idx === o.selected, o));
  });
  if (!ordered.length) out.push(dim("  \u6CA1\u6709\u76EE\u6807\u3002"));
  return { lines: out, selectedLine };
}
function row(t, s, selected, o) {
  const n = s.node;
  const c = colorOf(t, s);
  const cursor = selected ? color(c, " \u25B8") : "  ";
  const id = pad(color(c, n.id), 6);
  const inactive = isInactive(s);
  const name = pad(inactive ? dim(n.name) : n.name, 16);
  let viz;
  let val;
  if (n.kind === "habit" && s.habit) {
    const cells = [];
    for (let i = 15; i >= 0; i--) {
      const d = addDays(t.today, -i);
      cells.push(s.habit.days.has(d) ? color(c, "\u25AA") : color(238, "\xB7"));
    }
    viz = cells.join("");
    val = pad(`${s.habit.thisPeriod}/${s.habit.times}`, 5, "right");
  } else {
    viz = bar((s.progress ?? 0) * 100, 16, inactive ? 238 : c);
    val = pad(pct(s.progress), 5, "right");
  }
  const health = pad(healthTag(s.health), 9);
  const since = s.lastInTree ? Math.round((Date.parse(t.today) - Date.parse(s.lastInTree.ts.slice(0, 10))) / 864e5) : null;
  const age = since === null ? pad(dim("\u2014"), 4, "right") : pad(dim(`${since}d`), 4, "right");
  const sub = n.kind === "task" ? "" : childSummary(s);
  const note = s.lastInTree ? (s.lastInTree.node && s.lastInTree.node !== n.id ? dim(s.lastInTree.node + ": ") : "") + s.lastInTree.note : dim("\u8FD8\u6CA1\u6709\u8BB0\u5F55");
  const head = `${cursor} ${id} ${name} ${viz} ${val}  ${health} ${age}  ${sub}`;
  const room = o.width - width(head) - 1;
  return head + truncate(note, Math.max(4, room));
}
function childSummary(s) {
  const tasks = s.children.filter((c) => c.effective !== "canceled");
  if (!tasks.length) return "";
  const done = tasks.filter((c) => c.stage === "done").length;
  return dim(`${done}/${tasks.length} `) + (s.undecomposed ? dim(`\u672A\u62C6\u89E3 ${s.undecomposed} `) : "");
}

// src/tui.ts
var TABS = [
  { key: "status", label: "\u770B\u677F" },
  { key: "tree", label: "\u6811" },
  { key: "events", label: "\u4E8B\u4EF6" }
];
var HINTS = {
  status: "\u2191\u2193 \u9009\u62E9   \u23CE \u8BE6\u60C5   \u2190\u2192/Tab \u5207\u9875   r \u91CD\u8BFB   q \u9000\u51FA",
  tree: "\u2191\u2193 \u9009\u62E9   \u23CE \u8BE6\u60C5   a \u663E\u793A\u5DF2\u5B8C\u6210/\u53D6\u6D88   / \u7B5B\u9009   \u2190\u2192/Tab \u5207\u9875   q \u9000\u51FA",
  detail: "\u2191\u2193 \u5207\u6362\u8282\u70B9   PgUp/PgDn \u6EDA\u52A8   esc \u8FD4\u56DE   q \u9000\u51FA",
  events: "\u2191\u2193/PgUp/PgDn \u6EDA\u52A8   \u2190\u2192/Tab \u5207\u9875   q \u9000\u51FA"
};
var FILTER_HINT = "\u8F93\u5165\u4EE5\u7B5B\u9009\u8282\u70B9   \u23CE/\u2193 \u9009\u62E9   esc \u6E05\u9664";
var CHROME = 5;
function runTui(src) {
  const out = process.stdout;
  const inp = process.stdin;
  let tab = "status";
  let detail = false;
  const page = () => detail ? "detail" : tab;
  let sel = 0;
  let filter = "";
  let filterMode = false;
  let showAll = false;
  const scroll = { status: 0, tree: 0, detail: 0, events: 0 };
  let tree;
  let list2 = [];
  let bodyH = 20;
  const rebuildList = () => {
    if (tab === "status") list2 = boardNodes(tree);
    else {
      const q = filter.trim().toLowerCase();
      list2 = visibleNodes(tree, showAll);
      if (q) list2 = list2.filter((s) => [s.node.id, s.node.name, s.node.area ?? ""].some((t) => t.toLowerCase().includes(q)));
    }
    sel = Math.min(sel, Math.max(0, list2.length - 1));
  };
  const reload = () => {
    const { nodes, events } = src.load();
    tree = project(nodes, events, src.today);
    rebuildList();
  };
  const tabBar = (cols2) => {
    const left = TABS.map((t) => {
      if (t.key !== tab) return dim(` ${t.label} `);
      const cur = detail && list2[sel] ? ` ${t.label} \u203A ${list2[sel].node.id} ` : ` ${t.label} `;
      return inverse(bold(cur));
    }).join(" ");
    const info = [`${tree.all.length} \u8282\u70B9`, tree.week, `${dim("today")} ${src.today}`, src.readOnly ? dim("\u793A\u4F8B\u6570\u636E") : ""].filter(Boolean).join(dim(" \xB7 "));
    return " " + left + " ".repeat(Math.max(1, cols2 - width(left) - width(info) - 2)) + info + " ";
  };
  const filterLine = () => {
    if (detail) return dim(" \u2039 esc \u8FD4\u56DE");
    if (filterMode) return ` \u2315 ${filter}${inverse(" ")}`;
    if (filter) return ` \u2315 ${filter}  ${dim(`${list2.length} \u4E2A\u5339\u914D \xB7 esc \u6E05\u9664`)}`;
    if (tab === "tree") return dim(` \u2315 \u6309 / \u7B5B\u9009\u8282\u70B9\u2026${showAll ? "   \uFF08\u542B\u5DF2\u5B8C\u6210/\u53D6\u6D88\uFF09" : ""}`);
    return "";
  };
  const content = (cols2) => {
    if (!detail && tab === "status") {
      const r = renderStatusLines(tree, { width: cols2, selected: sel, bare: true });
      return { lines: r.lines, keep: r.selectedLine };
    }
    if (!detail && tab === "tree") {
      if (filter.trim()) return { lines: list2.map((s2, i) => treeRow(tree, s2, i === sel, cols2)), keep: sel };
      const r = renderTree(tree, { width: cols2, selected: sel, bare: true, showDone: showAll });
      return { lines: r.lines, keep: r.selectedLine };
    }
    if (!detail && tab === "events") return { lines: renderEvents(tree, { width: cols2 }), keep: -1 };
    const s = list2[sel];
    return {
      lines: s ? renderDetail(s, { width: cols2, today: src.today, colorIdx: rootIndex(tree, s), maxEvents: 60, tree }) : [dim("  \u6CA1\u6709\u5339\u914D\u7684\u8282\u70B9\u3002")],
      keep: -1
    };
  };
  const draw = () => {
    const cols2 = out.columns || 100;
    const rows = out.rows || 30;
    bodyH = Math.max(1, rows - CHROME);
    const { lines, keep } = content(cols2);
    const pg = page();
    const max = Math.max(0, lines.length - bodyH);
    let off = Math.min(scroll[pg], max);
    if (keep >= 0) {
      if (keep < off) off = keep;
      else if (keep >= off + bodyH) off = keep - bodyH + 1;
    }
    scroll[pg] = off;
    const body = lines.slice(off, off + bodyH).map((l) => truncate(l, cols2));
    while (body.length < bodyH) body.push("");
    const pos = lines.length > bodyH ? dim(`  ${off + 1}-${Math.min(off + bodyH, lines.length)}/${lines.length}`) : "";
    const footer = dim(" " + (filterMode ? FILTER_HINT : HINTS[pg])) + pos;
    out.write("\x1B[H\x1B[2J" + [truncate(tabBar(cols2), cols2), rule(cols2), truncate(filterLine(), cols2), ...body, rule(cols2), truncate(footer, cols2)].join("\n"));
  };
  const switchTab = (d) => {
    const i = TABS.findIndex((t) => t.key === tab);
    tab = TABS[(i + d + TABS.length) % TABS.length].key;
    detail = false;
    rebuildList();
  };
  const select = (d) => {
    const before = sel;
    sel = Math.max(0, Math.min(list2.length - 1, sel + d));
    if (sel !== before) scroll.detail = 0;
  };
  const scrollBy = (d) => {
    scroll[page()] = Math.max(0, scroll[page()] + d);
  };
  return new Promise((resolve3) => {
    const cleanup = () => {
      inp.off("data", onKey);
      out.off("resize", draw);
      if (inp.isTTY) inp.setRawMode(false);
      inp.pause();
      out.write("\x1B[?25h\x1B[?1049l");
      resolve3();
    };
    const onFilterKey = (k) => {
      if (k === "\x1B") {
        filter = "";
        filterMode = false;
        rebuildList();
      } else if (k === "\r" || k === "\x1B[B" || k === "	") {
        filterMode = false;
        sel = 0;
      } else if (k === "\x7F" || k === "\b") {
        filter = filter.slice(0, -1);
        rebuildList();
      } else if (k >= " " && !k.startsWith("\x1B")) {
        filter += k;
        sel = 0;
        rebuildList();
      }
    };
    const onKey = (buf) => {
      const k = buf.toString();
      if (k === "") return cleanup();
      if (filterMode) {
        onFilterKey(k);
        return draw();
      }
      if (k === "q") return cleanup();
      const pg = page();
      const listy = pg !== "events";
      if (k === "/" && tab === "tree" && !detail) filterMode = true;
      else if (k === "a" && tab === "tree" && !detail) {
        showAll = !showAll;
        rebuildList();
      } else if (k === "	" || k === "\x1B[C") switchTab(1);
      else if (k === "\x1B[Z" || k === "\x1B[D") switchTab(-1);
      else if (k >= "1" && k <= String(TABS.length)) {
        tab = TABS[+k - 1].key;
        detail = false;
        rebuildList();
      } else if (k === "\x1B[A" || k === "k") listy ? select(-1) : scrollBy(-1);
      else if (k === "\x1B[B" || k === "j") listy ? select(1) : scrollBy(1);
      else if (k === "\x1B[5~") pg === "detail" || pg === "events" ? scrollBy(-bodyH) : select(-bodyH);
      else if (k === "\x1B[6~") pg === "detail" || pg === "events" ? scrollBy(bodyH) : select(bodyH);
      else if (k === "g") listy && !detail ? select(-Infinity) : scroll[pg] = 0;
      else if (k === "G") listy && !detail ? select(Infinity) : scroll[pg] = Number.MAX_SAFE_INTEGER;
      else if (k === "\r" || k === "l") {
        if (list2.length && tab !== "events") detail = true;
      } else if (k === "\x1B" || k === "h") {
        if (detail) detail = false;
        else if (filter) {
          filter = "";
          rebuildList();
        } else {
          tab = "status";
          rebuildList();
        }
      } else if (k === "r") reload();
      draw();
    };
    reload();
    out.write("\x1B[?1049h\x1B[?25l");
    if (inp.isTTY) inp.setRawMode(true);
    inp.resume();
    inp.on("data", onKey);
    out.on("resize", draw);
    draw();
  });
}

// src/cli.ts
function parseArgs(argv) {
  const a = { _: [], flags: {} };
  const put = (k, v) => {
    const prev = a.flags[k];
    if (prev === void 0) a.flags[k] = v;
    else if (Array.isArray(prev)) prev.push(String(v));
    else a.flags[k] = [String(prev), String(v)];
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--") {
      a._.push(...argv.slice(i + 1));
      break;
    }
    if (t.startsWith("--")) {
      const [k, v] = t.slice(2).split(/=(.*)/s, 2);
      if (v !== void 0) put(k, v);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) put(k, argv[++i]);
      else put(k, true);
    } else a._.push(t);
  }
  return a;
}
var args = parseArgs(process.argv.slice(2));
var cmd = args._[0] ?? "";
var json = args.flags.json === true;
var demo = args.flags.demo === true;
var cols = process.stdout.columns || 100;
var HERE2 = dirname2(fileURLToPath2(import.meta.url));
var PKG_VERSION = true ? "0.1.0" : JSON.parse(readFileSync5(resolve2(HERE2, "..", "package.json"), "utf8")).version;
var KNOWN_FLAGS = /* @__PURE__ */ new Set([
  "json",
  "demo",
  "today",
  "by",
  "session",
  "confirmed",
  "force",
  "at",
  "link",
  "hours",
  "body",
  "repo",
  "commit",
  "value",
  "node",
  "days",
  "weeks",
  "all",
  "spec",
  "merge-events",
  "kind",
  "name",
  "area",
  "parent",
  "start",
  "end",
  "weight",
  "status",
  "metric",
  "unit",
  "from",
  "to",
  "cadence",
  "habit",
  "priority",
  "deadline",
  "dep",
  "deps",
  "week",
  "order",
  "goal",
  "accept",
  "verify",
  "reason",
  "limit",
  "help",
  "version",
  "dir",
  "since",
  "dismiss",
  "dispatchable"
]);
var str = (k) => {
  const v = args.flags[k];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[v.length - 1];
  return void 0;
};
var list = (k) => {
  const v = args.flags[k];
  if (v === void 0 || v === true) return void 0;
  return (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
};
var flag = (k) => args.flags[k] === true;
var num = (k) => {
  const v = str(k);
  if (v === void 0) return void 0;
  const n = Number(v);
  if (Number.isNaN(n)) fail(`--${k} \u9700\u8981\u6570\u5B57\uFF0C\u5F97\u5230 "${v}"`);
  return n;
};
var todayFlag = str("today");
var today = todayFlag !== void 0 && isValidDate(todayFlag) ? todayFlag : demo ? DEMO_TODAY : todayIso();
var by = str("by") ?? process.env.OKR_BY;
var session = str("session");
var confirmed = flag("confirmed");
var force = flag("force");
var CliExit = class extends Error {
  code;
  constructor(code) {
    super(`exit ${code}`);
    this.code = code;
  }
};
function fail(msg, code = 1, extra = {}) {
  if (json) console.log(JSON.stringify({ ok: false, error: msg, code, ...extra }));
  else console.error(color(RED, "\u2717 ") + msg);
  throw new CliExit(code);
}
function ok(data, human) {
  if (json) console.log(JSON.stringify({ ok: true, ...data }, jsonReplacer));
  else human();
}
function jsonReplacer(_k, v) {
  return v instanceof Set ? [...v] : v;
}
function load() {
  if (demo) return { nodes: DEMO_NODES, events: DEMO_EVENTS };
  return { nodes: loadNodes(), events: loadEvents() };
}
function requireData() {
  if (demo) return;
  if (hasOldLayout()) fail(`\u53D1\u73B0\u65E7\u7248 goals.yaml\u3002\u5148\u8FD0\u884C ${bold("okr migrate")} \u8FC1\u5230\u65B0\u6A21\u578B\u3002`);
  if (!exists()) fail(`\u8FD8\u6CA1\u6709\u521D\u59CB\u5316\u3002\u5148\u8FD0\u884C ${bold("okr init")}\uFF0C\u6216\u8005\u7528 ${bold("okr tui --demo")} \u770B\u793A\u4F8B\u3002`);
}
function buildTree() {
  requireData();
  const { nodes, events } = load();
  return project(nodes, events, today);
}
function pickNode(q, nodes, usage) {
  if (!q) fail(usage);
  const m = matchNode(nodes, q);
  if (m.node) return m.node;
  if (!m.candidates.length) fail(`\u6CA1\u6709\u5339\u914D "${q}" \u7684\u8282\u70B9\u3002okr tree \u53EF\u4EE5\u67E5\u770B\u5168\u90E8\u3002`, 2, { candidates: [] });
  if (json) fail(`"${q}" \u5339\u914D\u5230\u591A\u4E2A\u8282\u70B9`, 2, { candidates: m.candidates.map((n) => ({ id: n.id, name: n.name, kind: n.kind })) });
  console.error(color(RED, "\u2717 ") + `"${q}" \u5339\u914D\u5230\u591A\u4E2A\u8282\u70B9\uFF0C\u8BF7\u6307\u5B9A id\uFF1A`);
  for (const n of m.candidates) console.error(`    ${bold(n.id)}  ${n.name}  ${dim(KIND_LABEL[n.kind])}`);
  throw new CliExit(2);
}
function write(fn) {
  if (demo) fail("--demo \u662F\u53EA\u8BFB\u7684");
  if (str("today") !== void 0) fail("--today \u53EA\u5F71\u54CD\u8BFB\uFF0C\u5199\u5165\u547D\u4EE4\u4E0D\u63A5\u53D7", 1);
  requireData();
  eventTs();
  num("hours");
  try {
    withLock(() => {
      const { data, msg, human } = fn(loadNodes(), loadEvents());
      const c = commit(msg);
      if (!c.committed) console.error(color(RED, "! ") + `git commit \u5931\u8D25\uFF08\u6587\u4EF6\u5DF2\u5199\u5165\uFF09: ${c.error ?? ""}`);
      ok({ ...data, committed: c.committed }, human);
    });
  } catch (err) {
    if (err instanceof LockTimeout) fail(err.message, 4);
    throw err;
  }
}
function eventTs() {
  const rec = nowIso();
  const at = str("at");
  if (at === void 0) return { ts: rec, rec };
  let ts = parseTs(at);
  if (!ts) fail(`--at \u9700\u8981\u65E5\u671F\u6216 ISO \u65F6\u95F4\uFF0C\u5F97\u5230 "${at}"`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
    if (at > dayOf(rec)) fail(`--at \u4E0D\u80FD\u662F\u672A\u6765\u65F6\u95F4: ${at}`);
    if (at === dayOf(rec)) ts = rec;
  } else if (tsMs(ts) - tsMs(rec) > 5 * 60 * 1e3) fail(`--at \u4E0D\u80FD\u662F\u672A\u6765\u65F6\u95F4: ${at}`);
  return { ts, rec };
}
function mkEvent(node, type, note, extra = {}) {
  const e = { ...eventTs(), node, type, note };
  if (by) e.by = by;
  if (session) e.session = session;
  if (type !== "change") {
    const links = list("link");
    if (links?.length) e.links = links;
  }
  const hours = num("hours");
  if (hours !== void 0) e.hours = hours;
  const body = str("body");
  if (body) e.body = body;
  const repo = str("repo");
  if (repo) e.repo = repo;
  const commit2 = str("commit");
  if (commit2) e.commit = commit2;
  if (confirmed) e.confirmed = true;
  Object.assign(e, extra);
  return e;
}
function state(nodes, events, id) {
  return project(nodes, events, today).byId.get(id);
}
var norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
function dedupGuard(events, e) {
  if (force || !e.node) return;
  const own = sortEvents(events.filter((x) => x.node === e.node));
  if (e.type === "check") {
    const same = own.find((x) => x.type === "check" && dayOf(x.ts) === dayOf(e.ts));
    if (same) fail(`${dayOf(same.ts)} \u5DF2\u7ECF\u6253\u8FC7\u5361\u3002\u786E\u8BA4\u8981\u518D\u8BB0\u4E00\u6B21\u5C31\u52A0 --force\u3002`, 3, { duplicate: same });
    return;
  }
  const prev = own[own.length - 1];
  if (!prev || prev.type !== e.type || dayOf(prev.ts) !== dayOf(e.ts)) return;
  if (prev.value !== e.value) return;
  if ((prev.links ?? []).join("\n") !== (e.links ?? []).join("\n")) return;
  const a = norm(prev.note);
  const b = norm(e.note);
  if (a === b || a.length > 6 && b.includes(a) || b.length > 6 && a.includes(b))
    fail(`\u4E0E ${dayOf(prev.ts)} \u7684\u4E0A\u4E00\u6761 ${e.type} \u5185\u5BB9\u76F8\u8FD1\uFF1A"${prev.note}"\u3002\u786E\u8BA4\u4E0D\u662F\u91CD\u590D\u5C31\u52A0 --force\u3002`, 3, { duplicate: prev });
}
function appendStageEvent(type, usage, opts = {}) {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, usage);
    const note = args._.slice(2).join(" ") || opts.defaultNote || "";
    if (opts.noteRequired && !note) fail(usage);
    const s = state(nodes, events, n.id);
    const e = mkEvent(n.id, type, note);
    const value = num("value");
    if (value !== void 0) e.value = value;
    guardStage(type, n, s, e);
    dedupGuard(events, e);
    appendEvent(e);
    const after = state(nodes, [...events, e], n.id);
    return {
      data: { event: e, node: n.id, stage: after.stage, progress: after.progress },
      msg: `${type} ${n.id}: ${note}`.trim(),
      human: () => {
        if (n.kind === "habit" && after.habit) {
          const h = after.habit;
          console.log(`${color(GREEN, "\u2713")} ${bold(n.id)} ${n.name}  \u672C\u5468\u671F ${h.thisPeriod}/${h.times}  \u8FDE\u7EED ${h.streak}  \u7D2F\u8BA1 ${h.total}`);
          return;
        }
        const st = STAGE_SYM[after.stage];
        console.log(`${color(GREEN, "\u2713")} ${bold(n.id)} ${n.name}  ${color(st.c, `${st.sym} ${STAGE_LABEL[after.stage]}`)}${after.progress !== null ? dim(`  \u8FDB\u5EA6 ${pct(after.progress)}`) : ""}`);
      }
    };
  });
}
function guardValidate(before, after, events) {
  const v = validateData(after, events);
  if (!v.errors.length) return { warnings: v.warnings };
  const old = new Set(validateData(before, events).errors);
  const fresh = v.errors.filter((x) => !old.has(x));
  if (fresh.length) fail(fresh.join("\n"), 3, { errors: fresh });
  const carried = v.errors.map((x) => `\u5DF2\u6709\u95EE\u9898\uFF08\u672C\u6B21\u672A\u5F15\u5165\uFF0Cokr validate \u5904\u7406\uFF09: ${x}`);
  if (!json) for (const w of carried) console.error(color(214, "! ") + w);
  return { warnings: [...v.warnings, ...carried] };
}
function guardActive(n, s) {
  if (s.effective === "active" || force) return;
  fail(`${n.id} ${s.effective === "canceled" ? "\u5DF2\u53D6\u6D88" : "\u5DF2\u51BB\u7ED3"}\uFF08\u81EA\u8EAB\u6216\u7956\u5148\uFF09\uFF0C\u8981\u5199\u5165\u5C31\u52A0 --force`, 3);
}
function guardStage(type, n, s, e) {
  const upper = n.kind === "objective" || n.kind === "metric" || n.kind === "milestone";
  guardActive(n, s);
  switch (type) {
    case "done":
      if (n.kind === "habit") fail(`\u4E60\u60EF\u6CA1\u6709\u5B8C\u6210\uFF0C\u4E0D\u518D\u505A\u5C31 okr edit ${n.id} --status canceled --confirmed`, 3);
      if (upper && !confirmed) fail(`${KIND_LABEL[n.kind]} ${n.id} \u7684\u5B8C\u6210\u8981\u95EE\u7528\u6237\uFF0C\u786E\u8BA4\u540E\u52A0 --confirmed`, 3);
      if (s.stage === "done") fail(`${n.id} \u5DF2\u7ECF\u662F\u5B8C\u6210\u72B6\u6001`, 3);
      break;
    case "claim":
      if (n.kind !== "task") fail("\u53EA\u80FD\u9886\u53D6 task", 3);
      if (!e.by) fail("claim \u9700\u8981 --by\uFF08\u6216\u73AF\u5883\u53D8\u91CF OKR_BY\uFF09", 3);
      if (s.stage === "done") fail(`${n.id} \u5DF2\u5B8C\u6210\uFF0C\u4E0D\u80FD\u9886\u53D6`, 3);
      if (s.claimed && !force) {
        const same = s.claimed.by === e.by && (!s.claimed.session || !e.session || s.claimed.session === e.session);
        if (!same) fail(`${n.id} \u5DF2\u88AB ${s.claimed.by}${s.claimed.session ? ` (${s.claimed.session})` : ""} \u4E8E ${dayOf(s.claimed.ts)} \u9886\u53D6\u4E14\u672A submit\u3002\u8981\u62A2\u5C31\u52A0 --force\u3002`, 3, { claimed: s.claimed });
      }
      break;
    case "submit":
      if (n.kind !== "task") fail("\u53EA\u80FD\u7ED9 task submit", 3);
      if (!e.links?.length) fail("submit \u5FC5\u987B\u5E26 --link <PR>", 3);
      if (s.stage === "done") fail(`${n.id} \u5DF2\u5B8C\u6210`, 3);
      break;
    case "reject": {
      const hasSubmit = s.events.some((x) => x.type === "submit");
      if (!hasSubmit && s.stage !== "done") fail(`${n.id} \u6CA1\u6709 submit \u4E5F\u4E0D\u662F\u5B8C\u6210\u72B6\u6001\uFF0C\u6CA1\u6709\u53EF\u6253\u56DE\u7684\u4E1C\u897F`, 3);
      if (s.stage === "done" && n.kind !== "task" && !confirmed) fail(`\u91CD\u65B0\u6253\u5F00 ${KIND_LABEL[n.kind]} ${n.id} \u8981 --confirmed`, 3);
      if (!e.note) fail("reject \u8981\u5E26\u610F\u89C1", 3);
      break;
    }
    case "progress":
      if (n.kind === "habit") fail(`${n.id} \u662F\u4E60\u60EF\uFF0C\u7528 okr check`, 3);
      if (e.value !== void 0 && n.kind !== "metric") fail(`--value \u53EA\u5BF9 metric \u6709\u610F\u4E49`, 3);
      break;
    case "check":
      if (n.kind !== "habit") fail(`${n.id} \u4E0D\u662F\u4E60\u60EF\uFF0C\u7528 okr log`, 3);
      break;
    case "blocked":
      if (n.kind !== "task" && n.kind !== "milestone") fail("block \u53EA\u5BF9 task / milestone \u6709\u610F\u4E49", 3);
      if (s.stage === "done") fail(`${n.id} \u5DF2\u5B8C\u6210`, 3);
      if (!e.note) fail("block \u8981\u8BF4\u660E\u5361\u5728\u54EA", 3);
      break;
  }
}
var KINDS3 = ["objective", "metric", "milestone", "task", "habit"];
var PRIORITIES3 = ["P0", "P1", "P2", "P3"];
function nodeFields(kind) {
  const patch = {};
  const present = [];
  const take = (k, v, given = v !== void 0) => {
    if (!given) return;
    present.push(k);
    patch[k] = v;
  };
  const clearable = (k) => str(k) === "none" ? null : str(k);
  take("name", str("name"));
  take("area", clearable("area") ?? void 0, str("area") !== void 0);
  take("parent", clearable("parent"), str("parent") !== void 0);
  take("start", str("start"));
  take("end", clearable("end"), str("end") !== void 0);
  take("weight", num("weight"));
  const status = str("status");
  if (status !== void 0) {
    if (!["active", "canceled", "frozen"].includes(status)) fail("--status \u53EA\u80FD\u662F active / canceled / frozen");
    take("status", status);
  }
  const metric = str("metric");
  if (metric) {
    const [unit, from, to] = metric.split(":");
    if (from === void 0 || to === void 0 || Number.isNaN(+from) || Number.isNaN(+to)) fail("--metric \u683C\u5F0F\uFF1A\u5355\u4F4D:\u8D77\u70B9:\u76EE\u6807\uFF0C\u4F8B\u5982 %:76:95");
    take("unit", unit);
    take("from", +from);
    take("to", +to);
  }
  take("unit", str("unit"));
  take("from", num("from"));
  take("to", num("to"));
  take("cadence", str("cadence") ?? str("habit"));
  const priority = str("priority");
  if (priority !== void 0) {
    if (!PRIORITIES3.includes(priority)) fail("--priority \u53EA\u80FD\u662F P0\u2013P3");
    take("priority", priority);
  }
  take("deadline", clearable("deadline") ?? void 0, str("deadline") !== void 0);
  const deps = list("dep") ?? list("deps");
  if (deps) take("deps", deps.filter((d) => d !== "none"));
  const week = str("week");
  if (week !== void 0) {
    if (week !== "none" && !isValidWeek(week)) fail("--week \u683C\u5F0F\uFF1A2026-W36");
    take("week", week === "none" ? void 0 : week, true);
  }
  take("order", num("order"));
  const spec = {};
  let hasSpec = false;
  if (str("goal") !== void 0) spec.goal = str("goal"), hasSpec = true;
  if (list("accept")) spec.accept = list("accept"), hasSpec = true;
  if (str("verify") !== void 0) spec.verify = str("verify"), hasSpec = true;
  if (list("link")) spec.links = list("link"), hasSpec = true;
  if (hasSpec) take("spec", spec);
  for (const k of ["start", "end", "deadline"]) {
    const v = patch[k];
    if (typeof v === "string" && !isValidDate(v)) fail(`--${k} \u9700\u8981 YYYY-MM-DD\uFF0C\u5F97\u5230 "${v}"`);
  }
  if (kind !== "task") {
    for (const k of ["priority", "deadline", "deps", "week", "order", "spec"]) if (k in patch) fail(`--${k} \u53EA\u5BF9 task \u6709\u610F\u4E49`);
  }
  return { patch, present };
}
function describe(n) {
  const bits = [KIND_LABEL[n.kind], n.parent ? `\u7236 ${n.parent}` : "", n.area ?? ""].filter(Boolean);
  return `${n.id} ${n.name}\uFF08${bits.join("\uFF0C")}\uFF09`;
}
function diffNodes(a, b) {
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of keys) {
    const x = JSON.stringify(a[k] ?? null);
    const y = JSON.stringify(b[k] ?? null);
    if (x !== y) out.push(`${k}: ${x} \u2192 ${y}`);
  }
  return out.join("; ");
}
function cmdInit() {
  if (hasOldLayout()) fail(`\u53D1\u73B0\u65E7\u7248 goals.yaml\u3002\u7528 ${bold("okr migrate")} \u8FC1\u79FB\uFF0C\u4E0D\u8981 init\u3002`);
  const { created } = init();
  ok({ dir: DIR, created }, () => console.log(created ? `${color(GREEN, "\u2713")} \u5DF2\u5728 ${DIR} \u521D\u59CB\u5316\u3002\u4E0B\u4E00\u6B65 ${bold("okr add")} \u5EFA\u76EE\u6807\u3002` : `${DIR} \u5DF2\u7ECF\u5B58\u5728\u3002`));
}
var ADD_USAGE = "\u7528\u6CD5: okr add [id] --name \u540D\u79F0 --kind objective|metric|milestone|task|habit [--parent id] [--area \u9886\u57DF] [--start \u65E5\u671F --end \u65E5\u671F] [--weight N] [--status active|frozen|canceled] [--metric \u5355\u4F4D:\u8D77\u70B9:\u76EE\u6807] [--cadence 3/week] [--priority P1] [--deadline \u65E5\u671F] [--dep id] [--week 2026-W36] [--goal \u2026 --accept \u2026 --verify \u2026 --link \u2026] --confirmed";
function cmdAdd() {
  write((nodes, events) => {
    const kind = str("kind") ?? (str("metric") || str("from") !== void 0 || str("to") !== void 0 ? "metric" : str("cadence") ?? str("habit") ? "habit" : void 0);
    if (!kind || !KINDS3.includes(kind)) fail(ADD_USAGE + "\uFF08\u65E0\u6CD5\u4ECE\u5176\u5B83\u53C2\u6570\u63A8\u51FA kind \u65F6\u5FC5\u987B\u663E\u5F0F --kind\uFF09");
    if (!str("name")) fail(ADD_USAGE);
    if (!confirmed) fail("\u7ED3\u6784\u53D8\u66F4\u8981 --confirmed\uFF08skill \u5728\u7528\u6237\u70B9\u5934\u540E\u4F20\uFF09", 3);
    const { patch } = nodeFields(kind);
    const parent = patch.parent ?? null;
    if (parent && !nodes.some((n) => n.id === parent)) fail(`parent \u4E0D\u5B58\u5728: ${parent}`);
    const id = args._[1] ?? newId(nodes, kind, parent, events);
    if (!/^[A-Za-z0-9][\w.-]*$/.test(id)) fail(`id \u53EA\u80FD\u7528\u5B57\u6BCD\u6570\u5B57 . _ -\uFF1A${id}`);
    if (nodes.some((n) => n.id === id)) fail(`\u8282\u70B9 ${id} \u5DF2\u5B58\u5728`);
    if (takenIds(nodes, events).has(id)) fail(`${id} \u5728\u4E8B\u4EF6\u5386\u53F2\u6216 deps \u91CC\u51FA\u73B0\u8FC7\uFF0Cid \u4E0D\u80FD\u590D\u7528\uFF0C\u6362\u4E00\u4E2A\u6216\u4E0D\u6307\u5B9A\u8BA9 okr \u751F\u6210`);
    const node = { id, name: patch.name, kind, ...patch };
    if (parent) node.parent = parent;
    else delete node.parent;
    if (kind === "metric" && (typeof node.from !== "number" || typeof node.to !== "number")) fail("metric \u9700\u8981 --metric \u5355\u4F4D:\u8D77\u70B9:\u76EE\u6807");
    if (kind === "habit" && !node.cadence) node.cadence = "1/week";
    if (kind !== "task" && kind !== "habit" && !node.start) node.start = today;
    for (const d of node.deps ?? []) if (!nodes.some((n) => n.id === d)) fail(`\u4F9D\u8D56\u4E0D\u5B58\u5728: ${d}`);
    const all = [...nodes, node];
    const v = guardValidate(nodes, all, events);
    const ownWarnings = v.warnings.filter((w) => w.startsWith(`\u8282\u70B9 ${id} `));
    saveNodes(all);
    const e = mkEvent(id, "change", `add ${describe(node)}`);
    appendEvent(e);
    return {
      data: { node, event: e, warnings: ownWarnings },
      msg: `add ${id}: ${node.name}`,
      human: () => {
        console.log(`${color(GREEN, "\u2713")} \u65B0\u5EFA ${bold(id)} ${node.name}  ${dim(KIND_LABEL[kind] + (parent ? ` \xB7 \u7236 ${parent}` : ""))}`);
        if (kind === "task" && !specComplete(node)) console.log(dim("  spec \u4E0D\u5168\uFF0C\u4E0D\u53EF\u6D3E\u5DE5\u3002okr edit " + id + " --goal \u2026 --accept \u2026 --verify \u2026 --link \u2026"));
        for (const w of ownWarnings) console.log(dim("  ! " + w));
      }
    };
  });
}
function cmdEdit() {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, "\u7528\u6CD5: okr edit <id> [--name \u2026] [--status active|canceled|frozen] [--priority \u2026] [--deadline \u2026|none] [--dep \u2026] [--week \u2026|none] [--goal \u2026 --accept \u2026 --verify \u2026 --link \u2026] \u2026");
    const { patch, present } = nodeFields(n.kind);
    if (present.includes("parent")) fail("\u6539\u7236\u8282\u70B9\u7528 okr move", 3);
    if (!present.length) fail("\u6CA1\u6709\u8981\u6539\u7684\u5B57\u6BB5");
    const before = { ...n };
    const next = { ...n };
    for (const k of present) {
      const v2 = patch[k];
      if (k === "spec") next.spec = { ...n.spec ?? {}, ...v2 };
      else if (v2 === void 0 || v2 === null) delete next[k];
      else next[k] = v2;
    }
    if (present.includes("end") && patch.end === null) next.end = null;
    const all = nodes.map((x) => x.id === n.id ? next : x);
    const v = guardValidate(nodes, all, events);
    const ownWarnings = v.warnings.filter((w) => w.startsWith(`\u8282\u70B9 ${n.id} `));
    const diff = diffNodes(before, next);
    if (!diff) fail("\u6CA1\u6709\u53D8\u5316");
    saveNodes(all);
    const e = mkEvent(n.id, "change", `edit ${n.id}: ${diff}`);
    appendEvent(e);
    return {
      data: { node: next, event: e, warnings: ownWarnings },
      msg: `edit ${n.id}: ${diff}`,
      human: () => {
        console.log(`${color(GREEN, "\u2713")} ${bold(n.id)} ${diff}`);
        for (const w of ownWarnings) console.log(dim("  ! " + w));
      }
    };
  });
}
function cmdMove() {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, "\u7528\u6CD5: okr move <id> --to <parent|none> --confirmed");
    const to = str("to");
    if (!to) fail("\u7528\u6CD5: okr move <id> --to <parent|none> --confirmed");
    if (!confirmed) fail("\u7ED3\u6784\u53D8\u66F4\u8981 --confirmed", 3);
    const parent = to === "none" ? null : pickNode(to, nodes, "").id;
    if (parent === n.id) fail("\u4E0D\u80FD\u6302\u5230\u81EA\u5DF1\u4E0B\u9762", 3);
    const t = project(nodes, events, today);
    if (parent && isAncestor(t, n.id, parent)) fail(`${parent} \u5728 ${n.id} \u7684\u5B50\u6811\u91CC\uFF0C\u4F1A\u6210\u73AF`, 3);
    if ((n.parent ?? null) === parent) fail("\u5DF2\u7ECF\u5728\u90A3\u91CC\u4E86");
    const next = { ...n };
    if (parent) next.parent = parent;
    else delete next.parent;
    const all = nodes.map((x) => x.id === n.id ? next : x);
    saveNodes(all);
    const note = `move ${n.id}: parent ${n.parent ?? "none"} \u2192 ${parent ?? "none"}`;
    const e = mkEvent(n.id, "change", note);
    appendEvent(e);
    return { data: { node: next, event: e }, msg: note, human: () => console.log(`${color(GREEN, "\u2713")} ${note}`) };
  });
}
function cmdRm() {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, "\u7528\u6CD5: okr rm <id> --confirmed");
    if (!confirmed) fail("\u7ED3\u6784\u53D8\u66F4\u8981 --confirmed", 3);
    if (nodes.some((x) => x.parent === n.id)) fail(`${n.id} \u6709\u5B50\u8282\u70B9\uFF0C\u4E0D\u80FD\u5220\u3002\u7528 edit --status canceled`, 3);
    if (events.some((x) => x.node === n.id && x.type !== "change")) fail(`${n.id} \u6709\u4E8B\u4EF6\uFF0C\u4E0D\u80FD\u5220\u3002\u7528 edit --status canceled`, 3);
    const dependents = nodes.filter((x) => x.deps?.includes(n.id)).map((x) => x.id);
    if (dependents.length) fail(`${dependents.join(", ")} \u4F9D\u8D56 ${n.id}\uFF0C\u5148\u6539\u5B83\u4EEC\u7684 deps`, 3);
    saveNodes(nodes.filter((x) => x.id !== n.id));
    const note = `rm ${describe(n)}`;
    const e = mkEvent(n.id, "change", note);
    appendEvent(e);
    return { data: { node: n, event: e }, msg: note, human: () => console.log(`${color(GREEN, "\u2713")} \u5DF2\u5220\u9664 ${bold(n.id)} ${n.name}`) };
  });
}
function cmdRepo() {
  const sub = args._[1];
  if (sub === "list" || !sub) {
    requireData();
    const repos = loadRepos();
    ok({ repos }, () => {
      if (!repos.length) console.log(dim("\u6CA1\u6709\u767B\u8BB0\u4ED3\u5E93\u3002okr repo add <path> [--node id]"));
      for (const r of repos) console.log(` ${r.path}${r.node ? dim(`  \u2192 ${r.node}`) : ""}`);
    });
    return;
  }
  if (sub !== "add" && sub !== "rm") fail("\u7528\u6CD5: okr repo add <path> [--node id] | okr repo rm <path> | okr repo list");
  write((nodes) => {
    const path = resolve2(args._[2] ?? ".");
    const repos = loadRepos();
    if (sub === "rm") {
      if (!repos.some((r) => r.path === path)) fail(`\u6CA1\u6709\u767B\u8BB0 ${path}`);
      saveRepos(repos.filter((r) => r.path !== path));
      return { data: { path }, msg: `repo rm ${path}`, human: () => console.log(`${color(GREEN, "\u2713")} \u5DF2\u79FB\u9664 ${path}`) };
    }
    if (!existsSync6(path) || !statSync2(path).isDirectory()) fail(`\u76EE\u5F55\u4E0D\u5B58\u5728: ${path}`);
    const warnings = [];
    if (!existsSync6(resolve2(path, ".git"))) warnings.push("\u76EE\u5F55\u91CC\u6CA1\u6709 .git\uFF0Cokr commits \u4F1A\u8DF3\u8FC7\u5B83");
    const node = str("node");
    if (node && !nodes.some((n) => n.id === node)) fail(`\u8282\u70B9\u4E0D\u5B58\u5728: ${node}`);
    const next = repos.filter((r) => r.path !== path);
    next.push(node ? { path, node } : { path });
    saveRepos(next);
    return {
      data: { repo: { path, node }, warnings },
      msg: `repo add ${path}`,
      human: () => {
        console.log(`${color(GREEN, "\u2713")} \u5DF2\u767B\u8BB0 ${path}${node ? dim(` \u2192 ${node}`) : ""}`);
        for (const w of warnings) console.log(dim("  ! " + w));
      }
    };
  });
}
function cmdValidate() {
  if (demo) {
    const r = validateData(DEMO_NODES, DEMO_EVENTS);
    printReport(r);
    return;
  }
  requireData();
  let merged = [];
  if (flag("merge-events")) {
    try {
      withLock(() => {
        merged = mergeEventFiles();
        const done = merged.filter((m) => !m.errors.length);
        if (done.length) commit(`validate --merge-events: \u5E76\u5165 ${done.length} \u4E2A\u6587\u4EF6`);
      });
    } catch (err) {
      if (err instanceof LockTimeout) fail(err.message, 4);
      throw err;
    }
  }
  const dir = validateDir();
  let data;
  try {
    data = validateData(loadNodes(), loadEvents());
  } catch (err) {
    data = { errors: [`\u8BFB\u53D6\u6570\u636E\u5931\u8D25: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`], warnings: [] };
  }
  const mergeErrors = merged.flatMap((m) => m.errors);
  printReport({ errors: [...mergeErrors, ...dir.errors, ...data.errors], warnings: [...dir.warnings, ...data.warnings], merged });
}
function printReport(r) {
  const code = r.errors.length ? 3 : 0;
  if (json) console.log(JSON.stringify({ ok: !r.errors.length, ...r }));
  else {
    for (const m of r.merged ?? []) {
      if (m.errors.length) console.log(`${color(RED, "\u2717")} \u672A\u5E76\u5165 ${m.file}\uFF08\u6587\u4EF6\u4FDD\u7559\uFF09`);
      else console.log(`${color(GREEN, "\u2713")} \u5E76\u5165 ${m.file}\uFF1A\u65B0\u589E ${m.added}\uFF0C\u91CD\u590D ${m.skipped}`);
    }
    for (const e of r.errors) console.log(color(RED, "\u2717 ") + e);
    for (const w of r.warnings) console.log(color(214, "! ") + w);
    if (!r.errors.length) console.log(`${color(GREEN, "\u2713")} \u6570\u636E\u6B63\u5E38${r.warnings.length ? dim(`\uFF08${r.warnings.length} \u6761\u63D0\u793A\uFF09`) : ""}`);
  }
  if (code) throw new CliExit(code);
}
function cmdMigrate() {
  if (demo) fail("--demo \u662F\u53EA\u8BFB\u7684");
  try {
    withLock(() => {
      const r = migrate();
      const c = commit("migrate: goals.yaml \u2192 nodes.yaml");
      ok({ nodes: r.nodes.length, events: r.events.length, warnings: r.warnings, committed: c.committed }, () => {
        console.log(`${color(GREEN, "\u2713")} \u8FC1\u79FB\u5B8C\u6210\uFF1A${r.nodes.length} \u8282\u70B9\uFF0C${r.events.length} \u4E8B\u4EF6\u3002\u65E7\u6587\u4EF6\u4FDD\u7559\u4E3A *.migrated\u3002`);
        for (const w of r.warnings) console.log(dim("  ! " + w));
      });
    });
  } catch (err) {
    if (err instanceof LockTimeout) fail(err.message, 4);
    if (err instanceof MigrateError) fail(err.message, 3, { errors: err.errors });
    fail(err.message);
  }
}
function cmdAssess() {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, '\u7528\u6CD5: okr assess <id> --value <0-100> --reason "\u7406\u7531"');
    const value = num("value");
    const reason = str("reason") ?? args._.slice(2).join(" ");
    if (value === void 0) fail("assess \u9700\u8981 --value \u767E\u5206\u6BD4", 3);
    if (!reason) fail("assess \u9700\u8981 --reason \u7406\u7531\uFF0C\u5F15\u7528\u5177\u4F53\u4EFB\u52A1\u548C KR \u72B6\u6001", 3);
    if (n.kind === "metric") fail("metric \u7684\u8FDB\u5EA6\u53EA\u6765\u81EA\u7528\u6237\u53E3\u8FF0\u7684 value\uFF0C\u4E0D\u63A5\u53D7 assess", 3);
    if (n.kind !== "objective" && n.kind !== "milestone") fail("assess \u53EA\u5BF9 objective / milestone", 3);
    if (value < 0 || value > 100) fail("--value \u8981\u5728 0\u2013100", 3);
    const s = state(nodes, events, n.id);
    guardActive(n, s);
    const e = mkEvent(n.id, "assess", reason, { value, derived: s.derived === null ? void 0 : Math.round(s.derived * 100) });
    dedupGuard(events, e);
    appendEvent(e);
    return {
      data: { event: e, node: n.id, derived: s.derived },
      msg: `assess ${n.id}: ${value}%`,
      human: () => console.log(`${color(GREEN, "\u2713")} ${bold(n.id)} \u8BC4\u4F30 ${value}%${dim(`  \u63A8\u5BFC ${pct(s.derived)}`)}`)
    };
  });
}
function cmdRecent() {
  const t = buildTree();
  const days = num("days") ?? 7;
  const node = str("node");
  const since = daysBetween;
  let events = t.all.flatMap((s) => s.events);
  const { events: raw } = load();
  events = [...events, ...raw.filter((e) => !e.node)];
  events = events.filter((e) => since(e.ts, today) <= days && since(e.ts, today) >= 0);
  if (node) {
    const n = pickNode(node, t.all.map((s2) => s2.node), "");
    const s = t.byId.get(n.id);
    const ids = /* @__PURE__ */ new Set([n.id, ...descendants(s).map((x) => x.node.id)]);
    events = events.filter((e) => e.node && ids.has(e.node));
  }
  events = sortEvents(events).reverse();
  ok({ events, days, today }, () => console.log(renderEvents(t, { width: cols, events }).join("\n")));
}
function cmdVelocity() {
  const t = buildTree();
  const v = velocity(t, num("weeks") ?? 4);
  ok({ weeks: v }, () => {
    console.log(dim(" \u5468          \u5B8C\u6210  \u7528\u65F6"));
    for (const w of v) console.log(` ${w.week}   ${String(w.done).padStart(4)}  ${w.hours === null ? dim("\u2014") : `${w.hours}h`}  ${dim(w.ids.join(" "))}`);
  });
}
var weekFlag = (t) => {
  const w = str("week");
  if (w === void 0) return t.week;
  if (!isValidWeek(w)) fail(`--week \u683C\u5F0F\uFF1A2026-W36\uFF0C\u5F97\u5230 "${w}"`);
  return w;
};
function taskLine(f, opts = {}) {
  const st = STAGE_SYM[f.stage];
  const bits = [
    opts.order ? dim(f.order === null ? " -" : String(f.order).padStart(2)) : "",
    color(st.c, st.sym),
    bold(f.id),
    f.name,
    f.priority ? dim(f.priority) : "",
    f.deadline ? f.daysLeft !== null && f.daysLeft < 0 ? color(RED, `~${f.deadline}`) : dim(`~${f.deadline}`) : "",
    flagTags(f.flags.filter((x) => x !== "carry-over")),
    f.claimed ? dim(`@${f.claimed.by}`) : ""
  ].filter(Boolean);
  return " " + bits.join("  ");
}
function cmdBrief() {
  const t = buildTree();
  const { events } = load();
  const b = brief(t, events, REPORTS);
  ok({ ...b }, () => {
    if (b.empty) {
      console.log(`${color(GREEN, "\u2713")} ${today} ${dim(t.week)}  \u4E00\u5207\u6B63\u5E38\uFF0C\u6CA1\u4EC0\u4E48\u8981\u63D0\u7684\u3002`);
      return;
    }
    console.log(`${bold(today)} ${dim(t.week)}`);
    const section = (title, c, rows) => {
      if (!rows.length) return;
      console.log(color(c, ` ${title} (${rows.length})`));
      for (const f of rows) console.log(taskLine(f));
    };
    section("\u5DF2\u903E\u671F", RED, b.overdue);
    section("\u5C06\u5230\u671F", AMBER, b.dueSoon);
    section("\u963B\u585E", RED, b.blocked);
    section("\u505C\u6EDE", GRAY, b.stale);
    section("\u5F85\u9A8C\u6536\u8D85\u65F6", AMBER, b.reviewStale);
    section("\u5DF2\u9886\u53D6", GRAY, b.claimed);
    if (b.behind.length) {
      console.log(color(AMBER, ` \u4E0A\u5C42\u843D\u540E (${b.behind.length})`));
      for (const u of b.behind) {
        const h = HEALTH[u.health];
        console.log(`  ${color(h.c, h.sym)} ${bold(u.id)}  ${u.name}  ${dim(`${h.label} \xB7 \u8FDB\u5EA6 ${pct(u.progress)} / \u65F6\u95F4 ${pct(u.elapsed)}${u.daysQuiet !== null ? ` \xB7 ${u.daysQuiet} \u5929\u6CA1\u52A8\u9759` : ""}`)}`);
      }
    }
    if (b.proposals.length) {
      console.log(color(AMBER, ` \u5F85\u5904\u7406\u7684\u5468\u8BA1\u5212\u63D0\u6848 (${b.proposals.length})`));
      for (const p of b.proposals) console.log(`  ${p.file}  ${dim("okr apply --from " + p.file + " --confirmed\uFF0C\u6216 --dismiss")}`);
    }
  });
}
function cmdWeek() {
  const t = buildTree();
  const { events } = load();
  const w = weekView(t, events, REPORTS, weekFlag(t));
  ok({ ...w, today }, () => {
    const prop = w.proposal === "none" ? "" : `  \u63D0\u6848 ${w.proposal}${w.proposals.length > 1 ? ` (${w.proposals.length})` : ""}`;
    console.log(`${bold(w.week)} ${dim(`${w.start.slice(5)} \u2192 ${w.end.slice(5)}`)}${w.current ? dim("  \u672C\u5468") : ""}${color(w.proposal === "pending" ? AMBER : GRAY, prop)}`);
    if (!w.planned.length) console.log(dim(" \u8FD9\u5468\u8FD8\u6CA1\u6392\u4EFB\u52A1\u3002okr candidates \u770B\u5019\u9009\uFF0C\u63D0\u6848\u5199\u5230 reports/" + w.week + ".plan.yaml \u518D okr apply\u3002"));
    for (const f of w.planned) console.log(taskLine(f, { order: true }));
    if (w.carryOver.length) {
      console.log(color(AMBER, ` \u9057\u7559 (${w.carryOver.length})`) + dim("  \u4E0A\u5468\u53CA\u66F4\u65E9\u6392\u7684\uFF0C\u672A\u5B8C\u6210\uFF1Bapply \u65F6\u5FC5\u987B\u8FDB plan \u6216 drop"));
      for (const f of w.carryOver) console.log(taskLine(f) + dim(`  ${f.week}`));
    }
  });
}
function cmdCandidates() {
  const t = buildTree();
  const rows = candidates(t, { dispatchable: flag("dispatchable") });
  ok({ today, week: t.week, candidates: rows }, () => {
    if (!rows.length) {
      console.log(dim(flag("dispatchable") ? "\u6CA1\u6709\u53EF\u6D3E\u5DE5\u7684\u4EFB\u52A1\uFF08spec \u9F50\u5168\u3001\u4F9D\u8D56\u5DF2\u5B8C\u6210\uFF09\u3002" : "\u6CA1\u6709\u672A\u5B8C\u6210\u7684\u4EFB\u52A1\u3002"));
      return;
    }
    console.log(dim(` ${rows.length} \u4E2A\u5019\u9009 \xB7 \u6309\u4F18\u5148\u7EA7 \u2192 \u622A\u6B62 \u6392\u5E8F\uFF0C\u600E\u4E48\u9009\u770B protocol \xA76`));
    for (const c of rows) {
      const tags = [
        c.planned ? dim(c.week) : "",
        c.carryOver ? color(AMBER, "\u9057\u7559") : "",
        c.upper ? dim(`${c.upper.id}${c.upper.gap !== null ? ` ${c.upper.gap >= 0 ? "+" : ""}${Math.round(c.upper.gap * 100)}%` : ""}`) : "",
        c.depsOpen ? color(AMBER, `\u7B49 ${c.deps.filter((d) => !d.done).map((d) => d.id).join(",")}`) : "",
        c.dependents.length ? dim(`\u2192 ${c.dependents.join(",")}`) : "",
        c.dispatchable ? color(GREEN, "\u53EF\u6D3E") : c.specMissing.length ? dim(`\u7F3A ${c.specMissing.join("/")}`) : ""
      ].filter(Boolean);
      console.log(taskLine(c) + "  " + tags.join("  "));
    }
  });
}
function sinceOrFail(events, dflt) {
  const spec = str("since") ?? dflt;
  const r = resolveSince(events, spec);
  if (!r) fail(`--since \u63A5\u53D7 last-daily / last-weekly / \u65E5\u671F / ISO \u65F6\u95F4\uFF0C\u5F97\u5230 "${spec}"`);
  return r;
}
function cmdChanges() {
  const t = buildTree();
  const { events } = load();
  const s = sinceOrFail(events, "last-daily");
  const rows = changes(events, s.since);
  ok({ since: s.since, spec: s.spec, anchor: s.anchor, events: rows, today }, () => {
    console.log(dim(s.since ? ` \u81EA ${s.since}${s.anchor ? `\uFF08\u4E0A\u6B21 ${s.anchor.kind === "daily" ? "\u65E5\u62A5" : "\u5468\u62A5"}\uFF09` : ""} \u8D77 ${rows.length} \u6761` : ` \u6CA1\u6709${s.spec === "last-daily" ? "\u65E5\u62A5" : "\u5468\u62A5"}\u951A\u70B9\uFF0C\u5217\u51FA\u5168\u90E8 ${rows.length} \u6761`));
    if (rows.length) console.log(renderEvents(t, { width: cols, events: rows }).join("\n"));
  });
}
function cmdCommits() {
  requireData();
  const { events } = load();
  const s = sinceOrFail(events, "last-weekly");
  const limit = num("limit") ?? 200;
  if (limit < 1) fail("--limit \u81F3\u5C11\u4E3A 1");
  const node = str("node");
  let repos = loadRepos();
  if (node) repos = repos.filter((r) => r.node === node);
  const rows = repoCommits(repos, s.since, limit);
  ok({ since: s.since, spec: s.spec, limit, repos: rows, today }, () => {
    if (!rows.length) {
      console.log(dim(node ? `\u6CA1\u6709\u767B\u8BB0\u5230 ${node} \u7684\u4ED3\u5E93\u3002` : "\u6CA1\u6709\u767B\u8BB0\u4ED3\u5E93\u3002okr repo add <path> --node <id>"));
      return;
    }
    console.log(dim(s.since ? ` \u81EA ${s.since}${s.anchor ? "\uFF08\u4E0A\u6B21\u5468\u62A5\uFF09" : ""} \u8D77` : " \u6CA1\u6709\u5468\u62A5\u951A\u70B9\uFF0C\u53D6\u6700\u8FD1\u7684\u63D0\u4EA4"));
    for (const r of rows) {
      console.log(`${bold(r.path)}${r.node ? dim(`  \u2192 ${r.node}`) : ""}${r.error ? color(RED, `  \u2717 ${r.error}`) : dim(`  ${r.commits.length} \u4E2A\u63D0\u4EA4`)}`);
      for (const c of r.commits) console.log(`  ${dim(c.date.slice(0, 10))} ${color(GRAY, c.hash)} ${c.subject}${dim(` \u2014 ${c.author}`)}`);
    }
  });
}
function planPath() {
  const from = str("from");
  if (!from) fail("\u7528\u6CD5: okr apply --from <plan.yaml> --confirmed | okr apply --dismiss [--from <plan.yaml>]");
  const direct = resolve2(from);
  if (existsSync6(direct)) return direct;
  const inReports = resolve2(REPORTS, from);
  if (existsSync6(inReports)) return inReports;
  fail(`\u627E\u4E0D\u5230 ${from}\uFF08\u4E5F\u4E0D\u5728 ${REPORTS}\uFF09`);
}
function cmdApply() {
  if (flag("dismiss")) return cmdDismiss();
  const path = planPath();
  let parsed;
  try {
    parsed = import_yaml3.default.parse(readFileSync5(path, "utf8"));
  } catch (err) {
    fail(`${path} \u4E0D\u662F\u5408\u6CD5 YAML: ${err.message.split("\n")[0]}`);
  }
  if (!confirmed) fail("apply \u4F1A\u6539\u7ED3\u6784\uFF0C\u8981 --confirmed\uFF08skill \u5728\u7528\u6237\u770B\u8FC7\u63D0\u6848\u70B9\u5934\u540E\u4F20\uFF09", 3);
  const file = basename3(path);
  write((nodes, events) => {
    const t = project(nodes, events, today);
    let r;
    try {
      r = applyPlan(nodes, events, t, parsed);
    } catch (err) {
      if (err instanceof PlanError) fail(err.message, err.code, err.extra);
      throw err;
    }
    const v = guardValidate(nodes, r.nodes, events);
    const warnings = [...r.warnings, ...v.warnings.filter((w2) => r.created.some((c) => w2.startsWith(`\u8282\u70B9 ${c.id} `)) || r.planned.some((p) => w2.startsWith(`\u8282\u70B9 ${p.id} `)))];
    if (resolve2(dirname2(path)) !== resolve2(REPORTS)) warnings.push(`${file} \u4E0D\u5728 ${REPORTS} \u4E0B\uFF0Cweek --json \u7684 proposal \u4E0D\u4F1A\u8FFD\u8E2A\u5B83`);
    saveNodes(r.nodes);
    const written = [];
    for (const c of r.created) written.push(mkEvent(c.id, "change", `add ${describe(c)}`));
    for (const n of r.notes) written.push(mkEvent(n.id, "change", n.note));
    const summary = `apply ${file}: ${r.week} \u65B0\u5EFA ${r.created.length}\uFF0C\u8BA1\u5212 ${r.planned.length}\uFF0C\u9000\u51FA ${r.dropped.length}${r.kept.length ? `\uFF0C\u4FDD\u7559 ${r.kept.length}` : ""}`;
    written.push(mkEvent(null, "plan", summary, { source: file, week: r.week }));
    for (const e of written) appendEvent(e);
    const after = project(r.nodes, [...events, ...written], today);
    const w = weekView(after, [...events, ...written], REPORTS, r.week);
    return {
      data: { week: r.week, file, created: r.created, planned: r.planned, kept: r.kept, dropped: r.dropped, warnings, events: written, plan: w.planned },
      msg: summary,
      human: () => {
        console.log(`${color(GREEN, "\u2713")} ${summary}`);
        for (const f of w.planned) console.log(taskLine(f, { order: true }));
        for (const d of r.dropped) console.log(dim(`  \u9000\u51FA ${d.id}\uFF08\u539F ${d.before}\uFF09`));
        for (const x of warnings) console.log(color(AMBER, "  ! ") + x);
      }
    };
  });
}
function cmdDismiss() {
  const from = str("from");
  write((nodes, events) => {
    const t = project(nodes, events, today);
    let files = proposalFiles(REPORTS, from ? /^(\d{4}-W\d{2})\./.exec(basename3(from))?.[1] ?? t.week : weekFlag(t), events);
    if (from) files = files.filter((f) => f.file === basename3(from));
    if (from && !files.length) fail(`${basename3(from)} \u4E0D\u5728 ${REPORTS} \u4E0B\uFF0C\u6216\u4E0D\u7B26\u5408 <\u5468>.plan[-N].yaml \u547D\u540D`);
    const pending = files.filter((f) => f.status === "pending");
    if (!pending.length) fail(from ? `${basename3(from)} \u5DF2\u7ECF\u5904\u7406\u8FC7\uFF08${files[0].status}\uFF09` : `${t.week} \u6CA1\u6709\u5F85\u5904\u7406\u7684\u63D0\u6848`, 3, { files });
    const written = pending.map((f) => mkEvent(null, "plan", `dismiss ${f.file}`, { source: f.file, week: f.week, dismissed: true }));
    for (const e of written) appendEvent(e);
    return {
      data: { dismissed: pending.map((f) => f.file), events: written },
      msg: `dismiss ${pending.map((f) => f.file).join(" ")}`,
      human: () => console.log(`${color(GREEN, "\u2713")} \u5DF2\u653E\u5F03\u63D0\u6848 ${pending.map((f) => f.file).join("\u3001")}`)
    };
  });
}
function cmdReport() {
  const sub = args._[1];
  if (sub === "write") fail("report write \u5728\u4E0B\u4E00\u6B65\u5B9E\u73B0\uFF1B\u5148\u7528 okr report data --json \u53D6\u6570\u636E\uFF0C\u62A5\u544A\u7531 skill \u5199\u5230 reports/\u3002");
  if (sub !== "data") fail("\u7528\u6CD5: okr report data [--week 2026-W36]");
  const t = buildTree();
  const { events } = load();
  const r = reportData(t, events, REPORTS, weekFlag(t));
  ok({ ...r }, () => {
    console.log(`${bold(r.week)} ${dim(`${r.start} \u2192 ${r.end}`)}${r.current ? dim("  \u672C\u5468") : ""}`);
    const moved = r.nodes.filter((n) => n.kind !== "task" && n.kind !== "habit");
    if (moved.length) {
      console.log(dim(" \u76EE\u6807 / KR / \u91CC\u7A0B\u7891"));
      for (const n of moved) {
        const h = HEALTH[n.health];
        const delta = n.delta === null ? "" : n.delta === 0 ? dim("  \u2014") : color(n.delta > 0 ? GREEN : RED, `  ${n.delta > 0 ? "+" : ""}${Math.round(n.delta * 100)}%`);
        console.log(`  ${"  ".repeat(n.depth)}${color(h.c, h.sym)} ${bold(n.id)} ${n.name}  ${dim(pct(n.progress))}${delta}${n.current !== null ? dim(`  ${n.current}${n.unit ?? ""}`) : ""}`);
      }
    }
    console.log(dim(` \u5B8C\u6210 ${r.done.length} \u4E2A\u4EFB\u52A1`) + (r.done.length ? "  " + r.done.map((d) => `${d.id}${d.hours !== null ? `(${d.hours}h)` : ""}`).join(" ") : ""));
    const ev2 = Object.entries(r.events).map(([k, v]) => `${k} ${v}`).join(" \xB7 ");
    if (ev2) console.log(dim(` \u4E8B\u4EF6  ${ev2}`));
    console.log(dim(` \u5468\u8BA1\u5212 ${r.plan.planned.length} \u4E2A\uFF0C\u9057\u7559 ${r.plan.carryOver.length} \u4E2A\uFF0C\u63D0\u6848 ${r.plan.proposal}`));
    if (!r.brief.empty) console.log(dim(` \u5F85\u5173\u6CE8  \u903E\u671F ${r.brief.overdue.length} \xB7 \u5C06\u5230\u671F ${r.brief.dueSoon.length} \xB7 \u963B\u585E ${r.brief.blocked.length} \xB7 \u505C\u6EDE ${r.brief.stale.length} \xB7 \u4E0A\u5C42\u843D\u540E ${r.brief.behind.length}`));
    console.log(dim(" \u5B8C\u6574\u6570\u636E okr report data --json"));
  });
}
function nodeJson(s) {
  const task = s.node.kind === "task";
  return {
    ...s.node,
    derived: s.derived,
    assess: s.assess,
    progress: s.progress,
    current: s.current,
    elapsed: s.elapsed,
    health: s.health,
    flags: s.flags,
    undecomposed: s.undecomposed,
    last: s.last?.ts ?? null,
    lastInTree: s.lastInTree?.ts ?? null,
    habit: s.habit ? { ...s.habit, days: [...s.habit.days] } : void 0,
    children: s.children.map((c) => c.node.id),
    ...task ? { stage: s.stage, planned: s.planned, carryOver: s.carryOver, dispatchable: s.dispatchable, claimed: s.claimed, blocked: s.blocked } : {}
  };
}
function cmdStatus() {
  const t = buildTree();
  ok({ today, week: t.week, nodes: t.roots.map(nodeJson) }, () => console.log(renderStatus(t, { width: cols }).join("\n")));
}
function cmdTree() {
  const t = buildTree();
  ok({ today, week: t.week, nodes: t.all.map(nodeJson) }, () => console.log(renderTree(t, { width: cols, showDone: flag("all") }).lines.join("\n")));
}
function cmdShow() {
  const t = buildTree();
  const n = pickNode(args._[1], t.all.map((s2) => s2.node), "\u7528\u6CD5: okr show <id> [--spec]");
  const s = t.byId.get(n.id);
  if (flag("spec")) return showSpec(t, s);
  ok({ node: nodeJson(s), events: s.events }, () => console.log(renderDetail(s, { width: cols, today, colorIdx: rootIndex(t, s), maxEvents: num("limit") ?? 12, tree: t }).join("\n")));
}
function showSpec(t, s) {
  const n = s.node;
  if (n.kind !== "task") fail(`${n.id} \u4E0D\u662F task\uFF0C\u6CA1\u6709\u6D3E\u5DE5\u5305`);
  const sp = n.spec ?? {};
  const deps = (n.deps ?? []).map((d) => {
    const dep = t.byId.get(d);
    return { id: d, name: dep?.node.name ?? "?", done: !!dep && (dep.stage === "done" || dep.effective === "canceled") };
  });
  const submits = s.events.filter((e) => e.type === "submit").map((e) => ({ ts: e.ts, by: e.by, links: e.links ?? [] }));
  const rejects = s.events.filter((e) => e.type === "reject").map((e) => ({ ts: e.ts, by: e.by, note: e.note, body: e.body }));
  const agent = by ?? "<agent>";
  const sess = session ?? "<session>";
  const commands = [
    `okr claim ${n.id} --by ${agent} --session ${sess} --json`,
    `okr block ${n.id} "\u5361\u5728\u54EA" --by ${agent} --session ${sess} --json`,
    `okr log ${n.id} "\u89E3\u9664\u963B\u585E / \u5173\u952E\u8FDB\u5C55" --by ${agent} --session ${sess} --json`,
    `okr submit ${n.id} --link <PR> --by ${agent} --session ${sess} --json`
  ];
  const pathIds = [];
  let p = s.parent;
  while (p) {
    pathIds.unshift(`${p.node.id} ${p.node.name}`);
    p = p.parent;
  }
  ok(
    { id: n.id, name: n.name, path: pathIds, stage: s.stage, dispatchable: s.dispatchable, spec: sp, missing: specMissing2(n), deps, claimed: s.claimed, submits, rejects, commands },
    () => {
      const L = [];
      L.push(`# \u4EFB\u52A1 ${n.id}\uFF1A${n.name}`);
      if (pathIds.length) L.push(`\u6240\u5C5E\uFF1A${pathIds.join(" \u203A ")}`);
      L.push(`\u9636\u6BB5\uFF1A${STAGE_LABEL[s.stage]}${n.priority ? `  \u4F18\u5148\u7EA7\uFF1A${n.priority}` : ""}${n.deadline ? `  \u622A\u6B62\uFF1A${n.deadline}` : ""}`);
      if (s.claimed) L.push(`\u5DF2\u9886\u53D6\uFF1A${s.claimed.by}${s.claimed.session ? ` (${s.claimed.session})` : ""} @ ${s.claimed.ts}`);
      L.push("");
      L.push(`## \u76EE\u6807`, sp.goal ?? "\uFF08\u7F3A\uFF09", "");
      L.push("## \u9A8C\u6536\u6807\u51C6");
      if (sp.accept?.length) sp.accept.forEach((a, i) => L.push(`${i + 1}. ${a}`));
      else L.push("\uFF08\u7F3A\uFF09");
      L.push("", "## \u9A8C\u8BC1\u547D\u4EE4", sp.verify ? "```\n" + sp.verify + "\n```" : "\uFF08\u7F3A\uFF09", "");
      L.push("## \u94FE\u63A5");
      if (sp.links?.length) for (const l of sp.links) L.push(`- ${l}`);
      else L.push("\uFF08\u7F3A\uFF09");
      if (deps.length) {
        L.push("", "## \u4F9D\u8D56");
        for (const d of deps) L.push(`- ${d.done ? "[x]" : "[ ]"} ${d.id} ${d.name}`);
      }
      if (submits.length) {
        L.push("", "## \u5386\u53F2\u63D0\u4EA4");
        for (const x of submits) L.push(`- ${dayOf(x.ts)} ${x.by ?? ""} ${x.links.join(" ")}`);
      }
      if (rejects.length) {
        L.push("", "## \u6253\u56DE\u610F\u89C1");
        for (const x of rejects) L.push(`- ${dayOf(x.ts)}\uFF1A${x.note}${x.body ? "\n  " + x.body.replace(/\n/g, "\n  ") : ""}`);
      }
      if (s.dispatchable) L.push("", "> \u53EF\u6D3E\u5DE5");
      if (!s.dispatchable) L.push("", `> \u4E0D\u53EF\u6D3E\u5DE5\uFF1A${specMissing2(n).length ? "spec \u7F3A " + specMissing2(n).join("\u3001") : deps.some((d) => !d.done) ? "\u4F9D\u8D56\u672A\u5B8C\u6210" : s.stage === "done" ? "\u5DF2\u5B8C\u6210" : "\u72B6\u6001\u975E active"}`);
      L.push("", "## \u56DE\u5199\u547D\u4EE4\uFF08\u7167\u6284\uFF09", "```");
      L.push(...commands);
      L.push("```");
      console.log(L.join("\n"));
    }
  );
}
function specMissing2(n) {
  const sp = n.spec ?? {};
  const m = [];
  if (!sp.goal) m.push("goal");
  if (!sp.accept?.length) m.push("accept");
  if (!sp.verify) m.push("verify");
  if (!sp.links?.length) m.push("links");
  return m;
}
function cmdTui() {
  requireData();
  if (!process.stdout.isTTY || !process.stdin.isTTY) fail("tui \u9700\u8981\u7EC8\u7AEF\u3002\u975E\u4EA4\u4E92\u73AF\u5883\u7528 okr status / okr tree\u3002");
  void runTui({ load, today, readOnly: demo });
}
function cmdProtocol() {
  let text;
  let path = "bundled";
  if (true) text = '# okr \u534F\u8BAE\uFF08agent \u901A\u7528\uFF09\n\n\u4EFB\u4F55 agent\uFF08Claude Code\u3001Codex\u3001Gemini\u3001\u6267\u884C agent\uFF09\u66FF\u7528\u6237\u8BFB\u5199 `~/.okr` \u90FD\u6309\u8FD9\u4EFD\u6587\u6863\u6765\u3002\u5B83\u4E0D\u4F9D\u8D56\u67D0\u4E2A agent \u7684 skill \u673A\u5236\uFF1B\u4ED3\u5E93\u91CC\u7684 `okr` skill\uFF08\u7ED9\u5BF9\u8BDD agent\uFF1B\u6267\u884C agent \u6682\u65E0\u5355\u72EC skill\uFF0C\u62FF\u5230\u6D3E\u5DE5\u5305\u6309 \xA79 \u5951\u7EA6\u505A\uFF09\u548C `AGENTS.okr.md` \u7247\u6BB5\u90FD\u53EA\u662F\u628A\u8FD9\u4EFD\u6587\u6863\u63A5\u8FDB\u5404\u81EA\u7684\u5BF9\u8BDD\u3002\u6570\u636E\u6A21\u578B\u3001\u63A8\u5BFC\u89C4\u5219\u548C\u5B88\u536B\u7684\u5B8C\u6574\u5B9A\u4E49\u5728 `DESIGN.md`\uFF0C\u8FD9\u91CC\u53EA\u8BB2 agent \u8BE5\u600E\u4E48\u505A\u3002\n\n## 0. \u4E09\u53E5\u8BDD\n\n1. \u53EA\u901A\u8FC7 `okr` \u547D\u4EE4\u8BFB\u5199\uFF0C\u6C38\u8FDC\u5E26 `--json`\uFF1B\u4E0D\u76F4\u63A5\u6539 `~/.okr` \u91CC\u7684\u6587\u4EF6\uFF0C\u4E0D\u5728 `~/.okr` \u91CC\u8DD1 git\u3002\n2. \u72B6\u6001\u4ECE\u4E8B\u4EF6\u63A8\u5BFC\uFF0Cagent \u53EA\u8D1F\u8D23\u628A\u7528\u6237\u8BF4\u7684\u8BDD\u7FFB\u6210\u5BF9\u7684\u4E8B\u4EF6\uFF0C\u5199\u4E4B\u524D\u5148\u770B `okr recent`\u3002\n3. \u52A8\u7ED3\u6784\u3001\u6807 KR / \u76EE\u6807 / \u91CC\u7A0B\u7891\u5B8C\u6210\u3001\u843D\u5468\u8BA1\u5212\uFF0C\u90FD\u8981\u7528\u6237\u70B9\u5934\uFF0C\u70B9\u5934\u540E\u624D\u4F20 `--confirmed`\u3002\n\n## 1. \u73AF\u5883\u4E0E\u7EA6\u5B9A\n\n- \u6570\u636E\u76EE\u5F55 `OKR_DIR`\uFF0C\u7F3A\u7701 `~/.okr`\u3002\u6CA1\u6709 `nodes.yaml` \u5C31\u5148\u95EE\u7528\u6237\u662F\u5426 `okr init`\uFF08\u65E7 `goals.yaml` \u7528 `okr migrate`\uFF09\u3002\n- `--by <agent>` \u6807\u8BB0\u5199\u5165\u8005\uFF1AClaude Code \u7528 `claude`\uFF0CCodex \u7528 `codex`\uFF0CGemini \u7528 `gemini`\uFF0C\u6267\u884C agent \u7528\u6D3E\u5DE5\u5305\u91CC\u7ED9\u7684\u540D\u5B57\u3002\u6BCF\u6761\u547D\u4EE4\u663E\u5F0F\u4F20\uFF0C\u4E0D\u4F9D\u8D56\u73AF\u5883\u53D8\u91CF `OKR_BY`\uFF08agent \u7684 shell \u73AF\u5883\u4E0D\u6301\u4E45\uFF09\u3002\n- `--json` \u8BFB\u5199\u90FD\u652F\u6301\uFF0C\u9519\u8BEF\u4E5F\u662F JSON\uFF08`{ok:false,error,code}`\uFF09\u3002\u4EBA\u7C7B\u53EF\u8BFB\u8F93\u51FA\u53EA\u7ED9\u7528\u6237\u770B\uFF0Cagent \u89E3\u6790 JSON\u3002\n- \u9000\u51FA\u7801\uFF1A0 \u6210\u529F\uFF1B1 \u4E00\u822C\u9519\u8BEF\uFF1B2 \u6307\u4EE3\u6B67\u4E49\u6216\u6CA1\u6709\u5339\u914D\uFF08JSON \u91CC\u5E26 `candidates`\uFF0C\u4E3A\u7A7A\u5373\u6CA1\u6709\u8FD9\u4E2A\u8282\u70B9\uFF09\uFF1B3 \u5B88\u536B\u62D2\u7EDD\u6216 validate \u5931\u8D25\uFF1B4 \u9501\u8D85\u65F6\uFF08\u7B49\u4E00\u79D2\u91CD\u8BD5\u4E00\u6B21\uFF0C\u518D\u5931\u8D25\u5C31\u62A5\u7ED9\u7528\u6237\uFF09\u3002\n- \u65F6\u95F4\uFF1A\u4E8B\u4EF6\u65F6\u95F4 `ts` \u7F3A\u7701\u4E3A\u5199\u5165\u65F6\u523B\u3002\u7528\u6237\u8BF4\u7684\u662F\u4E4B\u524D\u53D1\u751F\u7684\u4E8B\uFF08\u300C\u6628\u5929\u8DD1\u5B8C\u4E86\u300D\u300C\u4E0A\u5468\u63D0\u7684 PR\u300D\uFF09\uFF0C\u4F20 `--at 2026-09-02`\uFF08\u65E5\u671F\u53D6\u5F53\u5929\u4E2D\u5348\uFF0C\u4ECA\u5929\u53D6\u5F53\u524D\u65F6\u523B\uFF09\u6216\u5B8C\u6574\u672C\u5730\u65F6\u95F4 `--at 2026-09-02T21:00:00+08:00`\u3002\u672A\u6765\u65F6\u95F4\u4F1A\u88AB\u62D2\u7EDD\u3002\n- `--today` \u53EA\u7ED9\u8BFB\u547D\u4EE4\u505A\u300C\u5047\u88C5\u4ECA\u5929\u662F\u300D\u7528\uFF0C\u5199\u547D\u4EE4\u4F20\u4E86\u4F1A\u88AB\u62D2\u7EDD\u3002`--demo` \u662F\u53EA\u8BFB\u793A\u4F8B\u6570\u636E\u3002\n- \u8282\u70B9\u53EF\u4EE5\u7528 id \u6216\u540D\u5B57\u5173\u952E\u8BCD\u6307\u4EE3\u3002CLI \u5339\u914D\u5230\u591A\u4E2A\u4F1A\u9000\u51FA\u7801 2 \u5E76\u5217\u51FA\u5019\u9009\uFF0Cagent \u628A\u5019\u9009\u5217\u7ED9\u7528\u6237\u9009\uFF0C\u4E0D\u81EA\u5DF1\u731C\u3002\n- \u4E0D\u8BA4\u8BC6\u7684 `--flag` \u4F1A\u88AB\u62D2\u7EDD\uFF0C\u522B\u81EA\u5DF1\u53D1\u660E\u53C2\u6570\u3002\n\n### \u547D\u4EE4\u5B9E\u73B0\u72B6\u6001\n\nDESIGN.md \xA78 \u5206\u4E94\u6B65\u5F00\u53D1\uFF0C\u76EE\u524D\u5230\u7B2C 2 \u6B65\u3002\u534F\u8BAE\u6309\u6700\u7EC8\u5F62\u6001\u5199\uFF0C\u4E0B\u8868\u6807\u660E\u54EA\u4E9B\u547D\u4EE4\u5DF2\u7ECF\u80FD\u7528\uFF0C\u6CA1\u5230\u4F4D\u7684\u5148\u7528\u66FF\u4EE3\u3002\n\n| \u547D\u4EE4 | \u72B6\u6001 | \u672A\u5B9E\u73B0\u65F6\u7684\u66FF\u4EE3 |\n|---|---|---|\n| `init` `add` `edit` `move` `rm` `tree` `show [--spec]` `validate` `migrate` `repo add\\|rm\\|list` | \u53EF\u7528 | |\n| `log` `done` `block` `claim` `submit` `reject` `assess` `check` `recent` | \u53EF\u7528 | |\n| `status` `velocity` `protocol` | \u53EF\u7528 | |\n| `tui` | \u53EF\u7528\uFF0C\u4EC5\u9650\u7EC8\u7AEF | \u9700\u8981 TTY\uFF0Cagent \u73AF\u5883\u4E0B\u9000\u51FA 1\uFF0Cagent \u7528 `status` / `tree` |\n| `brief` `week [--week W]` `candidates [--dispatchable]` `changes --since` `commits [--since] [--limit]` `apply --from <plan.yaml> --confirmed` / `apply --dismiss` `report data [--week W]` | \u53EF\u7528 | |\n| `report write` `deliver notes` | \u5F85\u5B9E\u73B0\uFF08\xA78 \u6B65 4\uFF09 | \u65E5\u62A5 / \u5468\u62A5\u7531 agent \u7528 `okr changes --json` / `okr report data --json` \u7684\u6570\u636E\u5199\u6210 markdown \u653E\u5230 `reports/`\uFF0C\u5199\u5B8C\u8BB0\u4E00\u6761 report \u4E8B\u4EF6\u7684\u673A\u5236\u968F\u6B65 4 \u4E00\u8D77\u6765 |\n\n## 2. \u4F1A\u8BDD\u5F00\u59CB\n\n\u5148\u8DD1 `okr brief --json`\u3002`empty` \u4E3A true \u5C31\u4E00\u4E2A\u5B57\u4E0D\u63D0\uFF1B\u5426\u5219\u6309 `overdue` / `dueSoon` / `blocked` / `stale` / `reviewStale` / `claimed` / `behind`\uFF08\u843D\u540E\u6216\u95F2\u7F6E\u7684\u76EE\u6807 / KR / \u91CC\u7A0B\u7891\uFF09/ `proposals`\uFF08\u5F85\u786E\u8BA4\u63D0\u6848\uFF09\u6311\u8981\u7D27\u7684\u8BF4\u3002\u6709\u4E8B\u624D\u63D0\u4E00\u53E5\uFF0C\u6CA1\u4E8B\u4E0D\u8BF4\uFF1A\u5230\u671F\u4E0E\u5C06\u5230\u671F\u3001\u963B\u585E\u3001\u505C\u6EDE\u3001\u5F85\u9A8C\u6536\u8D85\u8FC7 3 \u5929\u3001\u5DF2\u88AB\u6267\u884C agent \u9886\u53D6\u7684\u4EFB\u52A1\u3001\u5F85\u786E\u8BA4\u7684\u5468\u8BA1\u5212\u63D0\u6848\u3002\n\n\u6709\u5F85\u786E\u8BA4\u63D0\u6848\uFF08`week --json` \u7684 `proposal` \u4E3A `pending`\uFF09\uFF1A\u63D0\u9192\u7528\u6237\u786E\u8BA4\uFF0C\u7528\u6237\u70B9\u5934\u5C31 `apply --from <file> --confirmed`\uFF0C\u5426\u6389\u5C31 `apply --dismiss`\u3002\n\n## 3. \u5199\u4E4B\u524D\n\n1. **\u6307\u4EE3**\uFF1A\u786E\u5B9A\u76EE\u6807\u8282\u70B9\u3002\u7528\u6237\u8BF4\u7684\u540D\u5B57\u4E0D\u552F\u4E00\u5C31\u628A\u5019\u9009\u5217\u51FA\u6765\u95EE\uFF0C\u4E0D\u731C\u3002\n2. **\u67E5\u91CD**\uFF1A`okr recent --node <id> --days 7 --json`\u3002CLI \u53EA\u62FF\u8282\u70B9\u7684\u4E0A\u4E00\u6761\u4E8B\u4EF6\u6BD4\uFF1A\u540C\u4E00\u5929\u3001\u540C\u7C7B\u578B\u3001\u5B57\u9762\u76F8\u8FD1\u624D\u62D2\uFF0C\u4E2D\u95F4\u9694\u4E86\u522B\u7684\u4E8B\u4EF6\u5C31\u4E0D\u62E6\uFF08habit \u7684 `check` \u4F8B\u5916\uFF0C\u540C\u4E00\u5929\u53EA\u6536\u4E00\u6B21\uFF09\uFF1B\u300C\u7528\u6237\u4E0A\u5348\u8BF4\u4E86 AUC \u5230 0.8\uFF0C\u4E0B\u5348\u53C8\u63D0\u4E00\u904D\u300D\u8FD9\u7C7B\u8BED\u4E49\u91CD\u590D\u662F agent \u7684\u4E8B\uFF0C\u5DF2\u7ECF\u8BB0\u8FC7\u7684\u4E0D\u518D\u5199\u3002\u7528\u6237\u660E\u786E\u8BF4\u300C\u518D\u8BB0\u4E00\u6761\u300D\u624D\u52A0 `--force`\u3002\n3. **\u5F52\u5C5E**\uFF1A\u8FD9\u53E5\u8BDD\u5C5E\u4E8E\u54EA\u4E2A\u4EFB\u52A1\u3001\u54EA\u4E2A KR\uFF0C\u7531 agent \u5224\u65AD\u3002\u770B\u6811\uFF08`okr tree --json`\uFF09\u3001\u770B\u4ED3\u5E93\u7684 `.okr.yaml`\u3001\u770B\u6700\u8FD1\u4E8B\u4EF6\u3002\u5224\u65AD\u9519\u4E86\u76F4\u63A5\u6539\uFF1A\u4E8B\u4EF6\u4E0D\u5220\uFF0C\u8865\u4E00\u6761\u6B63\u786E\u7684\uFF0C`note` \u91CC\u8BF4\u660E\u300C\u4E0A\u4E00\u6761\u8BB0\u9519\u8282\u70B9\u300D\u3002\n4. **\u6570\u503C\u53EA\u7531\u7528\u6237\u53E3\u8FF0**\uFF1Ametric \u7684 `--value`\u3001\u4EFB\u52A1\u7684 `--hours`\uFF0C\u7528\u6237\u6CA1\u8BF4\u5C31\u4E0D\u5199\uFF0C\u4E0D\u8981\u4ECE PR\u3001\u65E5\u5FD7\u6216\u4E0A\u4E0B\u6587\u63A8\u7B97\u3002\u300C\u5E94\u8BE5\u5230 90 \u4E86\u5427\u300D\u8FD9\u7C7B\u731C\u6D4B\u8BED\u6C14\u5148\u786E\u8BA4\u662F\u4E0D\u662F\u5B9E\u6D4B\u503C\uFF0C\u786E\u8BA4\u524D\u4E0D\u5199\u3002\n\n## 4. \u7528\u6237\u7684\u8BDD \u2192 \u4E8B\u4EF6\n\n| \u7528\u6237\u8BF4 | \u5199\u4EC0\u4E48 |\n|---|---|\n| \u6709\u8FDB\u5C55\u3001\u505A\u4E86\u70B9\u4EC0\u4E48\u3001\u7EA0\u6B63\u4E4B\u524D\u7684\u6570\u5B57 | `okr log <id> "\u4E00\u53E5\u8BDD" [--value N] [--hours N] [--link URL]` |\n| metric \u5230\u4E86\u67D0\u4E2A\u503C | `okr log <kr> "\u6765\u6E90\u6216\u4F9D\u636E" --value N`\u3002value \u662F metric \u5355\u4F4D\u7684\u7EDD\u5BF9\u503C\uFF0C\u4E0D\u662F\u767E\u5206\u6BD4 |\n| \u4EFB\u52A1\u505A\u5B8C\u4E86 | `okr done <task> [--hours N]` |\n| KR / \u76EE\u6807 / \u91CC\u7A0B\u7891\u5B8C\u6210\u4E86 | \u5148\u95EE\u300C\u786E\u8BA4 <\u540D\u5B57> \u5B8C\u6210\uFF1F\u300D\uFF0C\u7528\u6237\u70B9\u5934\u540E `okr done <id> --confirmed` |\n| \u5361\u4F4F\u4E86\u3001\u7B49\u4EBA\u3001\u7B49\u63A5\u53E3 | `okr block <id> "\u5361\u5728\u54EA"`\uFF08\u53EA\u5BF9 task / milestone\uFF09 |\n| \u4E0D\u5361\u4E86\u3001\u6062\u590D\u4E86 | `okr log <id> "\u89E3\u9664\u963B\u585E\uFF1A\u2026"`\u3002\u4EFB\u4E00\u9636\u6BB5\u4E8B\u4EF6\u90FD\u89E3\u9664\u963B\u585E\uFF0C\u4E0D\u9700\u8981\u4E13\u95E8\u547D\u4EE4 |\n| \u9A8C\u6536\u4E0D\u901A\u8FC7\u3001\u8981\u6539 | `okr reject <task> "\u610F\u89C1"`\uFF0C\u4EFB\u52A1\u56DE\u8FDB\u884C\u4E2D\uFF0C`claimed` \u6E05\u7A7A\uFF0C\u91CD\u6D3E\u8981\u6267\u884C agent \u91CD\u65B0 `claim` |\n| \u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1\u8981\u91CD\u65B0\u6253\u5F00 | `okr reject <id> "\u539F\u56E0"`\uFF1B\u975E task \u52A0 `--confirmed` |\n| \u4E60\u60EF\u6253\u5361 | `okr check <habit> [--at \u65E5\u671F]` |\n| \u4E60\u60EF\u4E0D\u505A\u4E86 | `okr edit <habit> --status canceled --confirmed`\uFF08\u4E60\u60EF\u6CA1\u6709 done\uFF09 |\n| \u6682\u505C\u4E00\u4E2A\u76EE\u6807 / \u6062\u590D | `okr edit <id> --status frozen` / `--status active` |\n| \u53D6\u6D88 | `okr edit <id> --status canceled --confirmed` |\n\n\u51BB\u7ED3\u6216\u53D6\u6D88\u7684\u5B50\u6811\u9ED8\u8BA4\u62D2\u7EDD\u4E8B\u4EF6\u7C7B\u5199\u5165\uFF08\u9000\u51FA\u7801 3\uFF09\u3002\u9047\u5230\u5C31\u544A\u8BC9\u7528\u6237\u8FD9\u4E2A\u8282\u70B9\u5DF2\u51BB\u7ED3 / \u53D6\u6D88\uFF0C\u95EE\u662F\u89E3\u51BB\u8FD8\u662F\u7167\u8BB0\uFF08\u7167\u8BB0\u52A0 `--force`\uFF09\uFF0C\u4E0D\u8981\u81EA\u4F5C\u4E3B\u5F20 `--force`\u3002\n\n## 5. \u4E0A\u5C42\u8FDB\u5EA6\u4E0E assess\n\n- \u4E0A\u5C42\u8282\u70B9\uFF08objective / milestone\uFF09\u7684\u8FDB\u5EA6\u9ED8\u8BA4\u4FE1 CLI \u63A8\u5BFC\uFF08`derived`\uFF09\u3002metric \u7684\u8FDB\u5EA6\u6765\u81EA\u6700\u8FD1\u4E00\u6761\u5E26 `value` \u7684 progress\uFF0C\u4E0D\u80FD assess\u3002\n- \u53EA\u5728**\u4E0D\u540C\u610F\u63A8\u5BFC\u503C**\u65F6\u5199 `okr assess <id> --value 0-100 --reason "\u2026"`\u3002\u7406\u7531\u5FC5\u987B\u5F15\u7528\u5177\u4F53\u4EFB\u52A1\u548C KR \u7684\u72B6\u6001\uFF0C\u4F8B\u5982\u300Ckr1 \u5DF2\u5230 86\uFF0Cm1.1 \u63A5\u53E3\u963B\u585E\u4E24\u5468\uFF0C\u6574\u4F53\u7565\u843D\u540E\u300D\u3002\u6CA1\u6709\u7406\u7531\u4F1A\u88AB\u62D2\u7EDD\u3002\n- \u8282\u594F\uFF1A\u5468\u62A5\u65F6\u7EDF\u4E00\u8BC4\u4F30\u4E00\u6B21\u3002\u4E0D\u8981\u6BCF\u6B21 done \u90FD assess\u3002\u540C\u4E00\u8282\u70B9\u540C\u4E00\u5929\u540C\u503C\u3001\u7406\u7531\u76F8\u8FD1\u7684 assess \u4F1A\u88AB\u53BB\u91CD\uFF1B\u5F53\u5929\u6539\u6570\u503C\u53EF\u4EE5\u76F4\u63A5\u5199\u3002\n- assess \u4E4B\u540E\u5B50\u6811\u5185\u51FA\u73B0 done / reject / submit / change \u5C31\u8FC7\u671F\u3002\u89C6\u56FE\u4F1A\u5E76\u6392\u663E\u793A\u65E7 assess \u4E0E\u65B0\u63A8\u5BFC\u503C\uFF0Cagent \u770B\u5230\u8FC7\u671F\u4E0D\u7528\u6025\u7740\u8865\uFF0C\u7B49\u4E0B\u6B21\u5468\u62A5\u3002\n\n## 6. \u62C6\u89E3\u4E0E\u5468\u8BA1\u5212\n\n**\u4EC0\u4E48\u65F6\u5019\u62C6**\uFF1A\u5EFA\u76EE\u6807\u65F6\u3001\u505A\u5468\u8BA1\u5212\u65F6\u3001\u4EFB\u52A1\u5F00\u5DE5\u524D\u3001\u5361\u4F4F\u65F6\u3002\n\n**\u600E\u4E48\u62C6**\uFF1A\u5148\u5728\u5BF9\u8BDD\u91CC\u5C55\u793A\u63D0\u6848\uFF08\u4EFB\u52A1\u540D\u3001\u4F18\u5148\u7EA7\u3001\u622A\u6B62\u3001\u6240\u5C5E\u3001\u4E00\u53E5\u4E3A\u4EC0\u4E48\uFF09\uFF0C\u7528\u6237\u786E\u8BA4\u540E\u518D\u843D\u76D8\u3002\u5F53\u5929\u7684\u6B65\u9AA4\u53EA\u5728\u5BF9\u8BDD\u91CC\u8BF4\uFF0C\u4E0D\u5199\u8FDB okr\u3002\n\n**\u53D6\u6570**\uFF1A`okr week --json` \u770B\u672C\u5468\u5DF2\u6392\uFF08`planned`\uFF0C\u6309 `order`\uFF09\u548C\u9057\u7559\uFF08`carryOver`\uFF1A\u4E0A\u5468\u53CA\u66F4\u65E9\u6392\u4E86\u6CA1\u5B8C\u6210\u7684\uFF09\uFF1B`okr candidates --json` \u5217\u5168\u90E8\u672A\u5B8C\u6210\u4EFB\u52A1\u548C\u6392\u5E8F\u4F9D\u636E\uFF1A`priority`\u3001`deadline` / `daysLeft`\u3001`weight`\u3001\u6240\u5C5E KR \u7684\u843D\u540E\u7A0B\u5EA6\uFF08`upper.gap` = \u8FDB\u5EA6 \u2212 \u65F6\u95F4\uFF0C\u8D1F\u5F97\u8D8A\u591A\u8D8A\u6025\uFF09\u3001\u4F9D\u8D56\uFF08`depsOpen`\u3001`dependents`\uFF09\u3001`carryOver`\u3001`specMissing`\u3001`dispatchable`\u3002CLI \u53EA\u7ED9\u4E8B\u5B9E\uFF0C`--dispatchable` \u53EA\u662F\u8FC7\u6EE4\uFF1B\u6392\u5E8F\u662F agent \u7684\u4E8B\uFF1A\u9057\u7559\u548C\u903E\u671F\u5148\u5904\u7406\uFF0C\u843D\u540E KR \u4E0B\u7684\u4EFB\u52A1\u5176\u6B21\uFF0C\u518D\u6309\u4F18\u5148\u7EA7\u548C\u622A\u6B62\uFF0C\u4E00\u5468\u522B\u8D85\u8FC7\u7528\u6237\u8BF4\u7684\u5BB9\u91CF\uFF08`okr velocity --json` \u662F\u8FD1\u51E0\u5468\u7684\u5B8C\u6210\u6570\uFF09\u3002\n\n**\u843D\u76D8\u65B9\u5F0F**\uFF1A\u5199 `reports/<\u5468>.plan.yaml`\uFF08\u5468\u62A5\u63D0\u6848\uFF09\u6216 `reports/<\u5468>.plan-2.yaml`\u3001`plan-3.yaml`\uFF08\u4E2D\u9014\u62C6\u89E3\uFF0C\u4E0D\u8986\u76D6\u5468\u62A5\u63D0\u6848\uFF09\uFF0C\u7136\u540E `okr apply --from <file> --confirmed`\uFF08`--from` \u7ED9\u6587\u4EF6\u540D\u65F6\u5230 `reports/` \u4E0B\u627E\uFF09\u3002apply \u7684\u89C4\u5219\uFF1A`plan` \u91CC\u7684\u4EFB\u52A1\u5168\u90E8\u8BBE\u6210\u8FD9\u5468\uFF0C`order` \u6309\u5217\u8868\u987A\u5E8F\u63A5\u5728\u300C\u672C\u5468\u5DF2\u6392\u3001\u8FD9\u6B21\u6CA1\u63D0\u5230\u300D\u7684\u4EFB\u52A1\u540E\u9762\uFF0C\u6240\u4EE5\u91CD\u590D apply \u4E0D\u4F1A\u6253\u4E71\u6CA1\u63D0\u5230\u7684\u4EFB\u52A1\uFF1B`drop` \u6E05\u6389 `week` / `order`\uFF1B\u9057\u7559\u4EFB\u52A1\u5FC5\u987B\u51FA\u73B0\u5728 `plan` \u6216 `drop` \u91CC\uFF0C\u5426\u5219\u9000\u51FA\u7801 3\u3001JSON \u91CC `carryOver` \u5217\u51FA\u6F0F\u6389\u7684\uFF1Bspec \u4E0D\u5168\u53EA\u8B66\u544A\u4E0D\u62D2\u7EDD\uFF1B`new` \u91CC\u7701\u7565 id \u5C31\u81EA\u52A8\u751F\u6210\uFF0C`new:N` \u53EF\u4EE5\u51FA\u73B0\u5728 `plan` / `drop` / \u522B\u7684 `new` \u9879\u7684 `parent` / `deps` \u91CC\u3002\u7528\u6237\u5426\u6389\u63D0\u6848\u5C31 `okr apply --dismiss`\uFF08\u5F53\u5468\u6240\u6709\u5F85\u5904\u7406\u7684\uFF09\u6216 `okr apply --dismiss --from <file>`\u3002\n\n```yaml\nweek: 2026-W36\nnew:                        # \u65B0\u5EFA\u4EFB\u52A1\uFF0C\u5B57\u6BB5\u540C\u8282\u70B9\uFF1Bid \u53EF\u7701\u7565\n  - {id: kr1.3, parent: kr1, name: \u7279\u5F81 v3, priority: P1, deadline: 2026-09-05, spec: {...}}\n  - {parent: kr1, name: \u8BC4\u6D4B\u811A\u672C, priority: P2}\nplan: [t41, kr1.3, new:1]   # \u672C\u5468\u5168\u96C6\uFF0C\u6309\u4F18\u5148\u987A\u5E8F\uFF1Bnew:N \u5F15\u7528 new \u5217\u8868\u4E0B\u6807\uFF0C0 \u8D77\u7B97\ndrop: [t39]                 # \u9057\u7559\u4EFB\u52A1\u9000\u51FA\u672C\u5468\uFF0C\u6E05\u7A7A week\n```\n\n\u6BCF\u4E2A\u9057\u7559\u4EFB\u52A1\uFF08`week` \u65E9\u4E8E\u672C\u5468\u3001\u672A\u5B8C\u6210\u3001active\uFF09\u5FC5\u987B\u51FA\u73B0\u5728 `plan` \u6216 `drop` \u91CC\uFF0C\u5426\u5219 apply \u62D2\u7EDD\u5E76\u5217\u51FA\u3002\n\n**\u4EFB\u52A1\u7C92\u5EA6**\uFF1A\u4E00\u4E2A PR \u88C5\u5F97\u4E0B\uFF0C\u7528\u6237\u4E00\u6B21\u80FD\u5BA1\u5B8C\u3002\u6D3E\u7ED9\u6267\u884C agent \u7684\u4EFB\u52A1 `spec` \u56DB\u9879\u8981\u9F50\uFF1A`--goal`\uFF08\u505A\u4EC0\u4E48\u3001\u52A8\u54EA\u4E2A\u4ED3\u5E93\u548C\u6A21\u5757\u3001\u660E\u786E\u4E0D\u52A8\u4EC0\u4E48\uFF09\u3001`--accept`\uFF08\u53EF\u91CD\u590D\uFF0C\u9010\u6761\u9A8C\u6536\u6807\u51C6\uFF09\u3001`--verify`\uFF08\u63D0 PR \u524D\u5FC5\u987B\u901A\u8FC7\u7684\u547D\u4EE4\uFF09\u3001`--link`\uFF08\u6587\u6863\u3001issue\u3001\u4E4B\u524D\u7684 PR\uFF09\u3002\n\n**\u6392\u5E8F\u4F9D\u636E**\uFF08\u7B97\u6CD5\u5728 agent\uFF0CCLI \u53EA\u7ED9\u4E8B\u5B9E\uFF09\uFF1A\u622A\u6B62\u548C\u6743\u91CD\u3001\u843D\u540E\u6700\u591A\u7684 KR\u3001\u4F9D\u8D56\u94FE\uFF08\u88AB\u4F9D\u8D56\u7684\u5148\u505A\uFF09\u3001\u7528\u6237\u8FD1\u671F\u541E\u5410\uFF08`okr velocity --json`\uFF09\u3002\u4ECA\u65E5\u6E05\u5355\u4ECE\u672C\u5468\u4EFB\u52A1\u91CC\u6311\uFF0C\u6309\u987A\u5E8F\u5217\u5B8C\uFF0C\u6BCF\u6761\u4E00\u53E5\u4E3A\u4EC0\u4E48\u3002\n\n## 7. \u7ED3\u6784\u53D8\u66F4\n\n`add` / `move` / `rm` / `apply` \u90FD\u8981 `--confirmed`\u3002`--confirmed` \u662F\u300C\u7528\u6237\u70B9\u8FC7\u5934\u300D\u7684\u8BB0\u5F55\uFF0C\u4E0D\u662F\u9632\u7EBF\uFF1Aagent \u5148\u628A\u8981\u505A\u7684\u4E8B\u8BF4\u6E05\u695A\uFF0C\u7528\u6237\u540C\u610F\u540E\u624D\u4F20\u3002`edit` \u6539\u5B57\u6BB5\u4E0D\u9700\u8981\uFF1B\u628A `status` \u6539\u6210 canceled CLI \u4E0D\u5F3A\u5236\uFF0C\u4F46\u534F\u8BAE\u4E0A\u8981\u7528\u6237\u70B9\u5934\uFF0C\u70B9\u5934\u540E\u540C\u6837\u5E26 `--confirmed` \u8BB0\u5165\u5BA1\u8BA1\u3002\n\n- `okr add --name \u2026 --kind objective|metric|milestone|task|habit --parent <id> \u2026`\u3002\u6709 `--parent` \u4E5F\u8981\u663E\u5F0F `--kind`\uFF0C\u53EA\u6709 `--metric \u5355\u4F4D:from:to` \u6216 `--cadence 3/week` \u80FD\u63A8\u51FA kind\u3002\n- objective / metric / milestone \u5B57\u6BB5\uFF1A`--area` `--start` `--end` `--weight` `--status active|frozen|canceled`\uFF1Bmetric \u8FD8\u6709 `--metric \u5355\u4F4D:from:to`\uFF08\u6216 `--unit` `--from` `--to`\uFF09\uFF0Chabit \u6709 `--cadence`\u3002\n- \u4EFB\u52A1\u5B57\u6BB5\uFF1A`--priority P0-P3` `--deadline` `--week 2026-W36` `--order` `--dep <id>`\uFF08\u53EF\u91CD\u590D\uFF09`--goal` `--accept` `--verify` `--link`\u3002\n- `--week none` \u8FD9\u7C7B `none` \u6E05\u7A7A\u5B57\u6BB5\u3002\n- `rm` \u53EA\u80FD\u5220\u6CA1\u6709\u4E8B\u4EF6\u3001\u6CA1\u6709\u5B50\u8282\u70B9\u3001\u6CA1\u4EBA\u4F9D\u8D56\u7684\u8282\u70B9\uFF0C\u5176\u4F59\u7528 `edit --status canceled --confirmed`\u3002\n- id \u7531 CLI \u751F\u6210\uFF08`kr1.3`\u3001`t7`\uFF09\uFF0C\u4E0D\u590D\u7528\uFF0C`--json` \u91CC\u56DE\u663E\uFF1B\u540E\u7EED\u6307\u4EE3\u7528 id\u3002\n- deps \u6210\u73AF\u4F1A\u88AB\u62D2\u7EDD\u3002\n\n## 8. \u4ED3\u5E93\u5173\u8054\n\n- \u7528\u6237\u8BF4\u300C\u8FD9\u4E2A\u4ED3\u5E93\u5BF9\u5E94 kr1\u300D\uFF1A`okr repo add <path> --node kr1`\u3002`okr repo list --json` \u770B\u767B\u8BB0\u3002\n- \u4ED3\u5E93\u6839\u76EE\u5F55\u53EF\u4EE5\u653E `.okr.yaml`\uFF0C\u58F0\u660E\u9ED8\u8BA4\u8282\u70B9\uFF0C\u8BA9\u5728\u4ED3\u5E93\u91CC\u5E72\u6D3B\u7684 agent \u77E5\u9053\u5F80\u54EA\u8BB0\uFF1A\n\n```yaml\nnode: kr1          # \u8FD9\u4E2A\u4ED3\u5E93\u7684\u5DE5\u4F5C\u9ED8\u8BA4\u8BB0\u5230\u54EA\u4E2A\u8282\u70B9\n```\n\n  CLI \u4E0D\u8BFB\u8FD9\u4E2A\u6587\u4EF6\uFF0Cagent \u8BFB\u3002\u5728\u4ED3\u5E93\u91CC\u6536\u5230\u300C\u8BB0\u4E00\u4E0B\u8FDB\u5EA6\u300D\u4F46\u6CA1\u70B9\u540D\u8282\u70B9\u65F6\uFF0C\u5148\u770B\u5B83\u3002\n- \u4ECE git \u63D0\u53D6\u8FDB\u5EA6\uFF1ACLI\uFF08`okr commits --json`\uFF0C\u6309\u767B\u8BB0\u7684\u4ED3\u5E93\u5217 `git log`\uFF0C\u7F3A\u7701\u81EA\u4E0A\u6B21\u5468\u62A5\u8D77\uFF0C`--since <\u65E5\u671F>` / `--node <id>` / `--limit N` \u6536\u7A84\uFF09\u53EA\u5217\u63D0\u4EA4\uFF0C\u5F52\u7EB3\u662F agent \u7684\u4E8B\uFF0C\u5F52\u7EB3\u7ED3\u679C\u5199\u6210\u4E00\u6761 `log`\uFF0C\u4E0D\u662F\u4E00\u6761\u63D0\u4EA4\u4E00\u6761\u4E8B\u4EF6\u3002\u65F6\u673A\uFF1A\u7528\u6237\u5B8C\u6210\u4E00\u4E2A\u5927\u7248\u672C\u8BA9 agent \u66F4\u65B0\uFF0C\u6216\u7528\u6237\u8BA9 agent \u6C47\u603B\u67D0\u4E2A\u4ED3\u5E93\u3002\n\n## 9. \u6D3E\u5DE5\u4E0E\u6267\u884C agent\n\n\u6D3E\u5DE5\u6682\u65F6\u624B\u52A8\uFF1A\u7528\u6237\u70B9\u540D\u4EFB\u52A1\uFF0C\u81EA\u5DF1\u5F00\u7A97\u683C\u548C worktree\uFF0C\u628A `okr show <id> --spec` \u7684\u8F93\u51FA\u6574\u6BB5\u5582\u7ED9\u6267\u884C agent\u3002\u6D3E\u5DE5\u5305\u5305\u542B spec \u56DB\u9879\u3001\u6240\u5C5E\u3001\u9636\u6BB5\u3001\u4F9D\u8D56\u53CA\u5404\u81EA\u5B8C\u6210\u72B6\u6001\uFF08`[x]` \u5DF2\u5B8C\u6210\u3001`[ ]` \u672A\u5B8C\u6210\uFF1BJSON \u91CC\u662F `deps[].done`\uFF09\u3001\u5386\u53F2 submit \u94FE\u63A5\u3001\u6BCF\u6B21 reject \u7684\u610F\u89C1\uFF0C\u4EE5\u53CA\u53EF\u7167\u6284\u7684\u56DE\u5199\u547D\u4EE4\u3002\n\n`show --spec` \u7ED9\u7684\u4EFB\u52A1\u5982\u679C `dispatchable` \u4E3A false\uFF08spec \u4E0D\u5168\u6216\u4F9D\u8D56\u672A\u5B8C\u6210\uFF09\uFF0C\u5148\u8865 spec \u6216\u7B49\u4F9D\u8D56\uFF0C\u4E0D\u6D3E\u3002\n\n**\u6267\u884C agent \u5951\u7EA6**\uFF08\u62FF\u5230\u6D3E\u5DE5\u5305\u7684 agent \u53EA\u505A\u8FD9\u56DB\u4EF6\u4E8B\uFF0C\u5176\u4ED6\u4E00\u5F8B\u4E0D\u78B0\uFF09\uFF1A\n\n1. \u5F00\u5DE5\u5148 `okr claim <id> --by <agent> --session <session>`\u3002`--session` \u81EA\u5B9A\uFF08worktree \u540D\u5373\u53EF\uFF09\u3002\u5DF2\u88AB\u522B\u4EBA\u9886\u53D6\u4E14\u672A submit \u4F1A\u88AB\u62D2\u7EDD\uFF0C\u56DE\u62A5\u7528\u6237\uFF0C\u4E0D `--force`\u3002\n2. \u5361\u4F4F `okr block <id> "\u5361\u5728\u54EA" --by \u2026 --session \u2026`\u3002\n3. \u89E3\u9664\u963B\u585E\u6216\u5173\u952E\u8FDB\u5C55 `okr log <id> "\u2026" --by \u2026 --session \u2026`\u3002\u65E5\u5E38\u5C0F\u6B65\u9AA4\u4E0D\u8BB0\u3002\n4. \u6D3E\u5DE5\u5305\u91CC\u7684\u9A8C\u8BC1\u547D\u4EE4\u901A\u8FC7\u3001PR \u63D0\u4E86\uFF0C`okr submit <id> --link <PR> --by \u2026 --session \u2026`\u3002\u6CA1\u6709 link \u4F1A\u88AB\u62D2\u7EDD\u3002\n\n\u6267\u884C agent \u4E0D\u5199 `done`\u3001`assess`\u3001`add`\u3001`edit`\uFF0C\u4E0D\u586B `--value` `--hours`\u3002\u9A8C\u6536\u7531\u7528\u6237\u505A\uFF1A\u901A\u8FC7 `okr done`\uFF0C\u4E0D\u901A\u8FC7 `okr reject "\u610F\u89C1"`\uFF0C\u540C\u4E00\u4EFB\u52A1\u7EE7\u7EED\uFF0C\u91CD\u6D3E\u65F6\u6D3E\u5DE5\u5305\u4F1A\u5E26\u4E0A\u6253\u56DE\u610F\u89C1\u3002\n\n## 10. \u5B88\u536B\u88AB\u62D2\u65F6\u600E\u4E48\u529E\n\n| \u9000\u51FA\u7801 / \u62A5\u9519 | \u505A\u6CD5 |\n|---|---|\n| 2 \u6B67\u4E49\uFF0C\u5E26 `candidates` | \u975E\u7A7A\u5C31\u5217\u7ED9\u7528\u6237\u9009\uFF1B\u4E3A\u7A7A\u8BF4\u660E\u6CA1\u6709\u8FD9\u4E2A\u8282\u70B9\uFF0C\u95EE\u7528\u6237\u662F\u4E0D\u662F\u8981\u65B0\u5EFA |\n| 3 \u300C\u5185\u5BB9\u76F8\u8FD1\u300D | \u9ED8\u8BA4\u5F53\u91CD\u590D\uFF0C\u544A\u8BC9\u7528\u6237\u5DF2\u8BB0\u8FC7\uFF1B\u7528\u6237\u575A\u6301\u518D `--force` |\n| 3 \u5DF2\u51BB\u7ED3 / \u5DF2\u53D6\u6D88 | \u544A\u8BC9\u7528\u6237\uFF0C\u95EE\u89E3\u51BB\u8FD8\u662F\u7167\u8BB0 |\n| 3 \u9700\u8981 `--confirmed` | \u628A\u8981\u505A\u7684\u4E8B\u8BF4\u7ED9\u7528\u6237\uFF0C\u70B9\u5934\u540E\u52A0\u4E0A\u91CD\u8DD1 |\n| 3 \u5DF2\u88AB\u9886\u53D6 | \u56DE\u62A5\u662F\u8C01\uFF08`by` / `session`\uFF09\u9886\u7684 |\n| 3 submit \u7F3A link / assess \u7F3A reason / assess \u503C\u8D85\u51FA 0\u2013100 | \u8865\u9F50\u518D\u5199\uFF0C\u4E0D\u8981\u7ED5 |\n| 1 `--value` / `--hours` \u4E0D\u662F\u6570\u5B57\u3001\u53C2\u6570\u683C\u5F0F\u9519 | \u6539\u5BF9\u53C2\u6570\u91CD\u8DD1 |\n| 4 \u9501\u8D85\u65F6 | \u7B49\u4E00\u79D2\u91CD\u8BD5\u4E00\u6B21 |\n| `committed: false` | \u6587\u4EF6\u5DF2\u5199\u5165\uFF0C\u53EA\u662F git \u63D0\u4EA4\u5931\u8D25\uFF0C\u63D0\u9192\u7528\u6237\u8DD1 `okr validate` |\n\n## 11. \u62A5\u544A\uFF08\xA78 \u6B65 4 \u4E4B\u540E\u7531\u5B9A\u65F6\u4EFB\u52A1\u89E6\u53D1\uFF09\n\n\u65E5\u62A5\u7531\u811A\u672C\u5224\u65AD\u6709\u6CA1\u6709\u66F4\u65B0\uFF0C\u6709\u66F4\u65B0\u624D\u53EB agent \u5199\uFF1A\u5F85\u786E\u8BA4\u63D0\u6848\u63D0\u793A\u3001\u4ECA\u65E5\u987A\u5E8F\u53CA\u7406\u7531\u3001\u5230\u671F\u4E0E\u963B\u585E\u3001\u5F85\u9A8C\u6536\u4E0E\u5DF2\u9886\u53D6\u3001\u5EFA\u8BAE\u62C6\u89E3\u3001\u6628\u65E5\u8FDB\u5EA6\u3002\u5468\u62A5 agent \u5199\u5168\u6587\uFF1A\u4E0A\u5468\u56DE\u987E\u3001\u5404\u76EE\u6807\u8BC4\u4F30\u4E0E\u5468\u53D8\u5316\u3001\u541E\u5410\u3001\u672C\u5468\u63D0\u6848\uFF08\u540C\u65F6\u5199 `plan.yaml` \u7B49\u7528\u6237\u786E\u8BA4\uFF09\u3001\u98CE\u9669\u3002\u56FE\u7528\u6587\u672C\u5757\u3002\n\n## 12. \u4E0D\u505A\u7684\u4E8B\n\n- \u4E0D\u76F4\u63A5\u7F16\u8F91 `nodes.yaml` / `events.jsonl`\uFF0C\u4E0D\u5728 `~/.okr` \u91CC git commit / checkout / reset\u3002\n- \u4E0D\u63A8\u7B97 metric \u6570\u503C\u548C\u7528\u65F6\u3002\n- \u4E0D\u66FF\u7528\u6237\u786E\u8BA4\uFF1A\u7ED3\u6784\u53D8\u66F4\u3001KR / \u76EE\u6807 / \u91CC\u7A0B\u7891\u5B8C\u6210\u3001\u5468\u8BA1\u5212\u843D\u5730\u3001`--force`\u3002\n- \u4E0D\u6BCF\u6B21 done \u90FD assess\uFF0C\u4E0D\u628A\u5F53\u5929\u7684\u6B65\u9AA4\u5199\u8FDB okr\u3002\n- \u4E0D\u628A\u63D0\u4EA4\u4E00\u6761\u6761\u8BB0\u6210\u4E8B\u4EF6\u3002\n- \u6267\u884C agent \u53EA\u5199 claim / block / log / submit\u3002\n';
  else {
    path = resolve2(HERE2, "..", "docs", "okr", "PROTOCOL.md");
    if (!existsSync6(path)) fail(`\u627E\u4E0D\u5230 ${path}`);
    text = readFileSync5(path, "utf8");
  }
  if (json) console.log(JSON.stringify({ ok: true, path, protocol: text }));
  else process.stdout.write(text);
}
var SKILL_USAGE = "\u7528\u6CD5: okr skill install [--force] | remove | status | link [--dir ~/.local/bin]";
var SKILL_ACTION = {
  copied: "\u5DF2\u590D\u5236",
  "kept-symlink": "\u5DF2\u662F\u8F6F\u94FE\uFF08\u5F00\u53D1\u6A21\u5F0F\uFF09\uFF0C\u4FDD\u7559",
  linked: "\u5DF2\u5EFA\u8F6F\u94FE",
  kept: "\u8F6F\u94FE\u5DF2\u5728",
  "skipped-dir": "\u662F\u771F\u5B9E\u76EE\u5F55\uFF0C\u4E0D\u52A8",
  "in-place": "\u5C31\u662F\u8FD9\u4EFD\uFF0C\u4E0D\u52A8"
};
function cmdSkill() {
  const sub = args._[1] ?? "status";
  if (sub === "install") {
    const r = installSkill({ force });
    ok({ ...r }, () => {
      console.log(`${color(GREEN, "\u2713")} skill \u88C5\u597D\u4E86\u3002`);
      console.log(`  ${r.agents.path}  ${SKILL_ACTION[r.agents.action]}\uFF08Codex / Copilot / OpenCode \u76F4\u63A5\u8BFB\uFF09`);
      console.log(`  ${r.claude.path}  ${SKILL_ACTION[r.claude.action]}\uFF08Claude Code\uFF09`);
    });
  } else if (sub === "remove") {
    const r = removeSkill();
    ok({ ...r }, () => {
      for (const x of r.removed) console.log(`${color(GREEN, "\u2713")} \u5DF2\u5220 ${x}`);
      for (const x of r.kept) console.log(`${dim("\xB7")} \u4FDD\u7559 ${x}\uFF08\u4E0D\u662F okr skill install \u88C5\u7684\uFF09`);
      if (!r.removed.length && !r.kept.length) console.log("\u6CA1\u6709\u88C5\u8FC7\u3002");
    });
  } else if (sub === "status") {
    const p = skillPaths();
    const st = (x) => existsSync6(x) ? "\u5728" : "\u4E0D\u5728";
    ok({ agents: p.agents, claude: p.claude, installed: existsSync6(p.agents), running: process.argv[1] }, () => {
      console.log(`${p.agents}  ${st(p.agents)}`);
      console.log(`${p.claude}  ${st(p.claude)}`);
      console.log(dim(`\u5F53\u524D\u8FD0\u884C\u7684\u662F ${process.argv[1]}`));
    });
  } else if (sub === "link") {
    const r = linkCli({ dir: str("dir") });
    ok({ ...r }, () => {
      console.log(`${color(GREEN, "\u2713")} ${r.link} -> ${r.target}`);
      if (!r.onPath) console.log(`${dim("\xB7")} ${r.dir} \u4E0D\u5728 PATH \u91CC\uFF0C\u52A0\u4E00\u53E5\u5230 shell \u914D\u7F6E\uFF1Aexport PATH="${r.dir}:$PATH"`);
    });
  } else fail(SKILL_USAGE);
}
function cmdHelp() {
  console.log(
    [
      `${bold("okr")} \u2014 \u76EE\u6807\u4E0E\u4EFB\u52A1\u8FFD\u8E2A\u3002\u4E8B\u4EF6\u8FDB\uFF0C\u89C6\u56FE\u51FA\u3002`,
      "",
      `${bold("\u7ED3\u6784")}   init \xB7 add \xB7 edit \xB7 move \xB7 rm \xB7 tree [--all] \xB7 show <id> [--spec] \xB7 validate [--merge-events] \xB7 migrate \xB7 repo add|rm|list`,
      `${bold("\u8BB0\u5F55")}   log \xB7 done \xB7 block \xB7 claim \xB7 submit --link \xB7 reject \xB7 assess --value --reason \xB7 check \xB7 recent [--node] [--days]`,
      `${bold("\u6570\u636E")}   brief \xB7 week [--week W] \xB7 candidates [--dispatchable] \xB7 changes [--since last-daily|last-weekly|<ts>] \xB7 commits [--since] [--limit] \xB7 velocity [--weeks] \xB7 report data [--week W]`,
      `${bold("\u8BA1\u5212")}   apply --from <plan.yaml> --confirmed\uFF08\u89C1 protocol \xA76\uFF09\xB7 apply --dismiss [--from <plan.yaml>]`,
      `${bold("\u89C6\u56FE")}   tui \xB7 status \xB7 tree \xB7 show`,
      `${bold("\u534F\u8BAE")}   protocol\uFF08\u6253\u5370 PROTOCOL.md\uFF0Cagent \u5148\u8BFB\u5B83\u518D\u5199\uFF09`,
      `${bold("skill")}  skill install [--force] \xB7 remove \xB7 status \xB7 link\uFF08\u88C5\u8FDB ~/.agents/skills \u4E0E ~/.claude/skills\uFF1B\u8FD0\u884C\u65F6\u81EA\u52A8\u8865\u88C5/\u66F4\u65B0\u81EA\u5DF1\u88C5\u7684\u90A3\u4EFD\uFF0COKR_SKIP_SKILL=1 \u5173\u6389\uFF1Blink \u628A okr \u8F6F\u94FE\u5230 ~/.local/bin\uFF09`,
      "",
      `${bold("\u901A\u7528")}   --json  --today YYYY-MM-DD  --at <\u65F6\u95F4>  --demo  --by <agent>  --session <id>  --confirmed  --force`,
      `${bold("\u9000\u51FA\u7801")} 0 \u6210\u529F \xB7 1 \u9519\u8BEF \xB7 2 \u6307\u4EE3\u6B67\u4E49 \xB7 3 \u5B88\u536B\u62D2\u7EDD/validate \u5931\u8D25 \xB7 4 \u9501\u8D85\u65F6`,
      "",
      dim(`\u6570\u636E\u76EE\u5F55 ${DIR}\uFF08OKR_DIR \u53EF\u6539\uFF09\u3002\u534F\u8BAE okr protocol\uFF1B\u8BBE\u8BA1 github.com/RoacherM/Wayne-Skills/blob/main/docs/okr/DESIGN.md\u3002`)
    ].join("\n")
  );
}
var STAGE_USAGE = (c, extra = "") => `\u7528\u6CD5: okr ${c} <id> "\u5907\u6CE8"${extra}`;
function checkArgs() {
  for (const k of Object.keys(args.flags)) if (!KNOWN_FLAGS.has(k)) fail(`\u672A\u77E5\u53C2\u6570: --${k}`);
  if (todayFlag !== void 0 && !isValidDate(todayFlag)) fail(`--today \u9700\u8981 YYYY-MM-DD\uFF0C\u5F97\u5230 "${todayFlag}"`);
}
function autoSkill() {
  const r = ensureSkill();
  if (!r) return;
  const verb = r.action === "installed" ? "\u5DF2\u88C5\u5230" : "\u5DF2\u66F4\u65B0";
  console.error(dim(`okr skill ${verb} ${r.result.agents.path}\uFF08OKR_SKIP_SKILL=1 \u53EF\u5173\uFF1Bokr skill status \u67E5\u770B\uFF09`));
}
function dispatch() {
  if (flag("help")) return cmdHelp();
  if (flag("version")) {
    console.log(PKG_VERSION);
    return;
  }
  checkArgs();
  if (cmd !== "skill" && cmd !== "demo") autoSkill();
  switch (cmd) {
    case "init":
      cmdInit();
      break;
    case "add":
      cmdAdd();
      break;
    case "edit":
      cmdEdit();
      break;
    case "move":
      cmdMove();
      break;
    case "rm":
      cmdRm();
      break;
    case "repo":
      cmdRepo();
      break;
    case "validate":
      cmdValidate();
      break;
    case "migrate":
      cmdMigrate();
      break;
    case "log":
      appendStageEvent("progress", STAGE_USAGE("log", " [--value N] [--hours N] [--link URL]"), { noteRequired: true });
      break;
    case "done":
      appendStageEvent("done", STAGE_USAGE("done", " [--confirmed] [--hours N]"), { defaultNote: "\u5B8C\u6210" });
      break;
    case "block":
      appendStageEvent("blocked", STAGE_USAGE("block"), { noteRequired: true });
      break;
    case "claim":
      appendStageEvent("claim", STAGE_USAGE("claim", " --by <agent> --session <id>"), { defaultNote: "\u9886\u53D6" });
      break;
    case "submit":
      appendStageEvent("submit", STAGE_USAGE("submit", " --link <PR>"), { defaultNote: "\u5DF2\u63D0 PR" });
      break;
    case "reject":
      appendStageEvent("reject", STAGE_USAGE("reject", " [--body \u8BE6\u7EC6\u610F\u89C1] [--confirmed]"), { noteRequired: true });
      break;
    case "check":
      appendStageEvent("check", STAGE_USAGE("check"), { defaultNote: "\u6253\u5361" });
      break;
    case "assess":
      cmdAssess();
      break;
    case "recent":
      cmdRecent();
      break;
    case "velocity":
      cmdVelocity();
      break;
    case "brief":
      cmdBrief();
      break;
    case "week":
      cmdWeek();
      break;
    case "candidates":
      cmdCandidates();
      break;
    case "changes":
      cmdChanges();
      break;
    case "commits":
      cmdCommits();
      break;
    case "apply":
      cmdApply();
      break;
    case "report":
      cmdReport();
      break;
    case "status":
      cmdStatus();
      break;
    case "tree":
      cmdTree();
      break;
    case "show":
      cmdShow();
      break;
    case "protocol":
      cmdProtocol();
      break;
    case "skill":
      cmdSkill();
      break;
    case "tui":
    case "":
      cmdTui();
      break;
    case "demo":
      if (!process.stdout.isTTY || !process.stdin.isTTY) fail("tui \u9700\u8981\u7EC8\u7AEF\u3002\u975E\u4EA4\u4E92\u73AF\u5883\u7528 okr status / okr tree\u3002");
      void runTui({ load: () => ({ nodes: DEMO_NODES, events: DEMO_EVENTS }), today: DEMO_TODAY, readOnly: true });
      break;
    case "help":
    case "-h":
      cmdHelp();
      break;
    case "version":
    case "-v":
      console.log(PKG_VERSION);
      break;
    default:
      fail(`\u672A\u77E5\u547D\u4EE4 ${cmd}\u3002okr help \u770B\u7528\u6CD5\u3002`);
  }
}
try {
  dispatch();
} catch (err) {
  if (err instanceof CliExit) process.exit(err.code);
  const msg = err instanceof Error ? err.message : String(err);
  if (json) console.log(JSON.stringify({ ok: false, error: msg, code: 1 }));
  else console.error(color(RED, "\u2717 ") + msg);
  if (process.env.OKR_DEBUG && err instanceof Error) console.error(err.stack);
  process.exit(1);
}
