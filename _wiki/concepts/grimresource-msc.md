---
title: "GrimResource — MSC File Format Abuse"
permalink: /wiki/concepts/grimresource-msc/
layout: single
author_profile: true
tags:
  - phishing
  - initial-access
  - msc
  - mmc
  - grimresource
  - outflank
---

*Initial-access via the `.msc` (Microsoft Saved Console) format. A `.msc` is XML; one of its element types lets it embed XSS-equivalent JavaScript through the legacy `apds.dll` redirect, executing code in `mmc.exe` outside of macro / Office controls. Outflank's August 2024 follow-up disambiguates two earlier disclosures and cleans up the canonical exploitation path.*

**Status:** drafting
**Related:** [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What MSC files are

Microsoft Saved Console files. Used by the Management Console (`mmc.exe`) to persist a configured set of MMC snap-ins — Computer Management, Group Policy Editor, etc. The format is XML; key elements include `<File>`, `<NodeType>`, `<StringTables>`, and importantly `<XMLNotepad>` for embedded scripting.

A user double-clicking a `.msc` opens MMC, which loads the XML and instantiates whatever it describes.

## The exploitation path

GrimResource (originally disclosed in mid-2024) uses an XSS-style flaw in MMC's handling of `<StringTable>` content via legacy `apds.dll`. The minimal flow:

1. `.msc` XML contains a `<StringTable>` whose content includes `<![CDATA[ … apds.dll redirect with a `data:` URL … ]]>`.
2. MMC, evaluating the table, hands the URL to `mshtml.dll` for rendering.
3. The `data:` URL contains JavaScript.
4. The JavaScript runs in an MMC-hosted IE-equivalent context with full ActiveX privileges — including `WScript.Shell.Run`, `ShellExecute`, ADO file writes, etc.

Net: `.msc` → `mmc.exe` → JavaScript → arbitrary OS commands. No macros, no Office, no PowerShell signing policy.

## Why it slipped past defenders

- **Not on the macro / VBA / XLM detection radar.** ASR rules for "block Office app from creating child processes" don't apply — `mmc.exe` is the parent, not Word.
- **MMC is signed Microsoft binary, on every Windows host.** No suspicious binary download.
- **MotW handling on `.msc` is weaker than on `.docm`.** Pre-mitigation, double-click execution was uncomfortably automatic.
- **Two separate disclosures conflated** the technique — Outflank's *Will the real #GrimResource please stand up?* (2024-08-13) cleans up the attribution and disambiguates the actual primitive from look-alikes.

## Microsoft's response

Microsoft patched the XSS path in 2024 cumulative updates. The remaining surface (and the reason the post matters in 2026) is:

- Unpatched / lagged hosts.
- Variant attempts on related XML-based MMC configurations.
- The general shape — "an apparently-benign XML format the OS handles via `mshtml`" — is recurring tradecraft.

## Detection

- `mmc.exe` spawning `cmd.exe`, `powershell.exe`, `cscript.exe`, `wscript.exe`, `mshta.exe`, etc. is high-signal.
- Sysmon Event 7 (Image loaded) — `mmc.exe` loading `mshtml.dll` is normal historically; loading it *and then* spawning a shell is not.
- ASR rule `Block Win32 API calls from Office macros` doesn't help; consider expanding ASR to MMC parent.

## Operator notes (post-2024 patch)

- Treat as legacy. New initial-access chains lean on LNK / HTML smuggling / VSTO instead.
- Useful in environments with patch-lag (industrial, healthcare, embedded).
- Combine with [HTML smuggling](/wiki/concepts/html-smuggling/) so the `.msc` is born local-zone.

## See also

- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — the macro-equivalent surfaces.
- [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) — file-zone handling.
- [HTML smuggling](/wiki/concepts/html-smuggling/) — paired delivery.

## References

- Outflank — Cedric Van Bockhaven — *Will the real #GrimResource please stand up? – Abusing the MSC file format* (2024-08-13) — <https://www.outflank.nl/blog/2024/08/13/will-the-real-grimresource-please-stand-up-abusing-the-msc-file-format/>
- Microsoft — *Microsoft Management Console* documentation.
