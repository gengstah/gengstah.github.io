---
title: "Burp Suite"
permalink: /wiki/tools/burpsuite/
layout: single
author_profile: true
tags:
  - pentest
  - tool
---

*The dominant web-app testing proxy. Repeater, Intruder, Scanner, BApp Store, Collaborator.*

**Status:** seed
**Related:** [Penetration Testing](/wiki/domains/penetration-testing/), [Reconnaissance](/wiki/techniques/recon/)

---

## What's in the box

| Tool | Use |
|------|-----|
| **Proxy** | Intercept and modify HTTP(S) between browser and server |
| **Repeater** | Replay and tweak a single request manually |
| **Intruder** | Automate request variations (fuzzing parameters, payload sets, attack types) |
| **Scanner** (Pro only) | Active and passive vulnerability scanning |
| **Collaborator** (Pro only) | Out-of-band server for SSRF, blind XXE, blind RCE detection |
| **Decoder / Comparer** | Quick encode/decode and diff |
| **Sequencer** | Statistical analysis of session-token randomness |
| **BApp Store** | Extension marketplace |

Pro is a $475/year license. Most serious web testing assumes Pro; Community edition is functional but rate-limited Intruder and no Scanner.

---

## Setup essentials

1. **Browser config.** Burp's built-in Chromium (`Proxy → Intercept → Open Browser`) bypasses cert hassles. For Firefox/Chrome, install the Burp CA cert.
2. **HTTP/2 + WebSockets.** Both on by default in modern Burp; verify in `Settings → Tools → Proxy`.
3. **Scope.** Set target scope (`Target → Scope`) early — every other tool respects it.
4. **Logging.** Enable proxy history retention; export sessions; back them up.

---

## A few patterns worth memorizing

**Auth bypass / IDOR sweep with Intruder**

- Capture a request that fetches a resource by ID.
- Intruder → Sniper attack on the ID parameter, payload set = ID range.
- Sort responses by length — the outliers are usually wins.

**Authorization matrix testing**

- Use *Autorize* or *AuthMatrix* extension. Capture requests as User A; replay as User B's session; flag where User B got the same response.

**Blind injection via Collaborator**

- Insert a Collaborator payload (`xxx.oastify.com`) into every parameter that might end up in a server-side fetch.
- Watch the Collaborator client for inbound DNS or HTTP. Hits = SSRF / blind XXE / blind SQLi / template injection / etc.

**Stored-XSS hunting**

- Tag every input field with a unique token (`burp-xss-{n}`). Crawl after submission. Find your tokens in unintended HTML contexts.

---

## Useful BApp extensions

- **Logger++** — searchable cross-tool request log.
- **Autorize / AuthMatrix** — authorization testing.
- **Turbo Intruder** — when stock Intruder is too slow (race-condition exploitation, very large wordlists).
- **JS Link Finder / JS Miner** — extract endpoints / secrets from JS files.
- **Param Miner** — discover hidden parameters.
- **Hackvertor** — encoding/decoding inside requests via tag syntax.
- **Active Scan++** — additional Scanner checks.
- **Software Vulnerability Scanner** — version-string-based CVE lookup.

---

## Workflow tips

- **Don't scan blindly.** Active Scanner is loud and rate-limited. Use it surgically on interesting endpoints, not on the whole site.
- **Prefer manual exploration first.** Walk the app like a real user. Burp's site map fills in. Then come back and attack.
- **Use Match-and-Replace rules** for things like adding a custom header on every request, swapping a session token mid-test, or stripping a CSP header for testing.
- **Project files** for long engagements; ad-hoc projects for one-off testing.

---

## OPSEC

Burp's traffic is recognizable: default `User-Agent` (Mozilla-like but not identical to a real browser), TLS fingerprint, header order. For environments that fingerprint clients (anti-bot, WAF), tune the upstream proxy / use Chromium-based Burp.

---

## References

- PortSwigger Web Security Academy — <https://portswigger.net/web-security>
- *The Web Application Hacker's Handbook* (2nd ed.) — Stuttard, Pinto
- HackTricks — *Pentesting Web* — <https://book.hacktricks.xyz/pentesting-web>
