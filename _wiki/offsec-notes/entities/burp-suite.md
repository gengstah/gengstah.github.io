---
title: Burp Suite
permalink: /wiki/offsec-notes/entities/burp-suite/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool
**Also known as:** Burp, Burp Suite Professional, Burp Suite Community
**Related:** [Web Application Testing](/wiki/offsec-notes/concepts/web-application-testing/), [Sql Injection](/wiki/offsec-notes/concepts/sql-injection/), [Xss](/wiki/offsec-notes/concepts/xss/)

## Description
Burp Suite is the leading platform for web application security testing. It acts as an intercepting HTTP/HTTPS proxy, with tools for manual testing (Repeater, Intruder), automated scanning (Scanner — Pro only), and extensibility via the BApp store. Developed by PortSwigger.

## Usage / Details

### Core Tools
| Tool | Purpose |
|------|---------|
| **Proxy** | Intercept and modify browser traffic |
| **Repeater** | Manually replay and tweak requests |
| **Intruder** | Fuzzing and brute-force attacks |
| **Scanner** | Automated vulnerability scanning (Pro) |
| **Decoder** | Encode/decode (Base64, URL, hex, etc.) |
| **Comparer** | Diff two requests/responses |
| **Logger** | Full traffic log |
| **DOM Invader** | DOM XSS testing via browser extension |
| **Collaborator** | Out-of-band interaction server (SSRF, blind SQLi, blind XSS) |

### Setup
1. Set browser proxy to `127.0.0.1:8080`.
2. Install Burp CA certificate in browser (navigate to `http://burp`).
3. Or use Burp's embedded Chromium browser (built-in, no cert install needed).

### Common Workflows

#### Manual Testing with Repeater
- Intercept request → Send to Repeater (Ctrl+R) → Modify and resend.
- Test for SQLi: add `'`, observe error. Test for XSS: inject `<script>alert(1)</script>`.

#### Fuzzing with Intruder
```
1. Send request to Intruder (Ctrl+I)
2. Mark injection point: §value§
3. Attack type:
   - Sniper: one payload set, one position
   - Battering Ram: same payload in all positions
   - Pitchfork: parallel payload sets
   - Cluster Bomb: cartesian product (brute-force)
4. Load payload list (SecLists, custom)
5. Configure match/filter rules to spot successes
```
Note: Community edition rate-limits Intruder. Use `ffuf` or `feroxbuster` for speed.

#### Burp Collaborator (OAST)
- Provides unique `*.oastify.com` domain.
- Use in payloads for SSRF, XXE, blind SQLi, blind XSS → confirm OOB interaction.
- Check "Collaborator" tab for incoming DNS/HTTP callbacks.

#### Scanning (Pro)
- Right-click request → "Scan" → Active or Passive scan.
- Crawl + Audit on a scope for broad coverage.
- Review Issue Activity for findings.

### Useful Extensions (BApp Store)
- `Autorize` — automated authorization testing (IDOR)
- `Turbo Intruder` — high-speed fuzzer (Python scripts)
- `HTTP Request Smuggler` — request smuggling testing
- `JWT Editor` — JWT manipulation
- `Active Scan++` — extend scanner capabilities
- `Param Miner` — discover hidden parameters
- `Hackvertor` — complex payload encoding
- `Logger++` — enhanced logging with filtering

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Send to Repeater | Ctrl+R |
| Send to Intruder | Ctrl+I |
| Forward intercepted | Ctrl+F |
| Toggle intercept | Ctrl+T |

## References
- PortSwigger Web Security Academy — portswigger.net/web-security
- Burp Suite documentation — portswigger.net/burp/documentation
