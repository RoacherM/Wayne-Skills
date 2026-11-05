# `AGENTS.md` 标准模板（控制在 60–80 行内）

新建或整理仓库时，在根目录创建 `AGENTS.md`，并让 `CLAUDE.md` 内容为 `@AGENTS.md`。

```markdown
# <repo-name> contributor entrypoint

<一句话说明本仓库是什么、拥有什么边界、不拥有什么边界。>

## 1. 目录与边界测试（The Boundary Test）

| 目录 | 职责 | 放进这里的判断标准 |
|---|---|---|
| `<dir-a>/` | ... | 改这行是在改 <A> 还是 <B>？ |
| `<dir-b>/` | ... | ... |
| `test/` | 免预启动单测与契约测试 | 不起外部服务、只用临时实例与临时 HOME 能跑通吗？ |
| `dev/` | 冒烟测试、跑分脚本、假端 | 需要先起本地中继 / 浏览器 / 守护进程吗？ |
| `probe/` | 外部系统/底座一次性探针 | 是在验证外部二进制或接口的未知行为吗？ |

## 2. 按任务读取文档（不要全量扫 `docs/`）

- 架构与协议总览：`DESIGN.md`（或按模块读 `docs/subsystems/<module>.md`）
- 跨模块已定决策：`docs/decisions.md`
- 对外接口契约：`docs/api/openapi.yaml`
- 待修问题与待办队列：`docs/issues/INDEX.md`
- 历史归档：`docs/archive/`（**日常开发严禁读取**）

## 3. 常用命令

```sh
npm test                  # 免准备单测（秒级，零外部副作用）
npm run test:smoke        # 端到端冒烟（见脚本首行前置条件）
```

## 4. 必须遵守的 6 条规则

1. **环境与数据隔离**：绝不停止、重启或发信号给用户正在运行的服务；绝不直接手改安装态副本（如 `~/.config/...`），只改源码并通过安装命令同步。测试只用临时实例和临时 `HOME`，汇报时列出所有副作用。
2. **协议与兼容先行**：改线协议、API 或持久化标识（URL、协议 tag、`localStorage` 键、配置 digest 构成）前，先改 `DESIGN.md` / `docs/subsystems/`，写清「新旧两端混用」时的行为并配测试。
3. **修 Bug 先红后绿**：修任何 bug 必须带一个在旧代码上失败（Red）、新代码上通过（Green）的测试；改完代码汇报 `ub-mode` 数字（超标说明原因）。
4. **实测与版本绑定**：已验证事实与推测分开写；写文档引用代码前当场重读源文件核实；外部依赖的 probe 结论必须标明版本号与日期。
5. **完成定义（DoD）**：`npm test` 通过 + 写明部署/重装步骤 + 活文档同步更新 + `docs/issues/INDEX.md` 状态更新；工作区有其它改动时一律用 `git commit --only -- <paths>` 提交。
6. **按需独立审查**：当改动触及协议、凭证、权限白名单/沙箱边界、持久化，或推送自动部署分支前，交由不同于作者的模型独立审查 `git diff`。

## 5. Issue 自动处理闭环

当被要求「修 Issue」或推进 `docs/issues/INDEX.md` 时：
1. 只认领 `status: ready` 的条目；`needs-decision` / `external-blocked` / `ops-approval` 只汇报不擅改。
2. 按条目里的 `verify` 跑出 Red → 改代码跑出 Green → 跑全量 `npm test`。
3. 用 `git commit --only -- <paths>` 提交，把机制更新进对应活文档，将条目状态改为 `verifying-dev` 或 `done`（填上 commit SHA 与测试名），已 `done` 的单张 `docs/issues/I-*.md` 立即删除。
```
