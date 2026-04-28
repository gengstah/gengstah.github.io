---
title: "MITRE ATT&CK"
permalink: /wiki/concepts/mitre-attack/
layout: single
author_profile: true
tags:
  - methodology
---

*An empirical knowledge base of adversary tactics, techniques, and procedures observed in real intrusions.*

**Status:** seed
**Related:** [Cyber Kill Chain](/wiki/concepts/cyber-kill-chain/), [Red Teaming](/wiki/domains/red-teaming/), [Overview](/wiki/overview/)

---

## Structure

ATT&CK is organized as a matrix:

- **Tactics** — the *why*. The adversary's goal at this stage. (e.g. Initial Access, Persistence, Privilege Escalation, Lateral Movement, Exfiltration.)
- **Techniques** — the *how*. A general method to achieve a tactic. (e.g. T1566 *Phishing*.)
- **Sub-techniques** — a more specific *how*. (e.g. T1566.001 *Spearphishing Attachment*.)
- **Procedures** — concrete implementations actually used by groups. (e.g. APT29 used *Cobalt Strike beacon dropped via spearphishing attachment to a credential-harvesting site*.)

Three matrices: **Enterprise** (Windows, macOS, Linux, Cloud, Containers, Network), **Mobile** (iOS, Android), **ICS** (industrial control).

Each technique page gives: definition, procedure examples by group, mitigations, detections, references.

---

## Why operators use it

- **Common vocabulary** — `T1003.001 LSASS Memory` means the same thing to red, blue, threat-intel, and management.
- **Coverage map** — heatmap your operation against the matrix; show what you exercised.
- **Adversary emulation** — pick a group (FIN7, APT41, Lazarus, …), look up their techniques, replicate them.
- **Reporting** — ATT&CK-tagged findings are immediately actionable for the defender.

---

## Why blue uses it

- **Detection coverage** — which techniques does our telemetry cover? Which don't we see?
- **Threat intel correlation** — observed activity → mapped technique → known groups using that technique.
- **Engineering targets** — write detections per technique; track coverage as a metric.

The shared vocabulary is the point. Red-vs-blue conversations got noticeably better once both sides spoke ATT&CK.

---

## Useful adjacent projects

- **MITRE ATLAS** — same structure, but for ML system attacks.
- **MITRE D3FEND** — defensive countermeasures, mapped to ATT&CK techniques they counter.
- **Atomic Red Team** (Red Canary) — atomic test cases, one per technique, ready to run.
- **CALDERA** — automation framework for adversary emulation against ATT&CK.

---

## References

- ATT&CK — <https://attack.mitre.org/>
- ATT&CK Navigator — <https://mitre-attack.github.io/attack-navigator/>
- Atomic Red Team — <https://github.com/redcanaryco/atomic-red-team>
- MITRE D3FEND — <https://d3fend.mitre.org/>
