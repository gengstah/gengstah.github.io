---
title: Phishing
permalink: /wiki/concepts/phishing/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/phishing/
---

**Category:** Initial Access / Social Engineering
**MITRE ATT&CK:** T1566 — Phishing (subtech: .001 Spearphishing Attachment, .002 Spearphishing Link, .003 Spearphishing via Service)
**Related:** [Social Engineering](/wiki/concepts/social-engineering/), [Command And Control](/wiki/concepts/command-and-control/), [Evasion Techniques](/wiki/concepts/evasion-techniques/)

## Overview
Phishing is the most common initial access vector in real-world intrusions and red team engagements. It delivers malicious payloads (macro documents, LNK files, HTML smuggling) or harvests credentials through fake login pages. Modern phishing must evade email gateways (SEG), endpoint AV/EDR, and user awareness training.

## How It Works

### Types

#### Credential Harvesting
- Clone legitimate login page (O365, VPN portal, corporate SSO).
- Capture credentials + MFA tokens via adversary-in-the-middle (AiTM) proxy.
- AiTM tools: evilginx3, Modlishka, Muraena — proxy real site, steal session cookies.
- Result: bypass MFA entirely by stealing the authenticated session cookie.

#### Malware Delivery
- **Macro-enabled Office docs:** .docm, .xlsm. Increasingly blocked by default in O365.
- **LNK files:** PowerShell or cmd execution via shortcut. Effective in zip archives.
- **ISO/IMG files:** Mount as drive letter, bypass Mark-of-the-Web (MOTW) on older Windows.
- **HTML Smuggling:** JavaScript decodes and drops payload in browser — bypasses SEG that can't scan JS-encoded blobs.
- **OneNote attachments:** Embed arbitrary files with click-to-run.
- **PDF with embedded link:** Redirect to staging site.
- **ClickFix:** Fake CAPTCHA page that tricks user into running PowerShell from clipboard.

### Infrastructure
- Aged domain (>30 days) with valid MX records and email history.
- Valid SPF, DKIM, DMARC records configured correctly to pass email auth.
- SSL cert on phishing site (Let's Encrypt).
- Categorized domain (or uncategorized) — avoid domains flagged as malicious.
- Redirector in front of credential harvester to hide real server.

### Spearphishing vs. Mass Phishing
- **Spearphishing:** Highly targeted, personalized, research-intensive. Used in APT simulation.
- **Mass phishing:** Generic templates to many recipients. Tests baseline awareness.

## Attack Methodology
```
1. OSINT → identify targets, email format, technology stack (helps tailor pretext)
2. Register/age domain → configure SPF/DKIM/DMARC
3. Build pretext:
   - O365 credential expiry
   - HR benefits enrollment
   - DocuSign document signature
   - IT security alert
   - Executive request (BEC)
4. Craft email:
   - Personalized subject/body (spear) or template (mass)
   - Urgency trigger
   - Call to action: click link / open attachment
5. Deploy via GoPhish or manually via SMTP
6. Monitor for callback / credential submission
7. Pivot: use creds for access, or use shell from payload
```

### GoPhish Quick Setup
```bash
./gophish
# Admin panel: https://localhost:3333
# Create: Sending Profile → Email Template → Landing Page → Campaign
```

## Detection & Evasion Notes
- **SEG detection:** Reputation checks, URL sandboxing, attachment detonation.
- **Evasion:**
  - HTML smuggling bypasses link scanning (payload never in URL, generated client-side).
  - Use redirect chains: legitimate URL shortener → redirect → payload host.
  - AiTM proxy shows real site to SEG scanners (no static malicious content).
  - Delay payload execution: check for sandbox indicators (uptime, mouse movement, screen resolution).
  - ClickFix puts execution in user's hands — bypasses most automated detection.
- **MFA bypass:** AiTM is the gold standard against TOTP/push; phishing-resistant MFA (FIDO2) defeats this.
- Report landing page clicks to GoPhish via tracking pixels/unique links.

## Tools
- `GoPhish` — phishing campaign platform (open source)
- `evilginx3` — AiTM phishing framework
- `Modlishka` / `Muraena` — AiTM alternatives
- `SET` — Social-Engineer Toolkit (legacy but functional)
- `MailSniper` — PowerShell email enumeration/attack tool
- `swaks` — SMTP testing / email sending CLI
- `DNSTwist` — typosquat domain generation

## References
- Kuba Gretzky — evilginx project and blog
- "Red Team Development" phishing infrastructure setup
- MITRE ATT&CK T1566
- "HTML Smuggling Explained" — outflank.nl
