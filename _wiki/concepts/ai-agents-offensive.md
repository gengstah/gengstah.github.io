---
title: AI Agents for Offensive Operations
permalink: /wiki/concepts/ai-agents-offensive/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/ai-agents-offensive/
---

**Category:** Emerging Techniques / Automation
**MITRE ATT&CK:** (No specific technique — cross-cutting automation capability)
**Related:** [Red Teaming](/wiki/concepts/red-teaming/), [Reconnaissance](/wiki/concepts/reconnaissance/), [Command And Control](/wiki/concepts/command-and-control/)

## Overview
LLM-powered agents can autonomously execute multi-step offensive tasks by combining a reasoning model with a toolset (OS commands, C2 APIs, network scanners). The Model Context Protocol (MCP) provides a standardized framework for wiring tools to LLMs, making it practical to build reconnaissance agents, enumerate Active Directory, or integrate with C2 frameworks like Mythic — all with Claude or local models as the decision engine.

## Core Concepts

### Agent Architecture
An agent has two components:
- **Brain:** LLM responsible for reasoning, planning, and tool selection (Claude, GPT-4, local models via Ollama)
- **Body:** Tools the agent can invoke — subprocess calls, API requests, C2 callbacks

Agents use the **ReAct** paradigm (Reasoning + Acting): Thought → Action → Observation → loop.

### What Is MCP?
Model Context Protocol (MCP) is a client-server framework that standardizes how applications expose tools and context to LLMs. An MCP server exposes:
- **Tools:** Executable functions (wrap OS commands, APIs)
- **Prompts:** Reusable prompt templates

One LLM host (e.g., Claude Desktop) connects to multiple MCP servers simultaneously.

## Building an Offensive MCP Agent

### Server Scaffold (FastMCP)
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("network_mapper")

@mcp.prompt()
def setup_prompt(subnet: str, objective: str) -> str:
    return f"""
You are a senior penetration tester specialising in internal networks.
Your objective is to: {objective}
Target subnet: {subnet}

Think step by step. Use the ReAct pattern:
Thought: what to do
Action: which tool to call
Observation: what the result means
"""

@mcp.tool()
async def run_ldap_dns_query(host: str) -> str:
    """Perform LDAP DNS query to identify domain controller."""
    command = f"dig -t SRV _ldap._tcp.dc._msdcs.{host}"
    return execute_os_command(command)

@mcp.tool()
async def run_nmap_icmp(subnet: str) -> str:
    """ICMP sweep of subnet to discover live hosts."""
    return execute_os_command(f"nmap -sn {subnet}")

@mcp.tool()
async def run_ldap_search(dc: str, base_dn: str, filter: str) -> str:
    """Query LDAP for AD enumeration."""
    return execute_os_command(
        f"ldapsearch -H ldap://{dc} -x -b '{base_dn}' '{filter}'"
    )
```

### Running and Debugging
```bash
# Start MCP inspector (debug UI at localhost:5173)
npx @modelcontextprotocol/inspector uv run main.py

# Or use 5ire as an alternative client
```

### Mythic C2 Integration
Adam Chester (@_xpn_) demonstrated wrapping Mythic C2 API callbacks as MCP tools, giving Claude direct control over C2 agents:
- github.com/xpn/mythic_mcp
- Agent can autonomously Kerberoast, lateral move, exfiltrate based on goals

## Tool Ideas for Offensive Agents

| Category | Tools to Wrap |
|----------|--------------|
| Recon | nmap, ldapsearch, nslookup, dig, ping, smbclient |
| AD Enumeration | ldapsearch, impacket GetUserSPNs/GetADUsers |
| Credential Attacks | kerbrute (password spray), hashcat, impacket |
| C2 Integration | Mythic API, Sliver gRPC API |
| Reporting | Custom markdown/HTML report generators |

## LlamaIndex Alternative
For more control (e.g., local models via Ollama):
```python
from llama_index.llms.ollama import Ollama
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import FunctionTool

llm = Ollama(model="llama3.1:8b", base_url="http://192.168.1.218:11434")

tools = [
    FunctionTool.from_defaults(fn=run_nmap_icmp),
    FunctionTool.from_defaults(fn=run_ldap_search),
    FunctionTool.from_defaults(fn=run_password_spray),
]

agent = ReActAgent.from_tools(tools=tools, llm=llm, max_iterations=20)
response = agent.chat("Map the network at 192.168.1.0/24 and find the domain controller")
```

## Agentic Frameworks Comparison

| Framework | Notes |
|-----------|-------|
| MCP (Anthropic) | Standardized client-server; Claude Desktop integration; multi-server |
| LlamaIndex | More control; supports local models; no extra client needed |
| Microsoft AutoGen | Multi-agent orchestration; good for complex workflows |
| CrewAI | Role-based agent teams |
| LangGraph | Stateful agent graphs; good for long-running tasks |
| SmolAgents | Barebones; writes Python code to call tools |
| nerve (evilsocket) | YAML-based rules; great for simple offensive agents |

## OPSEC Considerations
- Agent reasoning and tool calls may be logged if using cloud LLM APIs
- Tool calls generate real network traffic — scan logs, LDAP queries, DNS lookups
- Use local models (Ollama) for sensitive operations to avoid API logging
- Wrap C2 callbacks instead of direct OS tools to maintain existing C2 OPSEC

## MCP-Powered Vulnerability Research (ilspycmd + Claude)

Building an MCP server that gives Claude the ability to decompile .NET assemblies enables automated vulnerability hunting in Windows binaries.

### ilspycmd Docker MCP Server
```python
from mcp.server.fastmcp import FastMCP
import subprocess, os

