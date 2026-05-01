---
title: "Evil Clippy"
permalink: /wiki/tools/evil-clippy/
layout: single
author_profile: true
tags:
  - tool
  - office
  - vba
  - maldoc
  - evil-clippy
  - outflank
---

*MS Office maldoc creation and obfuscation tool. Stomps VBA p-code so analysts mis-decompile, hides modules from the Office VBA editor, and produces phishing-ready `.docm` / `.xlsm` files. Stan Hegt / Outflank, 2019.*

**Status:** drafting
**Related:** [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [AMSI bypass](/wiki/techniques/amsi-bypass/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What it does

Evil Clippy operates on the Compound File Binary (CFB) container that wraps `.doc` / `.xls` / `.docm` / `.xlsm`. The relevant streams:

- `\_VBA_PROJECT\_VBA_PROJECT_CUR/<module>` — VBA source code (compressed).
- `\_VBA_PROJECT\_VBA_PROJECT_CUR/<module>/_VBA_PROJECT/_VBA_PROJECT_CUR/PerformanceCache` — compiled p-code.
- `\_VBA_PROJECT\_VBA_PROJECT_CUR/dir` — module directory.

Office prefers **p-code** when it matches the host's Office version. If p-code is present and matches, the source is *not* re-compiled — Office runs p-code directly. That's the trick Evil Clippy exploits.

## Capabilities

### VBA stomping

Replace the source code with a benign decoy *while leaving the malicious p-code intact*. Office runs the malicious p-code; analysts opening the document see the benign source. Static analysis tools (`olevba`, `oledump`) decompile from source, missing the actual behaviour.

```
$ EvilClippy -s decoy.vba malicious.docm
   # 'malicious.docm' now has decoy source, original p-code
```

The catch: p-code is version-specific. A `.docm` p-code-stomped against Office 2016 won't run cleanly on Office 2019 — the host re-compiles from source, which is now the decoy. Operator workarounds: produce per-Office-version variants, or carry a tiny p-code self-extractor that re-stamps the project at runtime.

### Hide modules from the VBA editor

Set the module's `Hidden` flag in the directory stream. The VBA editor doesn't show the module unless explicitly toggled. Doesn't affect execution.

### Set "VBA Project Locked / Not Visible"

Office's "View Code" greys out. Combined with module hiding, an analyst opening the document in Office sees nothing.

### Set strange / unicode module names

Module names like `‮` (right-to-left override) cause display weirdness in the VBA editor.

### Output ready-to-phish `.docm`

The full chain: take a clean macro template, inject the malicious VBA, stomp it, hide it, lock the project, save out.

## Why it still matters in 2026

- VBA stomping survived the 2022 macro block — once the user clicks "Enable Content" (e.g. on a from-trusted-location file, or post-MotW-strip), the p-code runs.
- Even Office's macro-block changes don't catch p-code-only files; some products (especially older or legacy enterprise) still execute happily.
- AV signatures keyed on VBA source text miss stomped files entirely.

## Limitations

- **olevba** added p-code-aware analysis years ago. Modern analysts walk the p-code, not just the source.
- **AMSI for VBA** scans the p-code at execution time (Office 2019+). VBA stomping doesn't help if the p-code itself has signature hits; the operator still needs an [AMSI bypass](/wiki/techniques/amsi-bypass/).
- **Defender for Office 365 / Office Cloud Policy** can flag stomping by detecting source/p-code mismatch.

## Tooling notes

- Open-source: <https://github.com/outflanknl/EvilClippy>
- Cross-platform (.NET Core); runs on Linux / macOS for operators not on Windows.
- Companion: `oledump.py` (Didier Stevens) for analysing the result and confirming the stomp landed.

## See also

- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — the umbrella page.
- [AMSI bypass](/wiki/techniques/amsi-bypass/) — the still-needed companion.
- [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) — the gate Evil Clippy doesn't bypass on its own.

## References

- Outflank — Stan Hegt — *Evil Clippy: MS Office maldoc assistant* (2019-05-05) — <https://www.outflank.nl/blog/2019/05/05/evil-clippy-ms-office-maldoc-assistant/>
- EvilClippy on GitHub — <https://github.com/outflanknl/EvilClippy>
