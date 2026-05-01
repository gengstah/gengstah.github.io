---
title: "VSTO-Signed Phishing"
permalink: /wiki/concepts/vsto-phishing/
layout: single
author_profile: true
tags:
  - phishing
  - initial-access
  - office
  - vsto
  - outflank
---

*Phishing payloads delivered as Visual Studio Tools for Office (VSTO) add-ins, signed by a trusted publisher (sometimes Microsoft itself). Sidesteps Office macro blocking entirely — VSTO is not VBA, not XLM, not SYLK; it's a separate code-loading path with its own (and weaker) controls.*

**Status:** drafting
**Related:** [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/), [Phishing](/wiki/concepts/phishing/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What VSTO is

Visual Studio Tools for Office. A .NET-based add-in framework for Office. A document-level VSTO solution attaches an external assembly (`.dll`) to a `.docx` / `.xlsx` via OOXML metadata. When the user opens the document, Office sees the manifest, downloads / loads the assembly, and runs it inside the Office process — outside the VBA project.

The deployment manifest specifies:

- A trusted location URL where the add-in lives (HTTP, HTTPS, UNC, or local path).
- The add-in's display name and publisher.
- Update / version metadata.

VSTO add-ins can also be deployed at the *application* level (registering an Office add-in for all documents). The phishing variant is *document* level — bound to a specific file.

## Why operators care

- **VBA macro block doesn't apply.** Microsoft's 2022 internet-zoned VBA block keys on macros, not VSTO. A VSTO-bound `.docx` (no VBA project, just an OOXML pointer to an external assembly) opens normally.
- **The user clicks "Install" in a low-friction dialog.** The dialog says "Microsoft Office Customization Installer — Are you sure you want to install this customization?" and shows the publisher name and a link.
- **Microsoft-signed add-ins skip / soften the warning.** A VSTO whose manifest is signed by a Microsoft-issued certificate (acquired via various means in research / by edge-case trust paths) presents minimal user friction.

## How operators deploy

Outflank's two-part series (2021-12-09 and 2022-01-07) walks the canonical operator chain:

1. Build a VSTO add-in. Code-side it does what an offensive payload normally does — staging a Cobalt Strike beacon, dropping a second-stage, etc.
2. Sign it. Options:
   - Self-signed cert + social-engineer the user to trust it (least ideal, full prompt).
   - Stolen / leased commercial code-signing cert (better).
   - Pseudo-Microsoft signing path (the headline in the Outflank posts) — abusing the Microsoft ClickOnce / VSTO trust hierarchy in ways that present a "Microsoft Corporation" publisher to the user.
3. Host the deployment manifest somewhere the victim can reach (HTTP/HTTPS server, UNC).
4. Bind the document to that manifest. The result is a `.docx` that, when opened, prompts a small dialog and (if accepted) loads the .NET add-in.
5. Phish the document.

## Detection

- VSTO load events: Office processes loading `clr.dll`, then loading an assembly from a non-standard path. Log file-write to the `%LocalAppData%\Apps\2.0\…` ClickOnce cache.
- Outbound HTTP / HTTPS to non-corporate hosts from `WINWORD.EXE` / `EXCEL.EXE` for `.vsto`, `.dll.deploy`, `.application` files.
- ASR rules around Office child processes still cover the post-loaded payload's child-process behaviour.
- Defender blocks unsigned VSTO from internet zones if MotW is present and policy is configured (the policy was strengthened post-2022 alongside the macro block).

## Mitigations

- **GPO**: `Disable VBA for Office applications` doesn't help (VSTO isn't VBA).
- **GPO**: `Office add-ins > Disallow custom add-ins` + a curated allow-list of approved VSTOs.
- **Conditional Access / Intune** application-control policies that block unsigned-by-corporate-CA VSTOs.
- **Network**: block outbound `clickonce.com` / external VSTO manifest hosts.

## See also

- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — the alternative paths.
- [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) — VSTO's MotW story is more permissive than VBA's.
- [Phishing](/wiki/concepts/phishing/), [HTML smuggling](/wiki/concepts/html-smuggling/) — common delivery layers.

## References

- Outflank — Dima van de Wouw — *A phishing document signed by Microsoft – part 1* (2021-12-09) — <https://www.outflank.nl/blog/2021/12/09/a-phishing-document-signed-by-microsoft/>
- Outflank — *A phishing document signed by Microsoft – part 2* (2022-01-07) — <https://www.outflank.nl/blog/2022/01/07/a-phishing-document-signed-by-microsoft-part-2/>
- Microsoft — *Visual Studio Tools for Office* documentation.
