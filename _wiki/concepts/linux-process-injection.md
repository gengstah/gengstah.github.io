---
title: Linux Process Injection
permalink: /wiki/concepts/linux-process-injection/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/linux-process-injection/
---

**Category:** Execution / Defense Evasion
**MITRE ATT&CK:** T1055 — Process Injection; T1055.008 — Ptrace System Calls
**Related:** [Privilege Escalation Linux](/wiki/concepts/privilege-escalation-linux/), [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Post Exploitation](/wiki/concepts/post-exploitation/)

## Overview
Linux process injection is significantly more constrained than Windows due to the Yama LSM's `ptrace_scope` setting and the requirement for elevated privileges. However, multiple techniques exist with different capability/privilege trade-offs — including a novel approach using **seccomp user notifications** that works without `ptrace`, `procfs`, or `process_vm_writev`, regardless of `ptrace_scope`.

## Traditional Injection Primitives

| Primitive | Mechanism | Constraint |
|-----------|-----------|-----------|
| `ptrace` | Read/write memory + registers, ignore page perms | Requires `CAP_SYS_PTRACE` or matching UID; `ptrace_scope` restricts |
| `/proc/<pid>/mem` | Read/write via procfs pseudo-files | Controlled by `ptrace_scope`; same UID or CAP_SYS_PTRACE |
| `process_vm_writev` | Like `WriteProcessMemory` on Windows | Controlled by `ptrace_scope`; respects page protections |

### Yama ptrace_scope Values

| Value | Effect |
|-------|--------|
| 0 | Attach to any process with same UID |
| 1 | Attach to descendants only (most distro default) |
| 2 | Require `CAP_SYS_PTRACE` for any attach |
| 3 | Disable remote process attachment entirely |

## Shared Library Injection Methods

**LD_PRELOAD:** Set environment variable before exec to load arbitrary library. Many EDRs heavily instrument process creation and detect this pattern.

**memfd_create:** Create in-memory file without disk path. Load via `dlopen` using `/proc/<pid>/fd/<num>` path. No on-disk artifact, but discoverable via `/proc/<pid>/fd` and memory inspection.

**dlopen via ptrace/procfs:** Force a running process to call `dlopen` by hijacking execution through one of the traditional primitives.

## Seccomp Notify Injection (Novel — No ptrace_scope Restriction)

**Tool:** github.com/outflanknl/seccomp-notify-injection  
**Kernel requirement:** Linux 5.14+ (for `SECCOMP_ADDFD_FLAG_SEND`)  
**Constraint:** Parent-to-child injection only (injector must create the target process)

### How It Works
Seccomp user notifications (Linux 5.0+) allow a parent process to intercept syscalls made by a child and respond with a custom file descriptor or error — effectively emulating the syscall in userspace.

**Setup:**
1. Parent forks a child
2. Child installs seccomp filter for `openat` using `SECCOMP_SET_MODE_FILTER | SECCOMP_FILTER_FLAG_NEW_LISTENER`
3. Kernel returns a listener file descriptor to the child
4. Child sends the listener FD to the parent
5. Child calls `execve` to launch the target binary

**Injection loop:**
1. Target binary starts, dynamic linker calls `openat` to load shared libraries
2. Seccomp kernel intercepts — parent receives notification and waits
3. Parent responds with `SECCOMP_IOCTL_NOTIF_ADDFD` → passes its own FD (the shellcode `.so`) instead of the real library FD
4. Dynamic linker loads the attacker's shared library thinking it's a legitimate dependency
5. IFUNC resolver in the shellcode `.so` executes before normal symbol resolution (inspired by XZ Utils backdoor technique)

### Why This Bypasses ptrace_scope
From the kernel's perspective, this is the legitimate use case for seccomp-notify: a parent supervising a child's syscalls. The injector never directly accesses the target process's memory — no `ptrace`, no `/proc/<pid>/mem`, no `process_vm_writev`.

### Implementation Notes
```c
// Child setup (before execve)
int listener_fd = syscall(SYS_seccomp, 
    SECCOMP_SET_MODE_FILTER,
    SECCOMP_FILTER_FLAG_NEW_LISTENER,
    &prog);
// Send listener_fd to parent via socket or pipe
// Then call execve(target_binary, ...)

// Parent injection response
struct seccomp_notif_addfd addfd = {
    .id = notif.id,
    .srcfd = shellcode_memfd,  // memfd containing malicious .so
    .flags = SECCOMP_ADDFD_FLAG_SEND,  // Returns new FD directly to child
};
ioctl(listener_fd, SECCOMP_IOCTL_NOTIF_ADDFD, &addfd);
```

The target binary must be **dynamically linked** — the technique hijacks the dynamic linker's `openat` calls during library loading.

## Detection

- **Seccomp filter installation:** Monitoring `prctl(PR_SET_SECCOMP)` or `seccomp()` syscalls from non-browser/sandbox processes is a strong indicator
- **Unusual FD passing over Unix sockets** between parent/child at process startup
- **In-memory `.so` without disk path** in `/proc/<pid>/maps` (shows `memfd:` backing)
- **EDR hooks:** Many products instrument `LD_PRELOAD` and `dlopen` — seccomp-notify injection bypasses both

## Comparison of Techniques

| Technique | ptrace_scope | Requires | Target |
|-----------|-------------|----------|--------|
| ptrace | ≤2 | CAP_SYS_PTRACE or ancestor | Running |
| procfs | ≤2 | Same UID or CAP | Running |
| LD_PRELOAD | None | env var control | New process |
| seccomp notify | None | Parent creates child | New process |

## References
- Outflank — "Linux Process Injection via Seccomp Notify" (2025-12-09)
- github.com/outflanknl/seccomp-notify-injection
- Ori David (Akamai) — "The Definitive Guide to Linux Process Injection"
- XZ Utils backdoor analysis — research.swtch.com/xz-script
