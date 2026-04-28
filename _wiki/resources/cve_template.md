---
title: CVE Analysis Template
permalink: /wiki/resources/cve_template/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- resource
redirect_from:
- /wiki/resources/cve_template/
---

> **Last updated:** 2026-04-10  
> **Related:** [Primitives](/wiki/kernel/primitives/), [Use After Free](/wiki/techniques/use_after_free/)  
> **Tags:** `kernel-mode`, `user-mode`

## Summary

Use this template when analyzing a new CVE. Copy to `wiki/cves/CVE-YYYY-NNNNN.md` and fill in each section. The goal is deep root-cause understanding — not just "what crashed" but "why the bug exists, how it was exploited, and what variants might exist."

---

## Template

```markdown
# CVE-YYYY-NNNNN — [Short descriptive title]

> **Last updated:** YYYY-MM-DD  
> **Severity:** Critical / High / Medium  
> **CVSS:** X.X  
> **Component:** [e.g., win32k.sys, ntoskrnl.exe, ntfs.sys, spoolsv.exe]  
> **Affected versions:** Windows 10 1809 - 20H2; patched in 21H1 (KB...)  
> **Bug class:** [UAF / Type Confusion / Integer Overflow / Race / OOB Read / OOB Write / Null Deref]  
> **Privilege required:** [None / Low / Medium / High]  
> **Privilege gained:** [User→SYSTEM / User→Admin / Guest→User / etc.]  
> **Patch:** KB[number], [MSRC advisory URL]  
> **Public exploit:** [Yes/No/PoC only]  
> **ITW (in the wild):** [Yes — [threat actor] / No]  
> **Related:** ..., ...

---

## Vulnerability Summary

[2-3 sentences: what component, what type of bug, what an attacker can do]

---

## Affected Code Path

```
ComponentA::Function1()
  → calls ComponentB::Function2(userInput)
    → BUG: no bounds check on userInput.size before copy to fixed buffer
```

Key function(s): `FunctionName` in `component.sys`  
Offset (build XXXX.YYYY): `+0xABCD`

---

## Root Cause Analysis

[Detailed technical description of why the bug exists]

### Vulnerable Code (Pseudocode)
```c
// BEFORE PATCH (decompiled from pre-patch binary):
NTSTATUS VulnerableFunction(PVOID UserBuffer, ULONG UserSize) {
    UCHAR KernelBuf[0x100];
    // BUG: UserSize not validated against sizeof(KernelBuf)
    RtlCopyMemory(KernelBuf, UserBuffer, UserSize);  // overflow!
    // ...
}
```

### Patched Code
```c
// AFTER PATCH:
NTSTATUS VulnerableFunction(PVOID UserBuffer, ULONG UserSize) {
    if (UserSize > sizeof(KernelBuf)) return STATUS_INVALID_PARAMETER;  // added check
    UCHAR KernelBuf[0x100];
    RtlCopyMemory(KernelBuf, UserBuffer, UserSize);
}
```

---

## Exploitation Technique

### Overview
[High-level description of the exploitation approach]

### Step 1: Information Leak
[How KASLR was defeated, if needed]

### Step 2: Heap Grooming
[What objects were used for pool/heap layout control]

### Step 3: Trigger the Bug
[Exact API sequence to trigger the vulnerability]

### Step 4: Gain Primitive
[What primitive was achieved: AAR, AAW, controlled dispatch, etc.]

### Step 5: Privilege Escalation
[Token steal, privilege flag flip, etc.]

---

## Key Primitives Used
- [e.g., "Named pipe buffers for pool grooming"]
- [e.g., "PreviousMode write for AAW"]
- [e.g., "ActiveProcessLinks walk for token steal"]

---

## Mitigations Bypassed

| Mitigation | Bypass technique |
|-----------|-----------------|
| KASLR | [info leak method] |
| SMEP | [ROP / data-only] |
| Segment Heap cookie | [needed / not needed] |

---

## Patch Analysis

[What exactly changed in the patch — diff of pseudocode, added checks, structural changes]

**Patch bypassable?** [Yes/No — if yes, describe variant analysis findings]

---

## Variant Analysis

[Are there similar code patterns in the same component or other components?  
List potential variants and whether they are patched.]

| Variant Location | Patched? | Notes |
|-----------------|---------|-------|
| `FunctionY` in `component2.sys` | Unknown | Same pattern, different codepath |

---

## Proof-of-Concept Notes

[Notes on PoC development: reliability, required conditions, OS version matrix]

**Reliability:** [X% on target build, under what conditions]

**Requirements:**
- [ ] Low-integrity process or medium-integrity?
- [ ] Specific Windows version only?
- [ ] Any prerequisites (specific software installed)?

---

## Timeline

| Date | Event |
|------|-------|
| YYYY-MM-DD | Bug discovered by [researcher] |
| YYYY-MM-DD | Reported to Microsoft |
| YYYY-MM-DD | Patch released |
| YYYY-MM-DD | Public disclosure |
| YYYY-MM-DD | ITW exploitation observed (if applicable) |

---

## References
- MSRC Advisory: https://msrc.microsoft.com/update-guide/vulnerability/CVE-YYYY-NNNNN
- [Researcher blog post]
- [PoC repository if public]
```

---

## CVE Analysis Checklist

When analyzing a new CVE, work through these questions:

**Root cause:**
- [ ] What function contains the bug?
- [ ] What input triggers it?
- [ ] Why wasn't it caught by existing checks?
- [ ] What Windows versions are affected?

**Exploitation:**
- [ ] Is KASLR bypass needed? How?
- [ ] What grooming objects are available?
- [ ] What primitive does the bug give?
- [ ] What mitigations apply to this target?
- [ ] Is data-only exploitation possible (HVCI compatibility)?

**Variants:**
- [ ] Are there similar patterns in the same file?
- [ ] Are there similar patterns in sibling components?
- [ ] Were nearby functions also patched (implies broader issue)?

**Defenses:**
- [ ] Does the patch address root cause or symptom?
- [ ] What is the bypass surface for the patch?
