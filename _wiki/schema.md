---
title: "Wiki Schema"
permalink: /wiki/schema/
layout: single
author_profile: true
sidebar:
  nav: "wiki"
---

*Conventions the LLM agent follows when maintaining this wiki. Human-readable mirror of the [`CLAUDE.md`](https://github.com/gengstah/gengstah.github.io/blob/master/CLAUDE.md) at the repo root — keep both in sync.*

**Status:** mature
**Related:** [Index](/wiki/), [Log](/wiki/log/), [Overview](/wiki/overview/)

{% include toc %}

---

## What this wiki is

A personal, LLM-maintained knowledge base for offensive security: penetration testing, red teaming, vulnerability research, and exploit development.

The pattern comes from [Karpathy's `llm-wiki.md`](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The high-level shape:

- **You curate sources** — clip articles, drop in CVE write-ups, save conference talk notes.
- **The LLM ingests them** — reads, integrates into the wiki, updates cross-references, appends to the log.
- **The wiki compounds** — every source you add makes the wiki richer; nothing is re-derived from scratch on each query.

---

## Architecture

Three layers:

1. **Raw sources** (`raw_sources/`, gitignored) — immutable. The LLM reads these but never modifies them.
2. **The wiki** (`_wiki/`) — markdown files the LLM owns and maintains. Published as `/wiki/...` on the site.
3. **The schema** (this page + `CLAUDE.md`) — operating manual the LLM follows. Co-evolves with the wiki.

---

## Layout

```
_wiki/
  index.md              catalog
  log.md                chronological record
  schema.md             this file
  overview.md           landscape map
  domains/              the four pillars
  concepts/             foundational ideas
  techniques/           TTPs
  tools/                significant tools
  cves/                 deep CVE write-ups
  resources/            reading lists, researchers
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
sidebar:
  nav: "wiki"
---
```

Body conventions:

1. H1 with the page title.
2. One-line italic summary.
3. `**Status:**` line — `seed | sketch | drafting | mature | stale`.
4. `**Related:**` line — internal links to neighboring pages.
5. Optional `{% raw %}{% include toc %}{% endraw %}` for long pages.
6. Sections (`##`, `###`).
7. `## References` section at the end.

Internal links are absolute Jekyll URLs (`/wiki/concepts/opsec/`), not Obsidian wikilinks.

---

## Operations

### Ingest

1. Read the source.
2. Discuss takeaways with the user.
3. Create new pages where needed; update existing ones; add cross-references both ways.
4. Update [`index.md`](/wiki/) if pages were added.
5. Append to [`log.md`](/wiki/log/).
6. Surface what changed.

### Query

1. Read [`index.md`](/wiki/) to find candidates.
2. Drill into 2-5 pages.
3. Synthesize an answer with citations.
4. Offer to file non-trivial answers back into the wiki.

### Lint

Look for: contradictions, stale claims, orphan pages, missing cross-references, concepts referenced without their own page, `seed`/`sketch` pages ready for re-classing, tag inconsistencies. Report as a punch list; don't fix without direction.

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

- **Don't write the wiki in chat** — edit the files.
- **Don't summarize the source in the log** — summarize it on the page; the log records what changed.
- **Don't create a page just because a topic was mentioned** — wait until there's enough material.
- **Don't lose contradictions** — flag them inline with `<!-- CONTRADICTION: ... -->` and surface to the user.
- **Don't delete from `raw_sources/`** — that layer is immutable.
- **Don't touch site code outside `_wiki/`** unless the user asks (with the exception of navigation updates that mirror new wiki structure).
