---
title: Web Application Testing
permalink: /wiki/concepts/web-application-testing/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/web-application-testing/
---

**Category:** Web
**MITRE ATT&CK:** Initial Access / Execution — multiple techniques
**Related:** [Sql Injection](/wiki/concepts/sql-injection/), [Xss](/wiki/concepts/xss/), [Reconnaissance](/wiki/concepts/reconnaissance/), [Vulnerability Assessment](/wiki/concepts/vulnerability-assessment/)

## Overview
Web application penetration testing systematically identifies and exploits vulnerabilities in web applications. The methodology follows the OWASP Testing Guide and covers authentication, authorization, injection, business logic, and configuration weaknesses.

## How It Works

### Reconnaissance & Mapping
- Spider/crawl the app to map endpoints, parameters, and functionality.
- Identify tech stack (server headers, cookies, error messages, Wappalyzer).
- Find hidden content: directory brute-force, JS file analysis, robots.txt, sitemap.xml.
- Review client-side JS for endpoints, API keys, hardcoded credentials.

### Authentication Testing
- Default credentials, password spraying, account enumeration via response differences.
- MFA bypass: OTP reuse, response manipulation, skip-step attacks.
- JWT attacks: `alg:none`, weak secrets (crack with hashcat), kid injection.

### Authorization Testing
- IDOR: swap object IDs (numeric, UUID, encoded) across accounts.
- Privilege escalation: access admin endpoints as low-priv user.
- BOLA/BFLA (API-specific OWASP API Top 10).

### Injection Testing
- SQLi, command injection, SSTI, XXE, LDAP injection, NoSQL injection.
- Header injection: Host header attacks, X-Forwarded-For abuse.

### Business Logic
- Price manipulation, quantity abuse, workflow skipping, race conditions.

## Attack Methodology
1. Passive mapping: browse app as unauthenticated, then authenticated user.
2. Active crawl with Burp Suite Spider or OWASP ZAP.
3. Directory/file brute-force with ffuf or feroxbuster.
4. Intercept and manually test all input fields for injection.
5. Test authentication flows thoroughly.
6. Test all access control boundaries.
7. Scan with automated tools (Nuclei templates) as supplement, not replacement.
8. Chain findings: e.g., SSRF → cloud metadata → credential theft → RCE.

## Detection & Evasion Notes
- WAFs block common payloads; encode, case-vary, and chunk payloads.
- Slow request rate to avoid rate limiting and anomaly detection.
- Use legitimate-looking user-agents.
- Some WAFs can be bypassed via IP allowlist abuse (X-Forwarded-For, X-Real-IP).
- Distributed scanning from multiple IPs avoids per-IP rate limits.

## Tools
- `Burp Suite` — intercept proxy, scanner, repeater, intruder
- `ffuf` / `feroxbuster` — directory and parameter fuzzing
- `sqlmap` — automated SQLi detection and exploitation
- `nuclei` — template-based vulnerability scanner
- `nikto` — web server misconfiguration scanner
- `jwt_tool` — JWT attack toolkit
- `OWASP ZAP` — open-source web proxy and scanner
- `dalfox` — XSS scanner
- `gau` / `waybackurls` — collect historical URLs for endpoint discovery

## References
- OWASP Testing Guide v4.2 (2020)
- OWASP API Security Top 10 (2023)
- PortSwigger Web Security Academy
