---
title: "Compiler & Undefined-Behaviour Pitfalls (C/C++)"
permalink: /wiki/concepts/compiler-introduced-bugs/
layout: single
author_profile: true
tags:
- windows-exploit-research
- concept
- vulnerability-research
---

> **Last updated:** 2026-07-02  
> **Related:** [Integer Overflows](/wiki/techniques/integer_overflows/), [Buffer Overflow](/wiki/concepts/buffer-overflow/), [C++ Exception Reversing](/wiki/concepts/cpp-exception-reversing/), [CVE-2023-36728 (SQL Server underflow)](/wiki/cves/CVE-2023-36728/)  
> **Tags:** `vulnerability-research`

## Summary

Some vulnerabilities are not in the source logic per se but in the gap between what the programmer wrote and what the compiler emitted — undefined/implementation-defined behaviour, integer promotion rules, and signed/unsigned comparison quirks. Two compilers can compile the *same* source into differently-exploitable machine code, and the usual warning flags stay silent. These patterns are worth recognising both when auditing source and when the decompiled output "shouldn't" be reachable.

---

## Signed vs. Bitfield Comparison

Bitfields have implementation-defined signedness and undergo integer promotion:

```c
struct a { unsigned f1 : 8; unsigned f2 : 2; unsigned f3 : 6; } t1;
// f1 = 0xaa; compare an int == 0xffffffff against t1.f1
```

GCC promotes `f1` to `unsigned int` and then does a **signed** comparison, printing `0`; MSVC prints `1`. Even `gcc t.c -Werror -Wall -Wextra -Wconversion` emits **no warning**. When such a comparison gates a security check, the divergence is a real bug that only manifests on one toolchain.

## Unsigned-vs-Zero Comparison (dead check)

```c
if (ptr->len - sizeof(struct s) < 0)   // ptr->len is unsigned → result never < 0
```

Because `ptr->len` is unsigned, the subtraction can never be negative, so the guard is dead — the classic "size − header < 0" check that never fires and lets an undersized `len` through. GCC warns only under `-Wextra`, so it slips past default builds and code review. This is the same arithmetic-underflow shape that produces the OOB read in [CVE-2023-36728](/wiki/cves/CVE-2023-36728/) and the allocation/copy mismatch in [CVE-2024-29050](/wiki/cves/CVE-2024-29050/).

---

## Assorted Low-Level Gotchas

A few more toolchain/ABI facts worth internalising (from the author's "strange knowledge" notes):

- **`#include` is literal text substitution** — a header can contain conditional logic that behaves differently depending on *where* it is included, enabling (ab)uses well beyond declarations.
- **Anonymous struct members** — an unnamed nested `struct`/`union` exposes its members directly on the parent (`b1.a1` works with no member name). Handy to know when a decompiler flattens layouts.
- **`(size_t)(-1)` is `0xffffffffffffffff`** on x64 under both GCC and MSVC — two's-complement is consistent across the toolchains, so an `int` `-1` used as a length becomes a maximal `size_t`.
- **Raw `clone()` threading stack bug** — hand-rolling threads with the Linux `clone()` syscall requires accounting for how the stack pointer is used when `clone()` returns `0` in the child; getting it wrong leaves the child executing `pop rbp; ret` on a corrupted stack, giving `RIP = 0` and an immediate crash. A reminder that syscall-level thread setup has ABI constraints libc normally hides.

---

## References

- VictorV (@V-V), "和编译器编译结果有关的漏洞问题", v-v.space, 2023-03-24 — <https://v-v.space/2023/03/24/compiler_error/>
- VictorV (@V-V), "奇怪的知识又增加了", v-v.space, 2023-10-11 — <https://v-v.space/2023/10/11/unusual_knowledge/>
