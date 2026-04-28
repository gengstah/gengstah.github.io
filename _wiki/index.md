---
title: "Offensive Security Wiki — Index"
permalink: /wiki/
layout: single
author_profile: true
sidebar:
  nav: "wiki"
---

*Master catalog of every wiki page. Maintained by the LLM agent — see [schema](/wiki/schema/).*

**Last updated:** 2026-04-28

---

## Core

| Page | Description |
|------|-------------|
| [Overview](/wiki/overview/) | The offensive-security landscape, the four pillars, kill-chain map |
| [Schema](/wiki/schema/) | Conventions the LLM follows when maintaining this wiki |
| [Log](/wiki/log/) | Chronological record of ingest / query / lint operations |

---

## Domains

| Page | Focus |
|------|-------|
| [Penetration Testing](/wiki/domains/penetration-testing/) | Scoped engagements, methodology, reporting |
| [Red Teaming](/wiki/domains/red-teaming/) | Adversary emulation, full-kill-chain, OPSEC |
| [Vulnerability Research](/wiki/domains/vulnerability-research/) | Code review, fuzzing, root-cause analysis |
| [Exploit Development](/wiki/domains/exploit-development/) | Bugs → primitives → reliable exploits |

---

## Concepts

| Page | Description |
|------|-------------|
| [Cyber Kill Chain](/wiki/concepts/cyber-kill-chain/) | Lockheed Martin's seven-stage model |
| [MITRE ATT&CK](/wiki/concepts/mitre-attack/) | Tactics, techniques, and procedures matrix |
| [OPSEC](/wiki/concepts/opsec/) | Operational security for offensive operators |

---

## Techniques

| Page | Stage |
|------|-------|
| [Reconnaissance](/wiki/techniques/recon/) | Passive + active enumeration |
| [Initial Access](/wiki/techniques/initial-access/) | Phishing, exposed services, supply chain |
| [Privilege Escalation](/wiki/techniques/privilege-escalation/) | Local user → admin / SYSTEM / root |
| [Lateral Movement](/wiki/techniques/lateral-movement/) | Pivoting, credential reuse, RDP / SMB / WMI |
| [Persistence](/wiki/techniques/persistence/) | Surviving reboots, evading cleanup |

---

## Tools

| Page | Category |
|------|----------|
| [nmap](/wiki/tools/nmap/) | Network discovery + port scanning |
| [Burp Suite](/wiki/tools/burpsuite/) | Web app testing proxy |
| [Ghidra](/wiki/tools/ghidra/) | Reverse engineering |
| [Cobalt Strike](/wiki/tools/cobalt-strike/) | Adversary simulation / C2 |

---

## CVEs

*No deep-dive CVE pages yet. File new ones under `_wiki/cves/CVE-YYYY-NNNNN.md`.*

---

## Resources

| Page | Description |
|------|-------------|
| [Reading List](/wiki/resources/reading-list/) | Books, papers, blog posts worth your time |
| [Researchers](/wiki/resources/researchers/) | People doing notable work, by specialty |

---

## Tag Index

Quick lookup by tag. Re-generate when adding pages.

- **`pentest`** — domains/penetration-testing, techniques/recon, tools/nmap, tools/burpsuite
- **`red-team`** — domains/red-teaming, concepts/opsec, techniques/initial-access, techniques/lateral-movement, techniques/persistence, tools/cobalt-strike
- **`vuln-research`** — domains/vulnerability-research, tools/ghidra
- **`exploit-dev`** — domains/exploit-development, tools/ghidra
- **`methodology`** — concepts/cyber-kill-chain, concepts/mitre-attack
- **`opsec`** — concepts/opsec, domains/red-teaming
