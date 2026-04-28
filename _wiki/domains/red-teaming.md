---
title: "Red Teaming"
permalink: /wiki/domains/red-teaming/
layout: single
author_profile: true
tags:
  - red-team
  - methodology
---

*Adversary-emulation operations that test detection and response, not vulnerability coverage.*

**Status:** seed
**Related:** [Penetration Testing](/wiki/domains/penetration-testing/), [OPSEC](/wiki/concepts/opsec/), [MITRE ATT&CK](/wiki/concepts/mitre-attack/), [Initial Access](/wiki/techniques/initial-access/), [Lateral Movement](/wiki/techniques/lateral-movement/), [Persistence](/wiki/techniques/persistence/), [Cobalt Strike](/wiki/tools/cobalt-strike/)

{% include toc %}

---

## What it is

A red team operation emulates a specific adversary (or class of adversary) attempting specific objectives against a target organization, with stealth and persistence as first-class concerns. The defender's response is part of what's being measured.

Contrast with [pentesting](/wiki/domains/penetration-testing/):

| | Pentest | Red team |
|---|---|---|
| Goal | Find as many bugs as possible | Achieve a specific objective |
| Notice given | Announced | Almost never |
| Scope | Broad (asset list) | Narrow (objective list) |
| Tradecraft | Loud, comprehensive | Quiet, targeted |
| Defender role | Out of the loop | Being measured |
| Deliverable | Findings catalog | Operation narrative + control failures |

---

## Operation phases

1. **Threat-intelligence-led scoping** — pick an adversary to emulate (e.g. an intrusion set the customer cares about), pick objectives consistent with that adversary's known goals.
2. **Pre-engagement** — Rules of Engagement; legal authorization (the *get-out-of-jail-free letter*); deconfliction process; emergency stop conditions.
3. **External recon** — passive only; assume the target's egress logs.
4. **[Initial access](/wiki/techniques/initial-access/)** — phishing, exposed services, exploit a known weakness, supply chain, physical implant.
5. **Foothold + [persistence](/wiki/techniques/persistence/)** — survive the workstation reboot, the user logout, the AV sweep.
6. **C2** — beacon traffic that blends in. Long jitter, low cadence, redirectors, domain fronting (where still viable).
7. **Internal recon** — passive enumeration: BloodHound collection minus the noisy collectors, file shares, password vaults, mail rules.
8. **[Privilege escalation](/wiki/techniques/privilege-escalation/) and [lateral movement](/wiki/techniques/lateral-movement/)** — Kerberoasting, ADCS abuse, delegation paths, DCSync.
9. **Action on objectives** — the thing the customer asked you to prove possible. Exfil simulation, ransomware dry-run, access to a crown-jewel system.
10. **Exit** — clean up, verify nothing dangerous was left behind, hand off artifacts.
11. **Debrief** — narrative report, telemetry the blue team did/didn't see, ATT&CK heatmap, prioritized improvements.

---

## OPSEC is the discipline

Pentesters can be loud. Red teamers cannot. Every action you take has a *signature* — process tree, network indicator, file artifact, registry change, log entry. The job is to keep that signature below the defender's noise floor for long enough to reach the objective.

See [OPSEC](/wiki/concepts/opsec/) for the operator-side practices.

---

## Adversary emulation vs. red teaming vs. purple teaming

These get conflated:

- **Adversary emulation** — replicate a specific named threat actor's TTPs, ideally TTP-for-TTP. The point is to test detection of *that adversary*.
- **Red team** — broader goal: prove the organization's defenses can or cannot stop a determined attacker reaching specific objectives. Adversary choice is a tool, not the goal.
- **Purple team** — collaborative exercise: red side executes a TTP, blue side checks whether they detected it, both sides iterate to improve detections. No surprise element.

---

## Common platforms / frameworks

- **[Cobalt Strike](/wiki/tools/cobalt-strike/)** — the dominant commercial C2.
- **Sliver** — open-source C2 in Go.
- **Mythic** — modular, multi-agent C2 framework.
- **Brute Ratel C4** — commercial C2 designed around modern EDR evasion.
- **Havoc** — open-source C2 with sleep obfuscation built in.
- **CALDERA** — MITRE's adversary-emulation automation.
- **Atomic Red Team** — atomic test cases mapped to ATT&CK; useful for purple teaming.

Tooling alone does not make a red team. The operator's discipline does.

---

## Rules of engagement essentials

- Authorization letter signed by someone with authority to grant it.
- Defined objectives — what counts as success.
- Defined out-of-scope assets — what you must not touch (production health systems, regulated data outside scope, third-party services).
- Working hours and notification triggers.
- Deconfliction contact — a defender-side person who can rule "is this you?" without burning the operation.
- Emergency stop conditions — what makes you halt immediately.
- Data handling — how captured credentials, tokens, files are stored and destroyed.

---

## References

- *Red Team Field Manual* — Ben Clark
- *Operator Handbook* — Joshua Picolet
- MITRE — *11 Strategies of a World-Class Cybersecurity Operations Center* (the blue-side perspective worth knowing)
- CISA — *Joint Cybersecurity Advisory* series (real adversary TTPs to emulate)
