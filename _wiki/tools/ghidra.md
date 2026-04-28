---
title: "Ghidra"
permalink: /wiki/tools/ghidra/
layout: single
author_profile: true
tags:
  - vuln-research
  - exploit-dev
  - tool
sidebar:
  nav: "wiki"
---

*NSA-developed reverse-engineering suite. The free alternative to IDA Pro that's actually competitive.*

**Status:** seed
**Related:** [Vulnerability Research](/wiki/domains/vulnerability-research/), [Exploit Development](/wiki/domains/exploit-development/)

---

## Why use Ghidra

- Free and open-source.
- Decompiler is genuinely good — competitive with Hex-Rays for x86/ARM, often better for less common architectures.
- Multi-arch out of the box: x86/x64, ARM/AArch64, MIPS, PowerPC, RISC-V, AVR, m68k, SuperH, Z80, 6502, etc.
- Project structure supports collaborative analysis.
- Headless mode (`analyzeHeadless`) is excellent for batch processing — fuzzing harness extraction, binary diffing pipelines.
- Rich Java/Python (Jython) scripting; PyGhidra (CPython) increasingly supported.

The case for IDA over Ghidra in 2026 is mostly: faster on huge binaries, better dynamic-debugger integration, and Hex-Rays microcode tooling for advanced decompilation work.

---

## Project workflow

1. **Create a project.** Shared project = `Project → New → Shared` (uses Ghidra Server).
2. **Import the binary.** Auto-analysis prompts. Defaults are sensible; uncheck "Decompiler Parameter ID" if analysis is slow on a big binary.
3. **Apply symbols.** PDB → `File → Load PDB File`. DWARF is auto-detected.
4. **Apply types.** Open Data Type Manager → import a `.gdt` file (Ghidra Data Type) for the SDK / library you need.
5. **Annotate as you go.** Rename functions and variables, retype struct fields, add comments. The decompiler output gets dramatically more readable as you do this.

---

## Decompiler tips

- **Right-click → Edit Function Signature** to fix call conventions and param types — often single biggest win for unreadable functions.
- **`L` to rename**, **`Y` to retype**, **`T` to retype variable / param**, **`;` to add a comment**, **`G` to go-to address**, **`B` toggle bookmark**.
- **Highlight a token → right-click → "Find references to ..."** for xrefs.
- **Function Graph view** (`Window → Function Graph`) to see control flow.
- **PCode** (Ghidra's IR) is exposed via the Decompiler API. Useful for taint analysis scripts.

---

## Patch diffing

Ghidra's strength here keeps growing:

- **BSim** — built-in similarity search across function databases. Index a "before" binary, query a "after" function, see what changed.
- **Diaphora** — long-standing, IDA-first, also supports Ghidra. SQLite-based diffs.
- **ghidriff** — Python tool that generates markdown diffs (used in the user's [December 2025 Patch Tuesday post](/posts/2025/12/patch-tuesday/)).
- **BinDiff** — Zynamics / Google. Standalone; export Ghidra → BinDiff via the BinDiff plugin.

---

## Headless / scripting

`$GHIDRA_HOME/support/analyzeHeadless` runs the full project pipeline without a UI. Use it for:

- Batch-importing a directory of binaries.
- Running custom analysis scripts across a corpus.
- Exporting decompiled C for downstream pipelines (LLM-aided RE, source-level static analysis).
- CI for binary-diffing on every Patch Tuesday.

PyGhidra (CPython) is increasingly the right way to write scripts; the Jython API is still everywhere in the community.

---

## Useful extensions

- **Ghidrathon** — CPython 3 scripting in Ghidra.
- **PyGhidra** — official CPython integration (ships with newer releases).
- **gdbgui / GDB integration** (via Debugger module) — synced disassembler + live debugger.
- **OOAnalyzer** — CMU's C++ class-recovery tool; uses Ghidra as backend.
- **Cartographer** — visualize coverage from DynamoRIO `drcov` files inside Ghidra.

---

## References

- Ghidra — <https://ghidra-sre.org/> (NSA repo: <https://github.com/NationalSecurityAgency/ghidra>)
- *The Ghidra Book* — Chris Eagle, Kara Nance
- HackOvert / Ghidra training — <https://github.com/HackOvert/GhidraSnippets>
- ghidriff — <https://github.com/clearbluejar/ghidriff>
