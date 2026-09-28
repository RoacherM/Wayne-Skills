---
name: terminal-diagrams
description: "在终端里给用户看图。回复里要放流程图、架构图、时序图、状态图、类图或 ER 图时先加载本 skill：终端显示不了 Mermaid 代码块，要用 mmd2txt 渲染成框线字符图再贴出来。用户说「画个图」、要 diagram / flowchart / sequence / architecture 图时也用。只要文字说明、伪代码、目录树时不用。"
---

# terminal-diagrams

用户在终端里读回复，```mermaid 代码块对他只是一堆源码。`mmd2txt`（https://github.com/RoacherM/mmd2txt，内置 lovely-mermaid 渲染引擎，就是 pi / Grok Build 终端里画图的那套算法）把 Mermaid 源码变成框线字符图。它是 PATH 上的一个命令，不在本 skill 里；没有就先装：`npm install -g github:RoacherM/mmd2txt`（Node ≥ 20）。

## 固定规则

- 回复里不出现 ```mermaid 代码块：图先渲染，贴 ```text 块。
- 先把 Mermaid 写到临时目录的 `.mmd` 文件，再渲染；不要把源码塞进命令行参数：

```bash
mmd2txt flow.mmd                 # 退出码 0 直接贴；2 = 超过 100 列，拆成两张或缩短标签；1 = 图种不支持，改画文本树
mmd2txt --md reply.md            # 整篇 Markdown 里的 mermaid 块就地换成文本图
mmd2txt --ansi flow.mmd          # 给用户在 shell 里看的带色版本
```

- 支持 flowchart/graph、sequenceDiagram、stateDiagram、classDiagram、erDiagram、pie、mindmap、timeline、gitGraph。甘特图等不支持，用文本树或表格代替。
- 超宽时工具会自动试另一个方向（LR ↔ TD），仍超宽才报 2。一张图超过 100 列就拆：主路径一张、循环/异常一张。
- 标签用短语，不写整句；中文标签占两列，更要短。
- 布局引擎偶尔会让一条线从无关的框上穿过，贴图时用一句话说明这条线的实际去向。
- 文本树、伪代码、目录树本来就是文本，不经过本工具。

## 兜底

`scripts/mmd-guard.js` 是 Claude Code / Codex 的 Stop hook：回复结束时若仍含 mermaid 块，就渲染好交回 agent 重发。看到它的提示，就用它给的文本图重发。

## 安装到本机（一次）

```bash
node <本 skill 目录>/scripts/setup.js        # 检查 mmd2txt 在 PATH 上，注册两个 agent 的 Stop hook，打印要加进 CLAUDE.md / AGENTS.md 的规则行
node <本 skill 目录>/scripts/setup.js --remove
```
