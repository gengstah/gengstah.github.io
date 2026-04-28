---
title: "Privilege Escalation \u2014 Linux"
permalink: /wiki/offsec-notes/concepts/privilege-escalation-linux/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Privilege Escalation — Linux

**Category:** Linux / Post-Exploitation
**MITRE ATT&CK:** Privilege Escalation — TA0004
**Related:** [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Overview
Linux privilege escalation involves elevating from a low-privilege shell (e.g., www-data, user) to root. Common vectors include misconfigurations, vulnerable software, weak permissions, credential exposure, and kernel exploits.

## How It Works

### Enumeration First
Always enumerate thoroughly before exploiting. Use automated tools as a starting point, then manually verify.

```bash
# Automated enum
./linpeas.sh | tee linpeas.out
python3 linpeas.py
./lse.sh -l 2     # Linux Smart Enumeration

# Manual checks
id; whoami; groups
sudo -l                          # What can current user sudo?
cat /etc/passwd; cat /etc/shadow (if readable)
find / -perm -4000 2>/dev/null   # SUID binaries
find / -perm -2000 2>/dev/null   # SGID binaries
find / -writable -type f 2>/dev/null | grep -v proc
crontab -l; cat /etc/cron*
env; cat ~/.bash_history
ss -tlnp; netstat -tlnp          # Local services
```

### Common Escalation Vectors

#### Sudo Misconfigurations
- `sudo -l` — look for `NOPASSWD` entries or overly permissive rules.
- GTFOBins: nearly any binary with sudo can be abused (`vim`, `less`, `find`, `awk`, `python`, etc.)
- `sudo su`, `sudo bash`, `sudo /bin/sh` — trivial root.
- LD_PRELOAD with sudo: if `env_keep += LD_PRELOAD` is set, craft a shared library.

#### SUID/SGID Binaries
- Cross-reference with GTFOBins: `find / -perm -4000 2>/dev/null`
- Custom SUID binaries (non-standard path) are often vulnerable.
- PATH hijacking in SUID binaries that call system commands without full path.

#### Writable Files / Cron Jobs
- World-writable scripts executed by root cron → replace with reverse shell.
- Writable `/etc/crontab` or scripts in `/etc/cron.*`.
- PATH-based hijacking if cron job uses relative paths.

#### Capabilities
```bash
getcap -r / 2>/dev/null
# e.g., python3 with cap_setuid → setuid(0) → root
```

#### Writable /etc/passwd
- If writable, add a new root-equivalent user with a known password hash.
```bash
echo 'hax:$1$hax$hash:0:0:root:/root:/bin/bash' >> /etc/passwd
```

#### NFS with no_root_squash
- NFS share mounted with `no_root_squash` — mount it as root on attacker box, create SUID binary, execute on target.

#### Kernel Exploits
- Last resort; can crash the system.
- Check kernel version: `uname -r`
- Common: Dirty COW (CVE-2016-5195), DirtyCred (CVE-2022-2588), GameOver(lay) (CVE-2023-2640/32629), Looney Tunables (CVE-2023-4911)
- Use with caution in production environments.

#### Credential Hunting
- Config files: `/var/www`, `/opt`, `~/.ssh`, `/home/*/.bash_history`
- Database credentials → password reuse
- Environment variables, `/proc/*/environ`

## Detection & Evasion Notes
- SUID abuse, sudo execution logged by `auditd` if configured (AUE_EXECVE).
- Kernel exploits crash systems — test in isolated environment first.
- Minimize file drops; prefer in-memory techniques.
- Clear bash history: `history -c; cat /dev/null > ~/.bash_history`.

## Tools
- `linpeas.sh` — comprehensive automated enumeration (PEASS-ng)
- `lse.sh` — Linux Smart Enumeration
- `linEnum.sh` — older but still useful
- `GTFOBins` — gtfobins.github.io — SUID/sudo/capability abuse recipes
- `pspy` — monitor processes without root (cron job discovery)
- `unix-privesc-check` — automated checks

## References
- GTFOBins — gtfobins.github.io
- HackTricks Linux Privilege Escalation
- MITRE ATT&CK TA0004 Privilege Escalation
