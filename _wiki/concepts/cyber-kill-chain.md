---
title: "Cyber Kill Chain"
permalink: /wiki/concepts/cyber-kill-chain/
layout: single
author_profile: true
tags:
  - methodology
---

*Lockheed Martin's seven-stage model of how a targeted intrusion unfolds.*

**Status:** seed
**Related:** [MITRE ATT&CK](/wiki/concepts/mitre-attack/), [Overview](/wiki/overview/), [Initial Access](/wiki/techniques/initial-access/), [Persistence](/wiki/techniques/persistence/)

---

## The seven stages

Hutchins, Cloppert, and Amin (Lockheed Martin, 2011) introduced the model in *Intelligence-Driven Computer Network Defense*. It describes intrusion as a sequence:

1. **Reconnaissance** — research the target, gather info on people, systems, exposure.
2. **Weaponization** — pair an exploit with a deliverable payload (malicious doc, implant, link).
3. **Delivery** — transmit the weapon (email, USB, web).
4. **Exploitation** — trigger the vulnerability or the user action.
5. **Installation** — establish a foothold (RAT, webshell, scheduled task).
6. **Command and Control (C2)** — the implant phones home; operator gains interactive control.
7. **Actions on Objectives** — what the attacker actually came to do (exfil, ransomware, sabotage).

---

## Why it matters

The defensive insight — and the part that's actually useful — is that **breaking any one link breaks the chain**. This frames detection and response as a sequence problem rather than a single-event problem, and gives both sides a shared vocabulary.

For offensive operators, the model is most useful as a planning checklist: do I have my answer for each stage before I touch the target?

---

## Limitations

- **Linear and intrusion-shaped.** Real operations are iterative; insider threats, supply-chain compromise, and identity-theft attacks don't fit cleanly.
- **Stops at "objectives".** Doesn't model post-objective survival, deeper persistence, or destructive actions in detail.
- **Coarse.** Each stage hides enormous complexity. [MITRE ATT&CK](/wiki/concepts/mitre-attack/) is the modern, fine-grained replacement.

The Kill Chain remains useful as a one-slide explanation. ATT&CK is what you actually plan operations against.

---

## References

- Hutchins, Cloppert, Amin — *Intelligence-Driven Computer Network Defense Informed by Analysis of Adversary Campaigns and Intrusion Kill Chains* (Lockheed Martin, 2011)
- Lockheed Martin Cyber Kill Chain — <https://www.lockheedmartin.com/en-us/capabilities/cyber/cyber-kill-chain.html>
