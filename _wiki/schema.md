---
title: "Wiki Schema"
permalink: /wiki/schema/
layout: single
author_profile: true
---

*The conventions I follow when adding to and maintaining this wiki — page layout, ingest workflow, log format, hard rules.*

**Status:** mature
**Related:** [Index](/wiki/), [Log](/wiki/log/), [Overview](/wiki/overview/)

{% include toc %}

---

## What this wiki is

A personal knowledge base for offensive security: penetration testing, red teaming, vulnerability research, and exploit development. The high-level shape:

- **I curate sources** — clip articles, drop in CVE write-ups, save conference talk notes.
- **I distill them into pages** — extract key claims, integrate into existing pages, update cross-references, append to the log.
- **The wiki compounds** — every source extends the existing structure; nothing is re-derived from scratch on each query.

---

## Architecture

Three layers:

1. **Raw sources** (`raw_sources/`, gitignored) — immutable. Read but never modify.
2. **The wiki** (`_wiki/`) — distilled markdown files. Published as `/wiki/...` on the site.
3. **The schema** (this page) — operating manual. Co-evolves with the wiki.

---

## Layout

```
_wiki/
  index.md              landing
  overview.md           landscape map
  schema.md             this file
  log.md                chronological record
  domains/              the four pillars
  concepts/             foundational ideas + topic concepts
  techniques/           TTPs across operations and exploit dev
  tools/                frameworks, debuggers, scanners, C2
  playbooks/            engagement runbooks
  cves/                 CVE deep-dives
  kernel/               Windows kernel-mode exploitation
  usermode/             Windows user-mode exploitation
  attacks/              Wi-Fi protocol attacks
  defenses/             Wi-Fi defenses
  devices/              vendor / device test results
  resources/            reading lists, researchers, templates
  sources/              provenance pages, namespaced by origin
```

---

## Page format

Every page starts with this frontmatter:

```yaml
---
title: "Human-readable title"
permalink: /wiki/<dir>/<slug>/
layout: single
author_profile: true
tags:
  - <tag>
---
```

Body conventions:

1. One-line italic summary.
2. `**Status:**` line — `seed | sketch | drafting | mature | stale`.
3. `**Related:**` line — internal links to neighboring pages.
4. Optional `{% raw %}{% include toc %}{% endraw %}` for long pages.
5. Sections (`##`, `###`).
6. `## References` section at the end.

No body H1 — Jekyll renders the page title from frontmatter; a body H1 produces a duplicate header. Internal links are absolute Jekyll URLs (`/wiki/concepts/opsec/`), not Obsidian wikilinks.

---

## Operations

### Ingest

1. Read the source.
2. Identify the 3-5 key takeaways.
3. Create new pages where needed; update existing ones; add cross-references both ways.
4. Update relevant category indexes.
5. Append to [`log.md`](/wiki/log/).

### Query

1. Browse [`index.md`](/wiki/) or the relevant category index.
2. Drill into 2-5 pages.
3. If the answer is non-trivial, file it back into the wiki as a new page or extend an existing one.

### Lint

Periodic health check. Look for: contradictions, stale claims, orphan pages, missing cross-references, concepts referenced without their own page, `seed`/`sketch` pages ready for re-classing, tag inconsistencies. Triage as a punch list.

---

## Log entry format

```markdown
## [YYYY-MM-DD] <op> | <one-line title>

- **Source:** <URL or filename> — <author / venue>
- **Pages created:** <list>
- **Pages modified:** <list>
- **Key additions:** <bullets>
```

`<op>` ∈ `INGEST | QUERY | LINT | EXPAND | INIT`. The `## [YYYY-MM-DD]` prefix is grep-parseable.

---

## Hard rules

- **Edit the files, not chat.** Discussion stays in chat; durable additions go on the pages.
- **Don't summarize the source in the log** — summarize it on the page; the log records *what changed*.
- **Don't create a page just because a topic was mentioned** — wait until there's enough material.
- **Don't lose contradictions** — flag them inline with `<!-- CONTRADICTION: ... -->` and surface for review.
- **Don't delete from `raw_sources/`** — that layer is immutable.
- **Don't touch site code outside `_wiki/`** unless explicitly intended (navigation updates that mirror new wiki structure are the exception).
