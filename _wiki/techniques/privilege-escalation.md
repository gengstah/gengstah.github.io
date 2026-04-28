---
title: "Privilege Escalation"
permalink: /wiki/techniques/privilege-escalation/
layout: single
author_profile: true
tags:
  - pentest
  - red-team
  - exploit-dev
sidebar:
  nav: "wiki"
---

*Going from the user you landed as to the user (or kernel) you actually want.*

**Status:** seed
**Related:** [Initial Access](/wiki/techniques/initial-access/), [Lateral Movement](/wiki/techniques/lateral-movement/), [Exploit Development](/wiki/domains/exploit-development/)

{% include toc %}

---

## The privilege ladder

Two stacks worth keeping in mind.

**Windows endpoint**

```
Anonymous → Guest → Standard user → User in Administrators
       → High IL admin (UAC-elevated) → SYSTEM → Kernel → Hypervisor / SK
```

**AD environment**

```
Standard domain user → Workstation admin → Server admin → Tier 1 (server fleet)
       → Tier 0 (DC, ADCS, Entra Connect, Hybrid identity) → Domain Admin / Enterprise Admin
```

You move on both stacks in parallel.

---

## Local Windows priv-esc

Routes that pay off most engagements:

- **Service misconfiguration** — unquoted service paths, weak service permissions, weak binary permissions, `BINARY_PATH_NAME` mutability.
- **Token impersonation** — `SeImpersonatePrivilege` ⇒ "potato" attacks (Hot/Rotten/Juicy/Rogue/God/Print Spooler-flavored). Exploits a connection from SYSTEM coming back to a named pipe you control.
- **Stored credentials** — DPAPI master keys, browser password stores, KeePass / 1Password vaults left unlocked, RDP `.rdp` files with saved creds, Credential Manager.
- **AlwaysInstallElevated** — registry policy that installs MSIs as SYSTEM. If both HKLM and HKCU set, it's an instant LPE.
- **Vulnerable drivers (BYOVD)** — bring a known-vulnerable signed driver, exploit it for kernel R/W. Microsoft maintains a vulnerable-driver blocklist; bypassing or pre-empting it is its own subfield.
- **Kernel CVEs** — patched bugs in `clfs.sys`, `cldflt.sys`, `appid.sys`, `dxgkrnl.sys`, `win32k.sys`. Patch-Tuesday diffing surfaces fresh ones monthly.
- **Sandbox escapes** — browser renderer → broker, AppContainer → medium IL, Docker container escape.

**Tools:**
- `winPEAS`, `PowerUp`, `Seatbelt` — local enumeration.
- `Watson`, `Wesng`, `Sherlock` (deprecated but the lineage) — missing-patch enumeration.
- `PrintSpoofer`, `GodPotato`, `EfsPotato` — current-generation impersonation.

---

## Local Linux priv-esc

- **SUID / SGID binaries** — anything in [`gtfobins`](https://gtfobins.github.io/). `find / -perm -u=s -type f 2>/dev/null` is the first command.
- **Sudo misconfigs** — `sudo -l` checked against gtfobins.
- **Capabilities** — `getcap -r / 2>/dev/null`. `cap_setuid+ep` on `python3` is a SYSTEM-equivalent.
- **Cron jobs** — writable scripts run by root, world-writable PATH, glob expansion bugs.
- **Writable services** — systemd unit files, init scripts.
- **Container escapes** — privileged containers, mounted Docker socket, `/proc/self/exe` tricks, kernel CVEs (Dirty Pipe, Dirty COW).
- **Kernel CVEs** — same playbook as Windows. nf_tables, io_uring, eBPF — current hotspots.

**Tools:** `linPEAS`, `LinEnum`, `linux-exploit-suggester`.

---

## Active Directory priv-esc

The interesting paths in modern AD. A non-exhaustive list of what's still landing in 2026:

- **Kerberoasting** — request service tickets for service accounts; crack offline. Targets accounts with weak passwords on a SPN.
- **AS-REP Roasting** — accounts with `DONT_REQ_PREAUTH`. Same idea, no SPN required.
- **DCSync** — replicate password hashes from a DC. Requires `Replicating Directory Changes` rights.
- **Unconstrained delegation** — capture TGTs from any user authenticating to a host that has it.
- **Constrained delegation (S4U2Self / S4U2Proxy)** — abuse misconfigured `msDS-AllowedToDelegateTo` and resource-based constrained delegation (RBCD).
- **Shadow Credentials** — write `msDS-KeyCredentialLink` on an object you control to authenticate as it via PKINIT.
- **ADCS attacks** — Specter Ops *Certified Pre-Owned* paper. ESC1–ESC15 (and growing) — misconfigured certificate templates that issue certs as arbitrary users.
- **GPO abuse** — write access to a GPO that applies to high-value targets.
- **Group membership abuse** — `GenericAll` / `WriteDACL` / `AddMember` paths surfaced by BloodHound.

**Tools:**
- **BloodHound** + `SharpHound` / `RustHound` / `soaphound` — graph the path from where you are to where you want to be. The single most important AD tool of the past decade.
- **`certipy`** — ADCS attacks.
- **`impacket`** — `secretsdump`, `getTGT`, `getST`, `psexec`, the lot.
- **`Rubeus`** — Kerberos manipulation in C#.
- **`mimikatz`** — still the reference for credential extraction (when you can survive its detection).

---

## Cloud priv-esc

The patterns in IAM-land are different from on-prem but the discipline is similar — graph the access paths and find the shortest one.

- **AWS** — IAM privesc paths (`iam:PassRole` + `lambda:InvokeFunction`, `iam:CreateAccessKey` on a privileged user, etc.); SSM/EC2 metadata theft; SSO abuse; Organizations cross-account.
- **Azure / Entra ID** — owner of an app registration with a high-priv API permission; `Privileged Authentication Administrator` reset paths; Conditional Access bypasses; Managed Identity abuse on Functions/AKS/VMs.
- **GCP** — Service Account impersonation (`iam.serviceAccountTokenCreator`), exposed GCE metadata, GKE node compromise → cluster compromise.

**Tools:** `pacu`, `prowler`, `cloudfox`, `roadtools`, `aadinternals`, `stormspotter`.

---

## A note on detection

Privilege escalation is the most-watched stage of an intrusion after credential access. A noisy LPE on a monitored host can burn the whole operation. When in doubt:

1. Confirm the priv-esc primitive will work *before* firing it.
2. Check what telemetry it generates (Sysmon, EDR, security event log).
3. Choose the quietest viable path. A misconfigured ACL is silent; a kernel exploit BSODs noisily.

---

## References

- HackTricks — <https://book.hacktricks.xyz/> (the index for both Windows and Linux LPE)
- BloodHound docs — <https://bloodhound.specterops.io/>
- *Certified Pre-Owned* — Will Schroeder, Lee Christensen (SpecterOps)
- *The Hacker Playbook 3* — Peter Kim
- Connor McGarr, Grant Willcox, Saar Amar — kernel LPE write-ups
