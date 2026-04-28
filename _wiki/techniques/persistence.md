---
title: "Persistence"
permalink: /wiki/techniques/persistence/
layout: single
author_profile: true
tags:
  - red-team
---

*Surviving reboots, user logouts, and AV sweeps without lighting up the SIEM.*

**Status:** seed
**Related:** [Initial Access](/wiki/techniques/initial-access/), [OPSEC](/wiki/concepts/opsec/), [Lateral Movement](/wiki/techniques/lateral-movement/)

{% include toc %}

---

## Two kinds of persistence

- **Endpoint persistence** — surviving on a specific compromised host.
- **Identity / domain persistence** — surviving across hosts via stolen credentials, tickets, certs, or long-lived OAuth tokens.

Identity persistence is generally stealthier than endpoint persistence on hardened environments. Your stolen Kerberos ticket or Entra refresh token doesn't have a process tree.

---

## Windows endpoint persistence

A non-exhaustive ranking by typical detection difficulty (loud → quiet):

| Mechanism | Detection profile |
|-----------|-------------------|
| `Run` / `RunOnce` registry keys | Trivial. AutoRuns, Sysmon, every EDR. |
| Startup folder shortcuts | Trivial. |
| Service install | Logged (event 7045) and watched. |
| Scheduled tasks | Logged (event 4698). Slightly stealthier with unusual triggers (logon-of-specific-user, on-event). |
| Logon scripts | Older, less monitored, still works in places. |
| WMI event subscription | `__EventFilter` + `__EventConsumer` + `FilterToConsumerBinding`. Quieter, but Sysmon event 19/20/21 catches it. |
| COM hijacks | TreatAs / InprocServer32 substitution. Quieter still. |
| AppInit_DLLs / AppCertDlls | Mostly killed by code-integrity policies; rarely usable. |
| Shim Database (sdbinst) | Niche; visible to AppCompat-aware tooling. |
| Bootkit / firmware (UEFI) | Maximum survivability, maximum effort, rare in commercial work. |

EDRs cover the top 5–6 by default. The middle of the list is where most operations live; everything below is increasingly specialist.

---

## Linux endpoint persistence

- **`~/.bashrc`, `~/.profile`, `~/.bash_logout`** — user-level, easy.
- **systemd user service** — runs at user logon; less watched than system services.
- **systemd timers** — cron's modern replacement; well logged.
- **cron / `/etc/cron.d`** — classic; ubiquitous; logged.
- **`/etc/ld.so.preload`** — load a malicious shared object into every dynamically-linked binary.
- **PAM module** — capture credentials at every authentication.
- **SSH `authorized_keys`** — adding your key is the simplest backdoor; trivial to spot if anyone audits.
- **eBPF / kernel module** — high effort, long survivability, hard to detect without kernel-side tooling.

---

## Identity persistence (Active Directory)

Long-lived ways back in *without* needing your foothold to survive.

- **Golden Ticket** — TGT signed with `krbtgt` NT hash. Lifetime arbitrary. Survives password resets of all user accounts. Killed only by `krbtgt` hash rotation (twice, with replication).
- **Silver Ticket** — TGS for a specific service signed with that service's hash. Narrower scope, but quieter (no DC interaction).
- **DCSync rights** — grant a controlled account `DS-Replication-Get-Changes-All` on the domain object. Now you can dump hashes whenever you want.
- **AdminSDHolder modification** — modify the security descriptor on `AdminSDHolder`; SDProp propagates it to all protected groups every 60 minutes.
- **Skeleton Key** — patch LSASS on a DC to accept a master password against any account. Loud; mimikatz-flavored.
- **DSRM password sync** — set DSRM (Directory Services Restore Mode) password to allow auth as the local admin on the DC.
- **GPO link to a high-value OU** — push a malicious script via GPO scheduled tasks.

---

## Identity persistence (cloud)

This is where modern adversaries quietly live.

- **Entra ID app registration** — register an attacker app, grant it high-priv Graph permissions (often consented by the victim). Refresh tokens last days; primary refresh tokens (PRTs) longer.
- **Federation backdoor** — modify Federated Trust on the tenant; mint your own SAML tokens (Golden SAML).
- **Service principal credential add** — add a secondary `passwordCredential` or `keyCredential` to a high-priv service principal. The original owner won't notice a second secret.
- **Privileged Identity Management abuse** — assign yourself a permanent role; or eligible-then-self-activate.
- **Cross-tenant / B2B guest** — invite an attacker tenant as a guest with elevated privileges.
- **Refresh token theft** — capture a PRT, use it indefinitely until it expires (or until conditional-access invalidates it).

Most of these survive the user's password change. Some survive the user being deleted.

---

## OPSEC for persistence

- **Don't drop multiple persistence mechanisms on one host unless required.** Each one is a chance to be found.
- **Match the host.** A scheduled task on a database server with no other tasks stands out; on a developer workstation it's invisible.
- **Tie persistence to a real-looking trigger.** "On user logon" is normal. "Every 60 seconds" is not.
- **Avoid touching the most-watched persistence locations.** `Run` keys, `services`, `schtasks` with classic schedules — they're the ones every detection rule starts with.
- **Plan for cleanup.** Document everything you placed and remove it during exit.

---

## References

- MITRE ATT&CK TA0003 — <https://attack.mitre.org/tactics/TA0003/>
- *Hunting for Persistence on Windows* — Specula / SpecterOps
- *Detecting and Mitigating Active Directory Compromises* — ACSC
- Dirk-jan Mollema (dirkjanm) — Entra ID / hybrid identity research
