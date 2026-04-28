---
title: Wireless Attacks
permalink: /wiki/concepts/wireless-attacks/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/wireless-attacks/
---

**Category:** Network / Physical
**MITRE ATT&CK:** T1040 (Network Sniffing), Initial Access via wireless
**Related:** [Network Scanning](/wiki/concepts/network-scanning/), [Reconnaissance](/wiki/concepts/reconnaissance/), [Social Engineering](/wiki/concepts/social-engineering/), [Wi Fi Client Isolation Bypass](/wiki/concepts/wi-fi-client-isolation-bypass/)

## Overview
Wireless attacks target 802.11 Wi-Fi networks to gain unauthorized access, capture credentials, decrypt traffic, or use the network as a pivot point. Common targets include enterprise WPA2-Enterprise (PEAP/EAP), WPA2-PSK home/SMB networks, and open/guest networks.

## How It Works

### WPA2-PSK Attacks
- Capture 4-way handshake (when a client authenticates) → crack offline.
- PMKID attack: capture PMKID from AP beacon without waiting for client → crack offline.
- Deauth attack: force clients to re-authenticate → capture handshake.

```bash
# Monitor mode
airmon-ng start wlan0

# Capture handshakes
airodump-ng -c 6 --bssid AA:BB:CC:DD:EE:FF -w capture wlan0mon

# Deauthenticate clients (force reconnect)
aireplay-ng -0 10 -a AA:BB:CC:DD:EE:FF wlan0mon

# Crack handshake
aircrack-ng capture.cap -w /usr/share/wordlists/rockyou.txt
hashcat -m 22000 capture.hc22000 wordlist.txt  # PMKID/EAPOL hash mode
```

### WPA2-Enterprise (PEAP/EAP-TTLS) Attacks
- Set up rogue AP with same SSID; enterprise clients auto-connect.
- Capture NTLM challenge-response from PEAP authentication.
- Crack NTLM hash offline → recover plaintext domain password.
- Tools: `hostapd-wpe`, `EAPHammer`.

### Evil Twin / Rogue AP
- Clone a legitimate AP (same SSID, stronger signal).
- Client deauthed from real AP → connects to evil twin.
- Intercept/decrypt traffic (for open/WEP), phish via captive portal, MiTM.

### KARMA / MANA Attacks
- Respond to any Probe Request from clients looking for known networks.
- Clients configured to "auto-connect to known networks" will connect to attacker AP.
- Effective against clients that have open networks in their preferred network list.

### WPS Attacks
- WPS PIN mode: Pixie Dust attack recovers PIN offline using weak nonce.
- WPS brute-force: limited to 10^4 + 10^3 = 11,000 combinations.
- `reaver`, `bully` — WPS attack tools.

### Bluetooth Attacks
- Bluejacking, Bluesnarfing (contact theft)
- BLE (Bluetooth Low Energy): MITM, replay attacks on IoT devices
- KNOB attack (CVE-2019-9506): downgrade encryption key entropy
- `Btlejuice`, `BTLE-Sniffer`, `ubertooth`

## Attack Methodology
1. Survey environment: identify SSIDs, BSSIDs, channels, encryption type, client probe requests.
2. For PSK: attempt PMKID capture first (no client needed), then deauth + handshake if needed.
3. For Enterprise: set up rogue AP with EAPHammer, wait for clients to authenticate.
4. For open/guest networks: ARP poison or evil twin for MiTM.
5. Crack captured hashes; access network.
6. Use network access to pivot to internal resources.

## Detection & Evasion Notes
- Deauth attacks are detectable by WIDS (Wireless Intrusion Detection Systems).
- Rogue APs detectable via RF spectrum analysis or MAC/SSID anomaly detection.
- Enterprise: PEAP certificate validation prevents evil twin attacks — if client validates server cert correctly, PEAP capture fails. Many clients don't validate certs.
- Physical distance: stay in range but avoid obvious proximity to target building.

## Tools
- `aircrack-ng` suite — monitor, capture, deauth, crack
- `hcxtools` / `hcxdumptool` — PMKID capture and conversion
- `hashcat -m 22000` — WPA2 PMKID/EAPOL cracking
- `EAPHammer` — WPA2-Enterprise rogue AP
- `hostapd-wpe` — WPA Enterprise attack
- `Wifite` — automated WPA attack tool
- `Kismet` — wireless network detection and packet capture
- `reaver` / `bully` — WPS attacks

## Client Isolation Bypass
Client isolation (AP isolation) is not standardized and is broken across all WPA versions. See [Wi Fi Client Isolation Bypass](/wiki/concepts/wi-fi-client-isolation-bypass/) for a full treatment of: GTK abuse, gateway bouncing, port stealing, broadcast reflection, and full bidirectional MitM construction. Every tested router/network (home and enterprise) was vulnerable to at least one attack (NDSS 2026).

## References
- Mathy Vanhoef — KRACK and Dragonblood attack papers
- EAPHammer documentation (s0lst1ce)
- aircrack-ng documentation
- AirSnitch — Zhou et al., NDSS 2026 (client isolation bypass)
