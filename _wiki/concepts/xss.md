---
title: Cross-Site Scripting (XSS)
permalink: /wiki/concepts/xss/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/xss/
---

**Category:** Web
**MITRE ATT&CK:** T1059.007 (Command and Scripting Interpreter: JavaScript)
**Related:** [Web Application Testing](/wiki/concepts/web-application-testing/), [Sql Injection](/wiki/concepts/sql-injection/), [Phishing](/wiki/concepts/phishing/)

## Overview
XSS allows attackers to inject malicious scripts into web pages viewed by other users. Despite being "client-side," XSS can lead to session hijacking, credential theft, keylogging, CSRF token theft, and browser-based pivoting (BeEF).

## How It Works

### Types
- **Reflected:** Payload in request, immediately echoed in response. Requires victim to click a crafted link.
- **Stored (Persistent):** Payload saved in DB, served to all users who view that content. Higher impact.
- **DOM-based:** Payload processed by client-side JS without server reflection. Sink is in the DOM (e.g., `innerHTML`, `document.write`, `eval`).
- **Blind:** Stored XSS where the attacker doesn't see the execution directly (e.g., in an admin panel log viewer). Use OOB callbacks.

### Common Sinks
`innerHTML`, `outerHTML`, `document.write()`, `eval()`, `setTimeout(str)`, `location.href`, `src` attributes.

### Filter Bypass Techniques
- Case variation: `<ScRiPt>`
- Event handlers: `<img src=x onerror=alert(1)>`
- SVG: `<svg onload=alert(1)>`
- Template literals, Unicode escapes, HTML entities
- Polyglots for multiple contexts

### Impact Escalation
- Steal session cookies (if not HttpOnly): `document.cookie`
- Keylog form inputs
- Phish users via injected login forms
- CSRF using victim's authenticated session
- Pivot with BeEF (browser exploitation framework)
- Escalate to stored XSS → admin panel → server compromise

## Attack Methodology
1. Identify all user-controlled input reflected in HTML output.
2. Determine context: HTML body, attribute, JS string, URL, CSS.
3. Craft context-appropriate payload to break out and execute JS.
4. Test for stored XSS in all persistent inputs (comments, profiles, etc.).
5. Analyze client-side JS for DOM sinks and taint flows.
6. For blind XSS: use OOB callbacks (XSS Hunter, interactsh) to confirm execution.

## Detection & Evasion Notes
- CSP (Content Security Policy) blocks inline scripts; bypass via JSONP, dangling markup, script gadgets.
- HttpOnly flag prevents cookie theft but not all impact.
- WAFs block obvious payloads — use encoded, obfuscated, or uncommon vectors.
- Mutation XSS (mXSS): browser parser behavior differences cause sanitizer bypass.

## Tools
- `dalfox` — fast XSS scanner with blind XSS support
- `XSS Hunter` / `xsshunter-express` — blind XSS callbacks
- `knoxss` — cloud-based XSS finder
- Burp Suite Scanner + DOM Invader — automated + manual
- `interactsh` — OOB interaction server for blind XSS confirmation
- `BeEF` — browser exploitation framework for post-XSS pivoting

## References
- PortSwigger XSS Labs (Web Security Academy)
- OWASP XSS Prevention Cheat Sheet
- PayloadsAllTheThings XSS section
