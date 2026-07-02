---
title: "IDA Pro MCP — LLM-Assisted Vulnerability Discovery"
permalink: /wiki/tools/ida-pro-mcp/
layout: single
author_profile: true
tags:
- windows-exploit-research
- tool
- ai-agents
- reverse-engineering
---

> **Last updated:** 2026-07-02  
> **Related:** [Reversing (tools)](/wiki/tools/reversing/), [AI Agents for Offensive Operations](/wiki/concepts/ai-agents-offensive/), [Windows RPC](/wiki/concepts/windows-rpc/)  
> **Tags:** `tool`, `ai-agents`, `reverse-engineering`

## Summary

`ida-pro-mcp` exposes IDA Pro's analysis database to an LLM over the Model Context Protocol, so an agent (Claude, or an [OpenCode](https://opencode.ai)-driven model) can navigate a binary — list functions, read decompilation, follow xrefs — and reason about it without a human copy-pasting pseudocode. Paired with a good system prompt it becomes a semi-autonomous first pass over an unfamiliar binary's callback/parser functions, flagging candidate memory-safety bugs and their trigger chains.

---

## Setup

**IDA MCP server** (requires Python 3.10+ and IDA's `idalib` bindings):
```
pip install <ida-pro-mcp repo>
uv run idalib-mcp --host 127.0.0.1 --port 8745 [database.i64]
```
Both OpenCode and the Claude CLI connect to the HTTP endpoint at `…:8745/mcp`.

**OpenCode.** Install the UI build from opencode.ai (add its exe to `PATH`) or `npm i -g opencode-ai` (rename the PowerShell wrapper so `opencode.cmd` works from the CLI). A VSCode extension adds a sidebar panel so OpenCode runs inside the editor. Custom model endpoints are supported — e.g. point the base URL at `https://api.moonshot.cn/v1` and select a `kimi-*` model, alongside Claude.

> When building the agent side of this workflow, default to the latest, most capable Claude models (e.g. Opus 4.8) for the reasoning-heavy binary-analysis steps.

---

## Vulnerability-Discovery Workflow

- Give the model a **"binary security researcher"** system prompt: zero-trust assumptions about all input, and a requirement to **construct a complete trigger chain before reporting** a vulnerability (no unfounded "this looks unsafe" claims).
- Have the model **drive the MCP tools itself** to explore the IDA database — enumerate HTTP/RPC callback handlers, read their decompilation, and walk xrefs to reach attacker-controlled entry points.
- Use OpenCode's **plan mode** before build mode to preview changes; avoid pasting into the OpenCode terminal inside VSCode (input handling quirks).

The author also maintains a simplified fork (`ida-mcp-s2`) addressing architectural concerns with the upstream server.

---

## Relevance to Offense

This is the practical realisation of [AI agents for offensive operations](/wiki/concepts/ai-agents-offensive/) applied to VR: the LLM does the tedious breadth-first triage of a large binary's parser surface, and the human reviews the proposed trigger chains. It pairs naturally with [Windows RPC](/wiki/concepts/windows-rpc/) interface recovery, where the tedium of walking many procedures and their marshalling is exactly what an agent can automate.

---

## References

- VictorV (@V-V), "在windows安装opencode和vscode, 体验大模型辅助编程, 并结合ida mcp进行漏洞发现", v-v.space, 2026-03-13 — <https://v-v.space/2026/03/13/vscode_with_opencode/>
- `ida-pro-mcp` (upstream) and the author's `ida-mcp-s2` fork
