---
title: Linux Process Injection via Seccomp Notify
permalink: /wiki/offsec-notes/sources/linux-process-injection-via-seccomp-notify/
layout: single
author_profile: true
tags:
- offsec-notes
- source
source_filename: Linux Process Injection via Seccomp Notify.md
status: integrated
---

# Linux Process Injection via Seccomp Notify

> **Source provenance.** Raw material catalogued for the wiki ingest pipeline. Lives offline at `raw_sources/offensive-security/ingested/Linux Process Injection via Seccomp Notify.md`.

**Status:** `integrated`

## Excerpt

> This post demonstrates the use of seccomp user notifications to inject a shared library into a Linux process. I haven’t seen this combination documented as a process injection technique before, and it has some benefits over alternatives. **In summary, seccomp user notifications enable user-space injection from parent to child without any `LD_*` environment variables or privileged capabilities, reg…

