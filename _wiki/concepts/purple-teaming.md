---
title: Purple Teaming
permalink: /wiki/concepts/purple-teaming/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/purple-teaming/
---

**Category:** Engagement Methodology
**MITRE ATT&CK:** Full ATT&CK matrix (detection validation focus)
**Related:** [Red Teaming](/wiki/concepts/red-teaming/), [Vulnerability Assessment](/wiki/concepts/vulnerability-assessment/), [Evasion Techniques](/wiki/concepts/evasion-techniques/)

## Overview
Purple teaming is a collaborative exercise where red and blue teams work together openly to test, validate, and improve detection and response capabilities. Unlike a blind red team, the blue team is fully aware and participates — the goal is maximizing the defensive value of each technique tested, not stealth or objective achievement.

## How It Works

### Purple Team vs. Red Team

| Aspect | Red Team | Purple Team |
|--------|----------|-------------|
| Blue team awareness | Usually unaware | Fully aware, collaborative |
| Primary goal | Achieve objective | Improve detection coverage |
| Stealth | Critical | Irrelevant |
| Value | Realistic attack simulation | Detection validation and tuning |
| Output | Adversary simulation report | Detection coverage matrix |

### Structure

#### Continuous Purple Teaming
- Red and blue side-by-side at all times.
- Red executes one technique → blue immediately checks for detection → tune if missed → next technique.
- Fast feedback loop; high volume of techniques covered.

#### Adversary Emulation-Based Purple Team
- Define threat actor profile (e.g., FIN7, APT29, Lazarus Group).
- Map their known TTPs to ATT&CK.
- Red executes TTPs from that profile.
- Blue validates detection for each.

### Purple Team Workflow (per technique)
```
1. Select technique (ATT&CK TTP)
2. Red executes technique in controlled way
3. Blue: Did the SIEM/EDR alert? Was the alert actionable?
4. If NO detection:
   a. Examine logs — is telemetry present but no alert?
   b. If telemetry present: create/tune detection rule
   c. If no telemetry: identify logging gap → fix → re-test
5. If YES detection: evaluate quality (alert quality, response time, false positive rate)
6. Document result in coverage matrix
7. Move to next technique
```

### Atomic Red Team
Atomic Red Team (by Red Canary) provides minimal, single-TTP test scripts mapped to ATT&CK.
```bash
# Install
Install-Module -Name invoke-atomicredteam

# Execute specific technique
Invoke-AtomicTest T1059.001         # PowerShell
Invoke-AtomicTest T1003.001 -Cleanup # LSASS dump, then cleanup
```

### Coverage Mapping
Use MITRE ATT&CK Navigator to visualize:
- Techniques tested (colored by test result)
- Detected vs. undetected breakdown
- Priority gaps for remediation

## Key Metrics
- **Detection rate:** % of techniques that generated an alert.
- **True positive rate:** % of alerts that were correctly classified.
- **Mean time to detect (MTTD):** How fast did the alert fire after execution?
- **Mean time to respond (MTTR):** How fast did the analyst respond?
- **Logging coverage:** % of techniques with sufficient telemetry.

## Tools
- `Atomic Red Team` — TTP test library (Red Canary)
- `MITRE ATT&CK Navigator` — coverage visualization
- `Caldera` (MITRE) — automated adversary emulation platform
- `Stratus Red Team` — cloud-focused atomic tests (DataDog)
- `PurpleSharp` — .NET adversary simulation
- `Sigma` — SIEM-agnostic detection rules (use as reference for what should be detected)

## References
- "Purple Team Exercise Framework" — VECTR
- MITRE ATT&CK Navigator — mitre-attack.github.io/attack-navigator
- Atomic Red Team — github.com/redcanaryco/atomic-red-team
- "Operationalizing MITRE ATT&CK" — Red Canary
