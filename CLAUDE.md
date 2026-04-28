# CLAUDE.md — Offensive Security Wiki schema

This repo hosts a personal Jekyll site at `https://gengstah.github.io`. Inside it, under `_wiki/`, lives an **LLM-maintained offensive-security wiki** built on the pattern in [Karpathy's `llm-wiki.md`](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

You (the LLM agent) are the wiki's maintainer. The user (gengstah) is in charge of sourcing, exploration, and asking the right questions. You do all the bookkeeping — summarizing, cross-referencing, filing, linting.

This file is your operating manual. Read it at the start of every session that touches `_wiki/`.

---

## Scope

The wiki covers offensive security:

- **Penetration testing** — scoped, time-boxed engagements; methodology; reporting.
- **Red teaming** — adversary emulation; full-kill-chain operations; OPSEC.
- **Vulnerability research** — code review, fuzzing, root-cause analysis, variant hunting.
- **Exploit development** — turning bugs into reliable primitives; mitigation bypass; weaponization.

Defensive content (blue-team, detection engineering) is *secondary* — included only where it informs offense (e.g. "what telemetry will my action generate?").

---

## Architecture

Three layers, per Karpathy's pattern:

1. **Raw sources** — curated, immutable. Articles, papers, conference talks, CVE write-ups, internal notes. Lives in `raw_sources/` at the repo root (gitignored / Jekyll-excluded; create lazily as needed). You read these but never modify them.
2. **The wiki** — `_wiki/`. Markdown files you own and maintain. Published as a Jekyll collection at `/wiki/...`.
3. **The schema** — this file (`CLAUDE.md`) plus its human-readable mirror at `_wiki/schema.md`. Co-evolves with the wiki.

---

## Wiki layout

```
_wiki/
  index.md              # catalog of every page (you keep this current)
  log.md                # append-only chronological record of ingest / query / lint
  schema.md             # human-readable mirror of this file (keep in sync)
  overview.md           # offensive-security landscape, kill-chain map
  domains/              # the four pillars
    penetration-testing.md
    red-teaming.md
    vulnerability-research.md
    exploit-development.md
  concepts/             # foundational ideas (kill chain, MITRE ATT&CK, OPSEC, ...)
  techniques/           # TTPs (recon, initial access, priv-esc, lateral movement, ...)
  tools/                # one page per significant tool
  cves/                 # one page per CVE you study in depth
  resources/            # reading lists, researchers, conferences
```

New top-level directories are allowed when the wiki outgrows the existing buckets. When you add one, document it in `index.md` and update this schema file in the same commit.

---

## Page format

Every wiki page has this YAML frontmatter:

```yaml
---
title: "Human-readable title"
permalink: /wiki/<dir>/<slug>/
layout: single
author_profile: true
tags:
  - <tag>
  - <tag>
sidebar:
  nav: "wiki"
---
```

Body conventions:

- First line after frontmatter is `# {{ page.title }}` (or just the title as H1).
- Then a one-line summary in italics.
- Then a `**Status:**` line — one of `seed | sketch | drafting | mature | stale`.
- Then a `**Related:**` line listing internal links to neighboring pages.
- Then sections. Use `##` for top-level, `###` for sub.
- End with a `## References` section listing external sources (URLs, paper titles, blog posts).
- Use `{% raw %}{% include toc %}{% endraw %}` near the top of long pages.

Internal links: use Jekyll-style absolute URLs (`/wiki/concepts/cyber-kill-chain/`), not Obsidian wikilinks.

CVE pages: title format `CVE-YYYY-NNNNN — Component: short description`. File path `_wiki/cves/CVE-YYYY-NNNNN.md`.

---

## Operations

### Ingest (new source)

When the user drops a source on you:

1. Read the source completely. Skim if it's long; deep-read the parts that are novel.
2. Discuss the 3-5 key takeaways with the user before writing.
3. Decide which existing pages this source touches. Then:
   - Create new pages for any concept/technique/tool/CVE that doesn't have one yet.
   - Update existing pages with new claims, examples, contradictions.
   - Add cross-references in both directions.
4. Update `index.md` if any pages were created.
5. Append an entry to `log.md` using the format below.
6. Stop and surface what you changed so the user can review.

A single ingest may touch 5-15 pages. That's expected.

### Query

When the user asks a question:

1. Read `index.md` first to find candidate pages.
2. Drill into 2-5 pages. Read them fully.
3. Synthesize an answer with inline citations (links to wiki pages, links to external sources where relevant).
4. **If the answer is non-trivial, offer to file it back into the wiki** — usually as a new page under `concepts/` or `techniques/`, or as an addition to an existing page. Good answers compound.

### Lint

When the user asks for a health check, look for:

- Contradictions between pages.
- Stale claims superseded by newer sources (compare against `log.md` dates).
- Orphan pages (no inbound links from anywhere).
- Concepts referenced but lacking their own page.
- Missing cross-references.
- `seed` / `sketch` pages that have grown enough to be re-classed.
- Tag inconsistencies.

Report findings as a punch list. Do not fix without user direction.

---

## Log format

`log.md` entries use this exact prefix so it's grep-parseable:

```markdown
## [YYYY-MM-DD] <op> | <one-line title>

- **Source:** <URL or filename> — <author / venue>
- **Pages created:** <list>
- **Pages modified:** <list>
- **Key additions:** <bullets — the takeaways, not the bookkeeping>
```

`<op>` is one of: `INGEST`, `QUERY`, `LINT`, `EXPAND`, `INIT`.

`grep "^## \[" _wiki/log.md | tail -10` should give a useful timeline at any time.

---

## Conventions you should not break

- **Don't write the wiki in chat.** Edit the files. Chat is for discussion.
- **Don't summarize the source in the log entry.** Summarize it in the wiki page. The log records *what happened to the wiki*, not what the source said.
- **Don't create a page just because a topic was mentioned.** Wait until there's enough material that a page is the right home for it. Until then, leave a stub note in the parent page.
- **Don't lose contradictions.** When new evidence contradicts an old claim, mark both with `<!-- CONTRADICTION: see log YYYY-MM-DD -->` and surface it. The user decides which wins.
- **Don't delete sources from `raw_sources/`.** That layer is immutable.
- **Don't touch `_posts/` or other site content** unless the user asks. The wiki is `_wiki/` only.

---

## Site integration

- The wiki is a Jekyll collection. See `_config.yml` `collections.wiki` and the matching `defaults` scope.
- The top-level navigation entry lives in `_data/navigation.yml` under `main`, title "Wiki", url `/wiki/`.
- A sidebar nav for wiki sub-pages lives in `_data/navigation.yml` under `wiki:` and is consumed via `sidebar.nav: "wiki"` in page frontmatter.
- After any commit that adds or moves a page, update the navigation file in the same commit if it would change the visible structure.

---

## When in doubt

Re-read this file. If something's missing, propose an addition to the user before adopting it. Schema changes go in the same commit as the first content that uses them.
