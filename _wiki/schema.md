---
title: "Wiki Schema"
permalink: /wiki/schema/
layout: single
author_profile: true
---

*How I structure and maintain this wiki — page layout, the workflow I follow when adding new material, log format, conventions.*

**Status:** mature
**Related:** [Index](/wiki/), [Log](/wiki/log/), [Overview](/wiki/overview/)

{% include toc %}

---

## What this wiki is

A personal knowledge base for offensive security: penetration testing, red teaming, vulnerability research, and exploit development. The shape:

- **I read papers, conference talks, blog posts, and CVE write-ups.** When something is worth keeping, I take notes.
- **I distill those notes into pages** — pulling out the structural claims, working examples, and references that I want to come back to. New material extends existing pages where I already have coverage; I only create a new page when there's enough material to warrant one.
- **The wiki compounds.** Every page cross-references the others. A new entry usually means edits across several pages, not just one.

This isn't a comprehensive textbook — it's the parts of the field I've worked through, in the form most useful to me.

---

## Layout

```
_wiki/
  index.md              landing
  overview.md           landscape map
  schema.md             this file
  log.md                chronological record of additions
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
  sources/              provenance pages — one per source I've worked through
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
3. `**Related:**` line — internal links to neighbouring pages.
4. Optional `{% raw %}{% include toc %}{% endraw %}` for long pages.
5. Sections (`##`, `###`).
6. `## References` section at the end.

No body H1 — Jekyll renders the page title from frontmatter; a body H1 produces a duplicate header. Internal links are absolute Jekyll URLs (`/wiki/concepts/opsec/`), not Obsidian wikilinks.

---

## Workflow

### Adding a new source

1. Read it. Skim once for shape, then re-read the sections I want to keep.
2. Decide what's structural (the claims I want available six months from now) vs. what's incidental.
3. Edit the relevant pages. Most ingests touch several — a new CVE write-up usually means edits to the CVE page, the kernel-internals page for the affected component, and the technique page for the bug class.
4. Add or update cross-references in both directions.
5. Add a provenance entry under `sources/` and append a line to [`log.md`](/wiki/log/).

### Looking something up

1. Browse [`index.md`](/wiki/) or the relevant category index.
2. Follow cross-references between pages.
3. If I notice a gap while looking — a missing concept, a stale claim, a contradiction — fix it then, before I forget.

### Periodic clean-up

A health pass every once in a while: contradictions, stale claims that newer sources have superseded, orphan pages with no inbound links, concepts referenced but lacking their own page, missing cross-references, `seed` / `sketch` pages ready for re-classing, tag inconsistencies.

---

## Log entry format

```markdown
## [YYYY-MM-DD] <op> | <one-line title>

- **Source:** <URL or citation> — <author / venue>
- **Pages created:** <list>
- **Pages modified:** <list>
- **Key additions:** <bullets — what's new on the pages, not what the source said>
```

`<op>` ∈ `INGEST | QUERY | LINT | EXPAND | INIT`. The `## [YYYY-MM-DD]` prefix is grep-parseable.

---

## Conventions

- **Edits live on the pages, not in commit messages or notes elsewhere.** If it's worth remembering, it's worth filing.
- **Don't summarise the source in the log** — summarise it on the page; the log records *what changed*.
- **Don't create a page just because a topic was mentioned** — wait until there's enough material.
- **Don't lose contradictions** — flag them inline with `<!-- CONTRADICTION: ... -->` and resolve them on a later pass.
- **Don't touch site code outside `_wiki/`** unless explicitly intended (navigation updates that mirror new wiki structure are the exception).
