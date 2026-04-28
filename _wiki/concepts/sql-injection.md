---
title: SQL Injection
permalink: /wiki/concepts/sql-injection/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/sql-injection/
---

**Category:** Web
**MITRE ATT&CK:** Initial Access / Execution — T1190 (Exploit Public-Facing Application)
**Related:** [Web Application Testing](/wiki/concepts/web-application-testing/), [Xss](/wiki/concepts/xss/), [Privilege Escalation Linux](/wiki/concepts/privilege-escalation-linux/)

## Overview
SQL Injection (SQLi) occurs when attacker-controlled input is incorporated into SQL queries without proper sanitization or parameterization. It is consistently ranked in the OWASP Top 10 and can result in data exfiltration, authentication bypass, and in some cases OS-level code execution.

## How It Works

### Types
- **In-band (Classic):** Results returned in HTTP response. Subtypes:
  - **Error-based:** DB errors leak schema/data.
  - **Union-based:** `UNION SELECT` appends attacker-controlled rows.
- **Blind:** No visible output; infer data via behavior.
  - **Boolean-based:** Different response for true vs. false conditions.
  - **Time-based:** `SLEEP()` / `WAITFOR DELAY` to infer truth.
- **Out-of-band:** Data exfiltrated via DNS/HTTP requests (`xp_dirtree`, `load_file` to attacker server).

### Common DB-Specific Tricks

| DB | Version Query | Sleep | File Read |
|----|---------------|-------|-----------|
| MySQL | `SELECT @@version` | `SLEEP(5)` | `LOAD_FILE('/etc/passwd')` |
| MSSQL | `SELECT @@version` | `WAITFOR DELAY '0:0:5'` | `OPENROWSET` |
| PostgreSQL | `SELECT version()` | `pg_sleep(5)` | `COPY TO/FROM` |
| Oracle | `SELECT banner FROM v$version` | `dbms_pipe.receive_message` | UTL_FILE |
| SQLite | `SELECT sqlite_version()` | n/a | n/a |

### Privilege Escalation via SQLi
- MySQL `FILE` privilege → `INTO OUTFILE` webshell
- MSSQL `xp_cmdshell` (may need enabling) → OS command execution
- PostgreSQL `COPY FROM PROGRAM` → OS command execution

## Attack Methodology
1. Identify injection points: GET/POST params, cookies, headers (User-Agent, Referer, X-Forwarded-For), JSON/XML bodies.
2. Probe with `'`, `"`, `\`, `)` — look for errors or behavioral changes.
3. Determine injection type (in-band vs. blind).
4. Map DB: version, current user, current DB, list of tables.
5. Extract target data (credentials, PII, sensitive tables).
6. Escalate if DB user has elevated privileges (FILE, xp_cmdshell).

## Detection & Evasion Notes
- WAFs block common keywords (`UNION`, `SELECT`, `--`).
- Evasion: comment variants (`/*!UNION*/`), case mixing (`SeLeCt`), URL/double encoding, whitespace alternatives (`%09`, `%0a`, `/**/`), HTTP parameter pollution.
- Blind SQLi is harder to detect; time-based leaves timing artifacts in logs.
- Parameterized queries / prepared statements are the complete defense.

## Tools
- `sqlmap` — full-featured automated SQLi exploitation (`--level`, `--risk`, `--tamper`)
- `ghauri` — modern sqlmap alternative with better WAF evasion
- Burp Suite Repeater / Intruder — manual testing
- `SQLMate` — quick fingerprinting

## References
- OWASP SQL Injection — owasp.org
- PortSwigger SQL Injection Labs
- PayloadsAllTheThings SQLi cheatsheet