server = FastMCP("ilspy docker")

@server.tool()
def run_ilspycmd_docker(exe_path, output_folder) -> int:
    input_dir = os.path.abspath(os.path.dirname(exe_path))
    output_dir = os.path.abspath(output_folder)
    exe_filename = os.path.basename(exe_path)
    os.makedirs(output_dir, exist_ok=True)
    
    ilspy_cmd_path = "/home/ilspy/.dotnet/tools/ilspycmd"
    ilspy_command = f"{ilspy_cmd_path} -p -o /decompile_out {'/decompile_in'}/{exe_filename}"
    
    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{input_dir}:/decompile_in",
        "-v", f"{output_dir}:/decompile_out",
        "ilspycmd", ilspy_command
    ]
    return subprocess.run(docker_cmd, capture_output=True, text=True).returncode

if __name__ == "__main__":
    server.run(transport='stdio')
```

**Workflow for deserialization hunting:**
1. Claude decompiles target .NET assembly via ilspycmd
2. Claude reviews all decompiled files, searching for `BinaryFormatter.Deserialize`, `TypeFilterLevel.Full`, etc.
3. Claude identifies attack paths from entry points to unsafe deserialize calls
4. Claude generates PoC exploit code (e.g., using `ysoserial.net` payloads)

**Case study — AddinUtil.exe (known vuln + new path):**
- `System.AddIn.dll` contains unsafe `.NET remoting` deserialization (`TypeFilterLevel.Full`)
- Claude identified the `-pipelineroot` flag path not documented in original disclosure
- Generated working PoC that loads `AddIns.store` with crafted format → triggers `BuildAddInCache` → deserializes payload

**Tips:**
- Explicitly instruct Claude to review ALL files — it may stop early without prompting
- Use `ysoserial.exe -f BinaryFormatter -g TypeConfuseDelegate -c calc -o raw > payload.bin` for PoC payloads
- Step-through debugging with dotPeek + Visual Studio resolves gaps in Claude's PoC

## LLM-Trained Specialist Models (RLVR)

**Dante-7B** — Outflank's 7B parameter specialist model for evasive shellcode loader generation, trained with Reinforcement Learning with Verifiable Rewards (RLVR) targeting Microsoft Defender for Endpoint.

**Hugging Face:** huggingface.co/outflanknl/Dante-7B

### Training Pipeline
1. **SFT** — Fine-tune Qwen2.5-Coder-7B on CodeForces C++/Python + DeepSeek R1-generated shellcode loaders
2. **RLVR** (GRPO) — Train against AV/EDR verifier:
   - Verifier provisions clean VM, installs target EDR
   - Executes generated loader via simulated double-click
   - Rewards: output format → compilation → functionality (Cobalt Strike callback) → evasion (no alerts)

### Key Results
- Dante-7B (7B params) outperforms DeepSeek R1 (671B) at generating evasive CS loaders
- >8% completely bypass MDE; generates multiple completions per prompt for reliability
- 56 hours training on 8×H100 GPUs

### RLVR Concepts

| Concept | Description |
|---------|-------------|
| GRPO | Group Relative Policy Optimization — variant of PPO without a separate reward model |
| Verifiable task | Objective truth + fast + scalable + low noise + continuous reward |
| No dataset needed | Model learns through trial/error against verifier; no human-labeled examples |
| Chain-of-thought | RLVR naturally develops reasoning steps toward correct outputs |

### Trapped COM Objects for Lateral Movement (LLM-Generated PoC)
Outflank used a multi-agent LLM workflow to enumerate and exploit COM classes for lateral movement:

1. **Enumeration agent** — Python script queries WMI for all COM classes with `AllowRemoteActivation=True`, writes to JSON
2. **Filtering agent** — GPT-4.1 reviews JSON, identifies classes with `code execution` potential
3. **PoC generation agent** — GPT-4.1 generates C#/PowerShell PoC for each promising class
4. **Validation** — Human reviews generated PoCs, tests promising ones

**FileSystemImage CLSID:** `{2C941FC5-975B-59BE-A960-9A2A262853A5}`
- Registry requirements: `AllowDCOMReflection`, `OnlyUseLatestCLR`, `TreatAs`
- Exploitable via `.NET` reflection → `Assembly.Load` → arbitrary code execution

## References
- TrustedSec — "MCP: An Introduction to Agentic Op Support" (2025-03-28)
- TrustedSec — "Hunting Deserialization Vulnerabilities With Claude" (2025-06-12)
- Outflank — "Accelerating Offensive R&D with LLMs" (2025-07-31)
- Outflank — "Training Specialist Models (Dante-7B)" (2025-08-07)
- Adam Chester (@_xpn_) — github.com/xpn/mythic_mcp
- evilsocket — "How to Write an Agent" + nerve project
- ReAct paper — arxiv.org/abs/2210.03629
- MCP docs — modelcontextprotocol.io
