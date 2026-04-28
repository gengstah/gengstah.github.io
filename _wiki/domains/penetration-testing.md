---
title: "Penetration Testing"
permalink: /wiki/domains/penetration-testing/
layout: single
author_profile: true
tags:
  - pentest
  - methodology
---

*Scoped, time-boxed assessments that find and demonstrate exploitable weaknesses against a defined target.*

**Status:** seed
**Related:** [Red Teaming](/wiki/domains/red-teaming/), [Reconnaissance](/wiki/techniques/recon/), [Initial Access](/wiki/techniques/initial-access/), [Privilege Escalation](/wiki/techniques/privilege-escalation/), [Burp Suite](/wiki/tools/burpsuite/), [nmap](/wiki/tools/nmap/)

{% include toc %}

---

## What it is

A penetration test is a goal-oriented security assessment performed against a defined scope (a network range, a web application, a binary, a cloud account) under explicit authorization. The deliverable is a report: what was found, how it was exploited, what the impact is, what to fix.

It is **not** the same as red teaming. Pentests are usually announced, broad in coverage, and graded on completeness. Red teams are stealthy, narrow in objective, and graded on whether they achieve them. See [Red Teaming](/wiki/domains/red-teaming/) for the contrast.

---

## Engagement types

| Type | Target | Typical artifacts |
|------|--------|-------------------|
| External network | Internet-facing infrastructure | Service inventory, exposed admin panels, exploitable services |
| Internal network | LAN / AD environment | Lateral movement paths, privilege escalation, domain compromise |
| Web application | A specific app / API | OWASP-class bugs, business-logic flaws, auth bypasses |
| Mobile | iOS / Android app | Insecure storage, transport, IPC, hardcoded secrets |
| Cloud | AWS / Azure / GCP account | IAM misconfig, exposed buckets, lateral cross-account |
| Wireless | WiFi, BLE | Rogue APs, weak crypto, client attacks |
| Physical | Buildings, hardware | Tailgating, badge cloning, port access |

---

## Methodology

Most pentest methodologies map roughly to:

1. **Pre-engagement** — scope, rules of engagement, escalation contacts, evidence handling.
2. **[Reconnaissance](/wiki/techniques/recon/)** — passive OSINT, then active enumeration.
3. **Vulnerability identification** — automated scans + manual analysis.
4. **Exploitation** — proving the vulnerability is real.
5. **[Post-exploitation](/wiki/techniques/privilege-escalation/)** — privilege escalation, lateral movement, data access.
6. **Reporting** — executive summary, technical detail, reproducible evidence, remediation guidance.
7. **Re-test** — verify fixes.

Reference standards: [PTES](http://www.pentest-standard.org/), [OSSTMM](https://www.isecom.org/OSSTMM.3.pdf), [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) (web), [NIST SP 800-115](https://csrc.nist.gov/publications/detail/sp/800-115/final).

---

## What separates a good pentester

- **Coverage discipline** — methodology checklists keep you from missing the obvious.
- **Manual depth** — Burp scanners and `nuclei` find easy bugs; auth/auth flaws and business-logic bugs need a human.
- **Reporting** — a great finding poorly written is a wasted finding. Write for both the engineer who fixes it and the executive who funds it.
- **Restraint** — knowing what *not* to do (DoS, destructive payloads, exfil of real PII) matters as much as knowing what to do.

---

## Reporting

A pentest report's center of gravity is the finding. Each finding typically has:

- **Title** — concise, descriptive.
- **Severity** — CVSS or organization-defined; pair with business impact.
- **Affected asset** — URL, host, function, line number.
- **Description** — what the bug is, in plain language.
- **Evidence** — request/response, screenshots, decoded payloads.
- **Reproduction** — exact steps an engineer can follow.
- **Impact** — what an attacker can do. Be specific.
- **Remediation** — concrete fix, not "implement input validation."
- **References** — CWE, OWASP, vendor docs.

---

## Common starting toolkit

- **[nmap](/wiki/tools/nmap/)** — host/service discovery.
- **[Burp Suite](/wiki/tools/burpsuite/)** — web proxy, repeater, intruder.
- **`ffuf` / `gobuster`** — content discovery.
- **`nuclei`** — template-driven vuln scanner.
- **`crackmapexec` / `nxc` (NetExec)** — Windows / AD enumeration.
- **`responder`** — LLMNR/NBT-NS poisoning for credential capture.
- **`impacket`** — Python implementations of MSRPC, SMB, Kerberos primitives.
- **`metasploit`** — exploit framework, post-ex modules.

---

## References

- PTES — <http://www.pentest-standard.org/>
- OWASP Web Security Testing Guide — <https://owasp.org/www-project-web-security-testing-guide/>
- NIST SP 800-115 — *Technical Guide to Information Security Testing and Assessment*
