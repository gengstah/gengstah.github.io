---
title: "Offensive Security — Landscape Overview"
permalink: /wiki/overview/
layout: single
author_profile: true
tags:
  - methodology
---

*The landscape this wiki covers and how its parts fit together.*

**Status:** seed
**Related:** [Penetration Testing](/wiki/domains/penetration-testing/), [Red Teaming](/wiki/domains/red-teaming/), [Vulnerability Research](/wiki/domains/vulnerability-research/), [Exploit Development](/wiki/domains/exploit-development/), [Cyber Kill Chain](/wiki/concepts/cyber-kill-chain/), [MITRE ATT&CK](/wiki/concepts/mitre-attack/)

{% include toc %}

---

## The four pillars

Offensive security is a continuum, but four distinguishable disciplines anchor it:

| Pillar | Question it answers | Time horizon | Output |
|--------|---------------------|--------------|--------|
| **Penetration testing** | Where can an attacker break in *right now* against this scoped target? | Days–weeks | Findings report with reproducible exploits |
| **Red teaming** | Can our adversary's playbook achieve their objectives against our defenses? | Weeks–months | Operation narrative, detection gaps, control failures |
| **Vulnerability research** | What unknown bugs exist in this target, and how do they work? | Weeks–years | Bug reports, advisories, CVEs |
| **Exploit development** | Can this bug be turned into a reliable weapon? | Days–months | PoCs, weaponized exploits, mitigation bypasses |

These overlap. A vuln researcher who can't write a PoC is incomplete; a pentester who can't recognize a 0-day in front of them leaves money on the table; a red teamer leans on both pentester tradecraft and exploit-dev primitives.

---

## How attacks unfold

Two complementary models map the territory:

- **[Cyber Kill Chain](/wiki/concepts/cyber-kill-chain/)** (Lockheed Martin, 2011) — seven stages from recon to objectives. Useful for thinking about *intrusion as a process*.
- **[MITRE ATT&CK](/wiki/concepts/mitre-attack/)** — empirical matrix of tactics × techniques observed in real intrusions. Useful for *enumerating options* at each stage.

Modern operations think in ATT&CK; the Kill Chain is the diagram you draw on the whiteboard.

---

## Where each pillar lives on the kill chain

```
recon → weaponize → deliver → exploit → install → C2 → actions
  ▲        ▲          ▲         ▲        ▲      ▲      ▲
  └────────┴── pentest covers most stages, scoped ─────┘
                              ▲         ▲      ▲      ▲
                              └─ red team operates here, end-to-end ─┘
              ▲          ▲         ▲
              └─ exploit dev produces the artifacts that go here ─┘
                         ▲
                         └─ vuln research finds what makes this stage possible
```

---

## The bug → exploit → operation pipeline

A useful mental model:

1. **A bug exists.** Discovered via code review, fuzzing, patch diffing, or a vendor's advisory.
2. **The bug becomes a primitive.** Memory disclosure → info leak; controlled write → AAW; controlled call → code execution. See [Exploit Development](/wiki/domains/exploit-development/).
3. **Primitives chain into a working exploit.** Reliable, version-portable, mitigation-aware.
4. **The exploit slots into an operation.** Initial access? Privilege escalation? Sandbox escape? Lateral movement against a hardened target?

Most of the wiki sits at one of these four altitudes.

---

## What makes offense hard *now*

A short list of forces shaping current tradecraft:

- **EDR is everywhere.** Behavioral detection, in-process telemetry, cloud-side correlation. Tradecraft that worked in 2015 trips alerts in 2026.
- **Mitigations stack up.** ASLR, DEP, CFG, ACG, CET, KASLR, SMEP, HVCI, VBS — each one removes a class of techniques. Bypass research is its own subfield.
- **Cloud changes the surface.** IAM misconfig, exposed metadata, CI/CD trust paths often beat memory corruption for ROI.
- **Identity is the new perimeter.** Federation, OAuth, SSO, conditional access — token theft and consent abuse outpace network exploitation in many engagements.
- **Supply chain matters.** Compromising a dependency or a build system reaches further than any single endpoint.

---

## How to use this wiki

- **Browsing:** start at [Index](/wiki/) for the catalog.
- **Studying a topic:** open the relevant [domain](/wiki/domains/penetration-testing/) page and follow links outward.
- **Asking a question:** follow the cross-references between pages — every page links related material in its **Related:** line and `## See also` section.
- **Adding a source:** drop it in `raw_sources/`, then distill the takeaways into the relevant wiki pages. See the [schema](/wiki/schema/) for the workflow I follow.

---

## References

- Lockheed Martin — *Intelligence-Driven Computer Network Defense* (Hutchins, Cloppert, Amin, 2011)
- MITRE ATT&CK — <https://attack.mitre.org/>
