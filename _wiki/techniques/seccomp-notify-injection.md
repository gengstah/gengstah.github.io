---
title: "Linux Process Injection via Seccomp Notifier"
permalink: /wiki/techniques/seccomp-notify-injection/
layout: single
author_profile: true
tags:
  - technique
  - linux
  - process-injection
  - seccomp
  - outflank
---

*Abusing the Linux seccomp user-notification mechanism (`SECCOMP_RET_USER_NOTIF`, kernel 5.0+) to interpose on a target process's syscalls — and from there, manipulate its memory and execution. A 2025 Outflank technique.*

**Status:** drafting
**Related:** [Linux process injection](/wiki/concepts/linux-process-injection/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## Background — what seccomp-notify is

seccomp filters classify syscalls. Most return values (`SECCOMP_RET_KILL`, `SECCOMP_RET_ALLOW`, `SECCOMP_RET_TRAP`, `SECCOMP_RET_ERRNO`) act in-kernel. Linux 5.0 added `SECCOMP_RET_USER_NOTIF`:

- A process installs a seccomp filter that returns `USER_NOTIF` for selected syscalls.
- A separate "supervisor" process holds a notification fd (returned via `SCM_RIGHTS` / `seccomp(SECCOMP_GET_NOTIF_FD)`).
- When the filtered process makes a `USER_NOTIF` syscall, the kernel *blocks* it and surfaces a `seccomp_notif` to the supervisor.
- The supervisor reads the notification, may inspect the syscall arguments, may even read or write the target's memory via `/proc/<pid>/mem`, and replies with either an emulated return value (`SECCOMP_USER_NOTIF_FLAG_CONTINUE` to let the kernel run the original syscall, or a forged result).

The intended use case is **container runtimes**: a runtime like containerd / CRI-O can intercept restricted syscalls (e.g. `mount`) and emulate them on the host's behalf, granting capabilities to a container without giving it root.

## The offensive twist

Outflank — Kyle Avery, 2025-12-09 — observed:

- A supervisor with a seccomp-notify fd for a target process has read/write access to the target's address space (via `/proc/<pid>/mem` or via reply payloads).
- That access **doesn't require `ptrace`** and **doesn't require `CAP_SYS_PTRACE`**.
- Many container runtime / sandbox configurations grant *unprivileged* processes the ability to install seccomp filters and pass the resulting fd around (this is by design — that's how unprivileged containers work).

So the attack chain looks like:

1. Operator code lands in the same security context as the target process — typically a co-resident process inside a container or a sandboxed user session.
2. Operator manipulates the target into accepting a seccomp filter with `USER_NOTIF` for relevant syscalls. The exact mechanism depends on the environment — sometimes the operator *is* the supervisor by design; sometimes the operator inherits the fd; sometimes the operator can inject via shared library / `LD_PRELOAD`.
3. Once the operator holds the notification fd, they can:
   - Block target syscalls indefinitely.
   - Modify target memory by replying to notifications with crafted addresses.
   - Coerce the target into making controlled syscalls on the operator's behalf (because `SECCOMP_USER_NOTIF_FLAG_CONTINUE` lets the kernel resume).
4. The cumulative primitive is read/write of the target's memory plus syscall steering — the Linux equivalent of `WriteProcessMemory` + `CreateRemoteThread`, without `ptrace`.

## Why this works against modern Linux EDR

Linux EDR products often:

- Hook `ptrace` use as a strong signal of injection.
- Watch `process_vm_readv` / `process_vm_writev`.
- Audit `LD_PRELOAD` / `LD_AUDIT` env vars.

`seccomp-notify` is invisible to all of these — it's the kernel granting a *legitimate* container-runtime primitive. EDR doesn't (yet) flag it because the same primitive is what makes containerd work.

## Preconditions

The attack needs:

- Linux ≥ 5.0 (seccomp-notify available).
- The operator's code in the same process tree or fd-passing scope as the target.
- For the unprivileged variant, the kernel's `unprivileged_userns_clone = 1` (default true on most distros) so the operator can install seccomp filters with `SECCOMP_FILTER_FLAG_NEW_LISTENER`.

It does **not** need:

- Root.
- `CAP_SYS_PTRACE`.
- `CAP_SYS_ADMIN`.

## Detection

- Audit `seccomp(SECCOMP_FILTER_FLAG_NEW_LISTENER, …)` calls — most legitimate user binaries don't install user-notif filters.
- Track which processes hold which seccomp-notify fds (via `/proc/<pid>/fdinfo`).
- Watch `/proc/<pid>/mem` writes from a process other than the owner.
- Expect this to migrate from research to commodity tradecraft over 2026; eBPF-based Linux EDRs will probably add detection.

## Operational notes

The technique is most relevant in:

- Container escapes — operator has code in a sidecar / init container, target is the "main" container.
- Multi-user shared hosts — co-tenant on a Linux host.
- Sandboxed user sessions — Snap, Flatpak, browser sandbox-esque.

It is **not** a kernel privilege-escalation technique. It's userland-to-userland injection that evades current Linux-EDR detection.

## See also

- [Linux process injection](/wiki/concepts/linux-process-injection/) — broader Linux injection coverage.
- [Outflank blog catalogue](/wiki/resources/outflank/).

## References

- Outflank — Kyle Avery — *Linux Process Injection via Seccomp Notifier* (2025-12-09) — <https://www.outflank.nl/blog/2025/12/09/seccomp-notify-injection/>
- Linux man-pages — `seccomp(2)`, `seccomp_unotify(2)`.
- containerd / CRI-O design docs on user-notif use.
