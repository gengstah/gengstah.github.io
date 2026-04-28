---
title: "Offensive Security Notes \u2014 Schema"
permalink: /wiki/offsec-notes/schema/
layout: single
author_profile: true
tags:
- offsec-notes
---

This file defines the structure, conventions, and operating procedures for this wiki.
Claude reads this on every interaction to know how to behave.

---

## Purpose

This is a persistent, compounding knowledge base for offensive security. It covers:
- Vulnerability assessments
- Penetration testing (network, web, mobile, cloud, AD, etc.)
- Red teaming
- Purple teaming
- Exploit development
- Post-exploitation and C2
- OSINT and reconnaissance
- Social engineering
- Malware analysis (for defensive context)
- Tools, TTPs, and tradecraft

---

## Directory Layout

```
offensive-security/
├── schema.md          ← this file; operating instructions
├── index.md           ← categorized catalog of all pages
├── log.md             ← append-only changelog (newest first)
├── sources/           ← raw ingested material (notes, URLs, pastes)
├── concepts/          ← technique and concept pages (one topic per file)
├── entities/          ← tools, CVEs, threat actors, frameworks
├── engagements/       ← per-engagement notes, scopes, findings
└── playbooks/         ← step-by-step attack/test playbooks
```

---

## Page Types

### Concept Page (`concepts/`)
One page per technique, attack class, or knowledge domain.

```markdown
# <Topic Name>

**Category:** <e.g., Web / Network / AD / Cloud / RE>
**MITRE ATT&CK:** <Tactic — Technique ID if applicable>
**Related:** Other Page, Another Page

## Overview
2–4 sentence summary of what this is.

## How It Works
Technical explanation.

## Attack Methodology
Step-by-step attacker perspective.

## Detection & Evasion Notes
What defenders look for; how attackers avoid it.

## Tools
- ToolName — purpose, key flags

## References
- Source title (date) — one-line annotation
```

### Entity Page (`entities/`)
One page per tool, CVE, threat actor, or named framework.

```markdown
# <Entity Name>

**Type:** Tool | CVE | Threat Actor | Framework
**Also known as:** <aliases>
**Related:** Concept Page, Other Entity

## Description
What it is.

## Usage / Details
How it's used offensively (and defensively where relevant).

## Notable Versions / Variants

## References
```

### Playbook Page (`playbooks/`)
Ordered, actionable procedure for a specific test or attack chain.

```markdown
# Playbook: <Name>

**Scope:** <what environment / target type this applies to>
**Prerequisites:** <access level, tools needed>
**MITRE Coverage:** <list of technique IDs>

## Objective

## Steps
1. ...
2. ...

## Cleanup / Deconfliction

## Notes & Gotchas
```

### Engagement Page (`engagements/`)
Per-engagement context. Keep scoping details, findings summaries, and timelines here.

---

## Special Files

### `index.md`
Categorized table of contents linking every page in the wiki.
Updated every time a page is added or significantly changed.

Format:
```
## <Category>
- Filename — one-line description
```

### `log.md`
Append-only. Newest entries at the top.

Format:
```
## YYYY-MM-DD — <brief title>
<what was added/changed/queried and why>
```

---

## Operating Procedures

### Ingest
When the user pastes or links a source:
1. Read and discuss key findings.
2. Create or update 1–N concept/entity pages.
3. Save raw source to `sources/` with a descriptive filename.
4. Append a log entry.
5. Update `index.md`.

### Query
When the user asks a question:
1. Identify relevant wiki pages.
2. Read them.
3. Synthesize an answer citing page names.
4. If the answer surfaces genuinely new knowledge not yet in the wiki, offer to create/update a page.

### Lint
Periodic health check (run on request or when wiki grows large):
- Flag contradictions between pages.
- Identify orphaned pages (not linked from index or any other page).
- Find stale entries (references > 2 years old with no newer corroboration).
- Suggest missing cross-references.

---

## Conventions

- Filenames: `kebab-case.md`
- Internal links: `Filename Without Extension`
- MITRE references: use ATT&CK IDs (e.g., T1059.001)
- CVE references: always include CVE-YYYY-NNNNN format
- Tool names: use canonical upstream name (e.g., "Impacket", not "impacket")
- Severity ratings: use CVSS v3 where applicable
- Dates: ISO 8601 (YYYY-MM-DD)
