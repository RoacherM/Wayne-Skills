# 活文档（`DESIGN.md` / `docs/subsystems/`）与接口文档（Nimbus + OpenAPI）规范

## 1. 活文档的两种规模形态

- **小型/单体仓库（如 `herdr-relay`、`native-editor`）**：根目录单文件 `DESIGN.md`。
- **中大型/多模块仓库（如 `story-forge-agent`、`agent-forge`、`epi`）**：按子系统拆分为 `docs/subsystems/<module>.md`，每个子系统只维护一篇当前活文档，避免多份文档说法打架。线上排查（audit）或阶段性 spike 结束后，已证实的机制并入对应子系统文档，待办拆进 `docs/issues/`，不在 `docs/` 下留下 `xxx-fixes.md`、`xxx-spike.md`、`xxx-v2-plan.md` 等并列碎片，以免检索时读到过期结论。

## 2. Nimbus 兼容的活文档骨架

`DESIGN.md` 与 `docs/subsystems/<module>.md` 顶部都放 YAML Frontmatter（`title` 与 1–2 句话的 `description`），既供仓库内 Agent 快速路由，也供 [Cloudflare Nimbus](https://github.com/cloudflare/nimbus) 直接生成 `llms.txt` 与页面：

```markdown
---
title: <子系统或项目名称>
description: <1-2 句话概括本模块负责的边界、核心机制与对外契约，供 Agent 路由与 llms.txt 索引使用。>
---

# <标题>

## 术语与边界
<模块拥有什么、不拥有什么；持久化标识（不可随意改名的 URL / storage key / 协议号）。>

## 结构与数据流
<模块划分与调用链。终端展示用 mmd2txt 框线图，文档站可用代码块。>

## 协议与契约（含新旧混用）
<线协议、事件格式、状态机转移。写明旧客户端 + 新服务端、新客户端 + 旧服务端时的兼容行为，避免滚动升级时中断。>

## 关键决定与踩坑记录（Verified Facts & Traps）
<把实测踩过的坑直接写在对应决定旁边，标明外部依赖版本号与日期，如 `nsh 0.3.0`、`Pi 1.3.0`。>

## 试过不做的方案（Tried & Rejected）
<记录做出来又被否掉、或 probe 证明不可行的方案与原因，防止后续 Agent 重复造轮子。>

## 验证与基准（Verification & Benchmarks）
<对应的单测、冒烟脚本与基准延迟/内存指标。未在目标环境实测的明确标注「未验证」。>
```

---

## 3. 接口设计（API Design）与 Cloudflare Nimbus 文档站规范

凡是有 HTTP / WebSocket / RPC 对外接口的仓库：

### 3.1 `docs/api/openapi.yaml` 是 HTTP 接口的唯一事实源
1. **列出 PROD 与 DEV 完整地址**，省去对接方和调试脚本猜环境域名：
   ```yaml
   openapi: 3.1.0
   info:
     title: Service API
     version: 1.0.0
   servers:
     - url: https://prod.example.com
       description: PROD 生产环境
     - url: https://dev.example.com
       description: DEV 测试环境
   ```
2. **示例命令写出完整 URL**：补充在 Markdown 里的 `curl` 示例写出完整 `https://...`（PROD 与 DEV 对照），不只写 `$BASE_URL/api/...` 相对路径，方便直接复制运行。
3. **配零费用契约测试**：在 `test/` 或 `tools/*-api-cases/` 中用真实 `server` + 本地 `fake-model` 跑通 `openapi.yaml` 里的全部端点，防止文档与代码漂移。

### 3.2 使用 `cloudflare/nimbus` 构建人机双发文档站（按需启用）
当项目需要对内外部团队发布文档站与 API Reference 时，使用 Astro + `@cloudflare/nimbus-docs`：

```sh
# 在仓库 site/ 目录初始化 Nimbus 文档站并挂载 OpenAPI 规范
npx @cloudflare/create-nimbus-docs@latest site --api ../docs/api/openapi.yaml --yes --package-manager npm
```

- **人机同源产出**：
  - **给人看**：HTML 站点 + 可交互 OpenAPI Playground；
  - **给 Agent 看**：自动产出每页的 `.md` 镜像、全站 `/llms.txt`（提取自 Frontmatter 的 `title` + `description`）与 `/llms-full.txt`。
- **机器自检门禁**：
  ```sh
  npx nimbus-docs check --json   # 检查 frontmatter、断链、类型、组件，输出 JSON 供 Agent 自修
  npx nimbus-docs lint           # 检查写作与结构规范
  ```
