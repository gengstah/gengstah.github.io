---
title: Social Engineering
permalink: /wiki/concepts/social-engineering/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/social-engineering/
---

**Category:** Initial Access / Human
**MITRE ATT&CK:** Initial Access — T1566 (Phishing), T1598 (Spearphishing for Info); Social Engineering broadly across multiple techniques
**Related:** [Phishing](/wiki/concepts/phishing/), [Reconnaissance](/wiki/concepts/reconnaissance/), [Red Teaming](/wiki/concepts/red-teaming/)

## Overview
Social engineering exploits human psychology rather than technical vulnerabilities to manipulate individuals into performing actions or divulging information that benefits the attacker. In red team engagements, it is often the fastest path to initial access. It encompasses phishing, vishing (voice), smishing (SMS), pretexting, and physical intrusion.

## How It Works

### Psychological Principles Exploited
- **Authority:** Impersonate IT, HR, executives, auditors.
- **Urgency:** "Your account will be locked in 2 hours."
- **Scarcity:** "Only 3 licenses remaining — update now."
- **Social proof:** "All other team members have completed this."
- **Reciprocity:** Offer something (help desk assistance) before asking.
- **Liking/Familiarity:** Use victim's name, reference real colleagues/events.

### Phishing (see [Phishing](/wiki/concepts/phishing/) for details)
Email-based pretexting to steal credentials, deliver malware, or gather information.

### Vishing (Voice Phishing)
- Call target pretending to be IT helpdesk, bank, auditor.
- Goals: get OTP codes (MFA bypass), reset passwords, install remote access tools.
- Use caller ID spoofing.
- Script: establish context → build rapport → create urgency → make request.

### Smishing (SMS)
- SMS with malicious links or requests for info.
- Effective because mobile devices have less security tooling.

### Pretexting
Creating a fabricated scenario (pretext) to build trust before making a request.
- "I'm from the IT team doing a security audit — can you help me verify your credentials?"
- Research target on LinkedIn/social media to make pretext believable.

### Physical Social Engineering
- Tailgating: follow badge-carrying employee through secure door.
- Impersonation: delivery person, fire marshal, IT contractor, cleaning crew.
- Dropping USB drives in parking lots (baiting).
- Dumpster diving for sensitive documents, badges, device labels.

## Attack Methodology (Red Team SE)
1. Reconnaissance: identify targets, organizational structure, culture, recent events.
2. Develop pretext: align with target's role, current events (e.g., upcoming system migration, policy update).
3. Select channel: email, phone, SMS, in-person.
4. Execute: deliver pretext, handle objections, achieve objective.
5. Document: capture what worked, what didn't, metrics (click rate, cred submission rate, callback rate).

## Detection & Evasion Notes
- Good pretexts are research-intensive; rushed pretexts fail.
- Verify authorization with client before any physical SE.
- Document everything for legal protection.
- Stop if target seems highly suspicious — don't push to the point of causing distress.
- Always operate within scope and rules of engagement.

## Tools
- `GoPhish` — phishing campaign management
- `SET` (Social-Engineer Toolkit) — SE attack automation
- SpoofCard / Twilio — caller ID spoofing for vishing
- `evilginx2` / `Modlishka` — credential harvesting with MFA bypass
- OSINT tools for pretext building: LinkedIn, Hunter.io, theHarvester

## References
- Christopher Hadnagy, "The Art of Human Hacking"
- MITRE ATT&CK — Social Engineering techniques
- DEF CON Social Engineering CTF (SECTF) archives
