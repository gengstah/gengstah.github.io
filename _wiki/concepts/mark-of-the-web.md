---
title: "Mark-of-the-Web (MotW)"
permalink: /wiki/concepts/mark-of-the-web/
layout: single
author_profile: true
tags:
  - windows
  - phishing
  - initial-access
  - motw
  - outflank
---

*Windows' "this file came from the internet, treat it carefully" tag. NTFS Alternate Data Stream `Zone.Identifier`. Drives Office Protected View, Defender SmartScreen, "are you sure you want to run this?" dialogs — and the entire art-form of bypassing them.*

**Status:** drafting
**Related:** [HTML smuggling](/wiki/concepts/html-smuggling/), [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [LNK file attacks](/wiki/concepts/lnk-file-attacks/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What it is

When the Attachment Execution Service (AES) writes a file to disk that came from a non-local source — browser download, email attachment from Outlook, mounted ISO (since Win11 22H2) — Windows attaches an Alternate Data Stream named `Zone.Identifier` to the file. Contents:

```
[ZoneTransfer]
ZoneId=3
ReferrerUrl=https://lure.example/landing
HostUrl=https://lure.example/invoice.docm
```

Zone IDs:

| ZoneId | Zone | Effect |
|---|---|---|
| 0 | My Computer | No special handling. |
| 1 | Local Intranet | Light. |
| 2 | Trusted Sites | Light. |
| 3 | Internet | **The default for downloads.** Triggers MotW behaviour. |
| 4 | Restricted | Heaviest. |

Inspect with `Get-Item file.docm -Stream Zone.Identifier`. Strip with `Unblock-File` (PowerShell) — if user has rights and is willing to.

## What MotW does

Many Microsoft products read the Zone.Identifier ADS and change behaviour:

| Product / feature | Behaviour when MotW present |
|---|---|
| Office (Word, Excel, PowerPoint) | Open in **Protected View** — read-only sandbox. Macros disabled. User must click "Enable Editing" → "Enable Content". |
| Office (since 2022) | Macros from internet-zone files are **blocked outright** for unsigned VBA, with no in-product Enable button. The user has to right-click → Properties → Unblock. |
| Excel 4 macros (XLM) | Honour MotW. |
| .lnk | SmartScreen warns. |
| .ps1 | Default execution policy refuses to run. |
| Defender SmartScreen | Reputation check; warning dialog for low-reputation files. |
| AppLocker / WDAC | Some policies key on MotW for "internet" classification. |

The 2022 Office macro block was the single biggest red-team-impacting MotW change in years. It pushed initial-access tradecraft toward containers (ISO, IMG, VHD), then toward LNK-based chains, then toward HTML smuggling delivering MotW-stripped payloads.

## Bypasses (2018 → 2026)

### Container formats (pre-Win11 22H2)

ISO, IMG, VHD/VHDX, 7z (with archive flag), CAB. When mounted / extracted, files inside often **did not inherit** MotW from the outer container. Open-and-go:

- HTML smuggling → `lure.iso` → user double-clicks → ISO mounts → user opens `Invoice.docm` → no MotW → macros run.

This was the dominant chain 2018–2022. Microsoft progressively closed it:

- **Win11 22H2 (2022)** — ISO / IMG mounts propagate MotW.
- **Win10 21H2 + Win11 22H2** — `.7z` / `.zip` archives propagate MotW (with caveats — 7z handles MotW since v22.00; older builds did not).
- **Office 2022 update** — defence-in-depth: even MotW-clean macros prompt extra warnings.

### File formats that ignore MotW

A file format that doesn't honour Zone.Identifier doesn't care about MotW. Historically:

- **`.lnk`** — only SmartScreen warns; the action runs once dismissed.
- **`.iso`** in legacy modes — the ISO itself is MotW'd, contents weren't.
- **`.chm`** (compiled HTML help) — runs scripts; MotW handling thin.
- **`.msi`** — installer prompts UAC, but a signed installer skirts SmartScreen.
- **`.appx` / `.msix`** — sideloaded packages with crafted manifests.
- **`.iso`-equivalent in browsers' "save as"** — depending on browser version, sometimes saved without MotW.

### Stripping the ADS

If the user has command-line access:

```cmd
echo. > file.docm:Zone.Identifier   :: clobber the ADS
del file.docm:Zone.Identifier       :: delete it (some Windows builds)
```

PowerShell `Unblock-File`. Tools like `streams.exe` (Sysinternals) enumerate / clear ADS.

### Misclassification of source zone

Files written by a process whose creator wasn't AES (e.g. a service running as SYSTEM, or a custom downloader using `WinINet` without `INTERNET_FLAG_PROPAGATE_MARK_OF_THE_WEB`) historically did not get MotW at all. Some browsers (third-party, embedded, Electron-app) didn't propagate either.

### Container-format misclassification

Win11 22H2 propagates MotW for known archive formats. Lesser-used formats — `.tar`, `.gz`, `.xz`, `.rar` (older), `.cab`, custom — still sometimes do not. `.html` saved as a `.svg` and renamed has been observed.

## Outflank's contributions

Two posts that shaped the operator-side framing:

- *Mark-of-the-Web from a Red Team's Perspective* (Stan Hegt, 2020-03-30) — early canonical writeup of the bypass landscape.
- *So you think you can block Macros?* (Pieter Ceelen, 2023-04-25) — covers the post-2022 MotW-block-macros era and what survives.

## Detection

- Audit ADS read/write events around macro-enabled formats.
- Defender ASR rules (`Block Office applications from creating child processes`) backstop the macro path even when MotW fails.
- Group Policy: enforce MotW on ISO mounts (default in Win11 22H2+); block ISO/IMG mounting for non-admin users.

## See also

- [HTML smuggling](/wiki/concepts/html-smuggling/) — the main delivery layer that has to beat MotW.
- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — the most-affected execution path.
- [LNK file attacks](/wiki/concepts/lnk-file-attacks/).

## References

- Microsoft — *Macros from the internet will be blocked by default* — <https://learn.microsoft.com/en-us/deployoffice/security/internet-macros-blocked>
- Outflank — *Mark-of-the-Web from a Red Team's Perspective* (2020-03-30) — <https://www.outflank.nl/blog/2020/03/30/mark-of-the-web-from-a-red-teams-perspective/>
- Outflank — *So you think you can block Macros?* (2023-04-25) — <https://www.outflank.nl/blog/2023/04/25/so-you-think-you-can-block-macros/>
