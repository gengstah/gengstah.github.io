---
title: Red Teaming
permalink: /wiki/offsec-notes/concepts/red-teaming/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Engagement Methodology
**MITRE ATT&CK:** Full kill chain simulation
**Related:** [Purple Teaming](/wiki/offsec-notes/concepts/purple-teaming/), [Command And Control](/wiki/offsec-notes/concepts/command-and-control/), [Social Engineering](/wiki/offsec-notes/concepts/social-engineering/), [Phishing](/wiki/offsec-notes/concepts/phishing/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/)

## Overview
Red teaming is an adversary simulation exercise where a skilled team attempts to achieve specific objectives (e.g., access crown jewels, simulate ransomware deployment, exfiltrate sensitive data) against a target organization, emulating the TTPs of a real threat actor. Unlike penetration testing, which is comprehensive vulnerability discovery, red teaming is objective-driven and covert — the blue team (SOC) is typically unaware and responds as they would to a real attack.

## How It Works

### Red Team vs. Penetration Test
| Aspect | Penetration Test | Red Team |
|--------|-----------------|----------|
| Objective | Find all vulnerabilities | Achieve specific goals |
| Scope | Broad, defined | Narrow and realistic |
| Blue team | Often notified | Usually unaware (blind) |
| Duration | Days–weeks | Weeks–months |
| Stealth | Not primary concern | Critical |
| Output | Vulnerability report | Adversary simulation report |

### Phases

#### 1. Planning & Rules of Engagement
- Define objectives: flag capture, data exfiltration, domain compromise, lateral-only.
- Scope: IP ranges, domains, social engineering allowed?, physical?
- Deconfliction: out-of-band communication channel with client POC.
- Emergency stop procedures.
- Threat actor profile: which APT / ransomware group to emulate?

#### 2. Reconnaissance
Full OSINT campaign (see [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/)). Map employees, tech stack, physical locations.

#### 3. Initial Access
Phishing, credential stuffing, exploit against external-facing service, physical intrusion. First one to work wins — move quickly.

#### 4. Establish Foothold & C2
Deploy beacon with resilient C2 infrastructure (see [Command And Control](/wiki/offsec-notes/concepts/command-and-control/)). Establish persistence early in case of detection/remediation.

#### 5. Internal Reconnaissance
Enumerate internal network, AD, trust relationships — quietly.

#### 6. Privilege Escalation
Elevate from initial access context to domain-level or cloud admin.

#### 7. Lateral Movement
Move toward objective systems without triggering detection.

#### 8. Objective Achievement
Capture flag, access crown jewels, simulate ransomware (rename files, DON'T encrypt in prod without explicit written authorization).

#### 9. Reporting
- Executive summary: business impact, what was achieved, what wasn't.
- Technical narrative: full attack chain with timestamps, IOCs, screenshots.
- Detection gaps: what the blue team missed and why.
- Recommendations: prioritized by impact and ease.

### Threat Actor Emulation
Map planned TTPs to a real threat actor relevant to the client's industry.
Use MITRE ATT&CK for mapping. Tools: MITRE ATT&CK Navigator, Atomic Red Team for specific technique emulation.

## OPSEC Considerations
- Assume everything is logged. Minimize footprint.
- Burn only one infrastructure component at a time; have backups.
- Use staged payloads — first stage is small; pulls full payload only from expected IPs.
- Don't reuse infrastructure across engagements.
- Communicate with client POC via out-of-band encrypted channel (Signal, PGP email).
- Document all actions with timestamps for deconfliction.

## Tools
- C2: Cobalt Strike, Sliver, Havoc (see [Command And Control](/wiki/offsec-notes/concepts/command-and-control/))
- Phishing: GoPhish, evilginx3
- AD: BloodHound, Impacket, Rubeus, Mimikatz
- Infra: Terraform/Ansible for disposable infrastructure
- MITRE ATT&CK Navigator — attack planning and coverage mapping

## References
- "Red Team Development and Operations" — Joe Vest & James Tubberville
- C2 Matrix — thec2matrix.com
- MITRE ATT&CK — Full Enterprise ATT&CK matrix
- "Operator's Manual" — Cobalt Strike documentation
- TIBER-EU Framework — ECB threat-led penetration testing
