---
title: Wi-Fi Client Isolation Bypass
permalink: /wiki/concepts/wi-fi-client-isolation-bypass/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/wi-fi-client-isolation-bypass/
---

**Category:** Network / Wireless
**MITRE ATT&CK:** T1040 (Network Sniffing), T1557 (Adversary-in-the-Middle), T1565.002 (Transmitted Data Manipulation)
**Related:** [Wireless Attacks](/wiki/concepts/wireless-attacks/), [Airsnitch](/wiki/tools/airsnitch/), [Lateral Movement](/wiki/concepts/lateral-movement/)

## Overview
Wi-Fi client isolation (AP isolation) is a vendor-specific mechanism intended to prevent clients on the same network from communicating directly. The AirSnitch paper (NDSS 2026) demonstrates that client isolation is fundamentally broken across all tested home routers and enterprise APs, across all WPA versions. Three root-cause classes allow an in-network attacker to bypass isolation: shared group key material (GTK/IGTK), lack of IP-layer isolation alongside MAC-layer isolation, and weak identity synchronization across network layers/BSSIDs enabling MAC spoofing-based port stealing.

## How It Works

### Background: Key Hierarchy
- **PTK** (Pairwise Transient Key) — per-client unicast session key, scoped per-BSSID.
- **GTK** (Group Temporal Key) — shared by all clients on a BSSID; encrypts broadcast/multicast frames.
- **IGTK** — authenticates broadcast management frames (does not encrypt).
- Passpoint attempts to randomize GTK per-client (DGAF Disable) but leaves group key handshake, FT handshake, and WNM-Sleep Response unrandomized — allowing real GTK recovery.

### Attack 1: Abusing GTK (§IV-B)
Exploit the shared GTK to inject unicast-inside-broadcast frames directly over the air, bypassing AP-side isolation entirely since the AP never sees these frames.

**Steps:**
1. Connect to the victim's BSSID (even briefly) to receive the shared GTK during the 4-way handshake.
2. Craft a broadcast-addressed Wi-Fi frame (receiver = `FF:FF:FF:FF:FF:FF`) encrypted with the GTK, spoofing the AP's MAC as transmitter.
3. Embed a unicast IP packet targeting the victim inside the broadcast frame payload.
4. The victim's OS decrypts with GTK and delivers the embedded IP packet to the IP stack.

**Advantages:**
- Works even after attacker's association is revoked (GTK rarely refreshed — often hourly, daily, or never).
- Effective against WPA2 and WPA3.
- APs cannot stop it: frames are injected directly over the air, never forwarded by the AP.

**Passpoint GTK escalation:**
- If DGAF Disable is active, clients get a randomized GTK during initial 4-way handshake but receive the *real* GTK when a group key handshake fires (periodic refresh) or during an FT handshake (attacker can spoof BSS Transition Requests to trigger one).

**IGTK → GTK escalation:**
- Passpoint also fails to randomize the IGTK.
- Craft a WNM-Sleep Response protected by the shared IGTK, using broadcast receiver address, containing an attacker-chosen GTK.
- Victim installs the attacker-controlled GTK → attacker can now inject broadcast frames victim will accept.

**OS acceptance (tested):**

| OS | group-ping (IPv4) | group-ping6 (IPv6) | group-arp-unicast |
|---|---|---|---|
| macOS 15.4 | ✓ | ✓ | ✓ |
| iOS 18.3.2 | ✓ | ✓ | ✓ |
| Android 14 | ✓ | ✓ | ✓ |
| Windows 11 (firewall off) | ✓ | ✓ | ✓ |
| Windows 11 (firewall on) | ✗ | ✓ | ✓ |
| Ubuntu 22.04 (drop_unicast_in_l2_multicast on) | ✗ | ✓ | ✓ |

### Attack 2: Gateway Bouncing (§V-A)
Exploit the absence of IP-layer isolation. The AP drops direct L2 client-to-client frames, but will forward packets toward the gateway. The gateway then routes them to the victim.

**Steps:**
1. Craft packet: DST MAC = gateway MAC, DST IP = victim IP.
2. Send to AP (encrypted with your own PTK, ToDS=1).
3. AP accepts the frame (DST MAC matches gateway), strips 802.11 header, forwards Ethernet frame to gateway.
4. Gateway routes to victim's IP → sends back with SRC MAC = gateway MAC, DST MAC = victim MAC.
5. Victim receives the packet.

Works across all WPA versions and all tested devices (gateway IP-layer routing does not enforce client isolation).

### Attack 3: Port Stealing / MAC Spoofing (§V-B)
Exploit how Wi-Fi APs learn MAC-to-virtual-port (BSSID) mappings. Requires attacker to connect using victim's MAC address on a *different* BSSID from the victim.

**Downlink interception:**
1. Attacker associates with a different BSSID (e.g., guest/2.4 GHz) using the **victim's MAC address**.
2. Attacker sends legitimate-looking frames with ToDS=1 from that BSSID.
3. AP's internal L2 switch updates forwarding table: victim's MAC → attacker's virtual port.
4. Victim's downlink traffic now encrypted with attacker's PTK and forwarded to attacker's BSSID.
5. In worst case (attacker associates with open SSID): victim's WPA2/3-encrypted traffic is now forwarded **in plaintext** over the open SSID, observable by any nearby device.

**Uplink interception:**
1. Attacker connects using the **gateway's MAC address** from a different BSSID.
2. Switch maps gateway MAC → attacker's port.
3. Victim's uplink traffic (destined for gateway) is redirected to attacker.

**Root cause:** PTK binding is per-BSSID, scoped to `<MAC, PTK>`. Attacker's handshake on a different BSSID overwrites the MAC→PTK mapping for that BSSID without invalidating the victim's association on their BSSID. Layer-2 forwarding and cryptographic association are decoupled.

**Cross-AP variant:** Same technique applied at the distribution switch level — attacker connected to a different physical AP can steal port mappings for victims on a different AP.

### Attack 4: Broadcast Reflection (§V-C)
Stealthy GTK-free injection using the AP's own re-encryption behavior.

1. Attacker sends a frame with ToDS=1 and Address 3 (logical destination) = `FF:FF:FF:FF:FF:FF` (broadcast), encrypted with the attacker's own PTK.
2. AP treats the logical destination as broadcast, re-encrypts with the **victim BSSID's GTK**, and delivers to all clients on that BSSID.
3. Attacker embeds a unicast payload targeting the victim.

Does not require attacker to know the GTK. Works from a separate BSSID or even an open network. Can chain with port stealing to reflect intercepted downlink frames back to the victim (completing MitM).

## Attack Methodology

### Full Bidirectional MitM in Enterprise Networks (§VI)

**Prerequisites:**
- Attacker has guest-network credentials (or open SSID access).
- Victim on trusted SSID on the same physical AP (or connected AP in same distribution system).

**Phase 1 — Downlink interception:**
1. Scan channels to identify victim MAC and associated BSSID.
2. Associate with a different BSSID (e.g., guest/2.4 GHz) using victim's MAC address.
3. Flood ICMP Echo Reply frames (ToDS=1, Address3 = `br0` bridge MAC) to trigger L2 learning.
4. Switch maps victim MAC → attacker's port; victim's downlink redirected to attacker.

**Phase 2 — Return intercepted downlink to victim:**
- Option A: **Gateway Bouncing** — temporarily pause port stealing, let victim reclaim port; inject via gateway bounce (source IP spoofed as original server).
- Option B: **GTK Abuse** — send intercepted frames wrapped in GTK-encrypted broadcast directly over the air; no port restoration needed.
- Option C: **Client-triggered Port Restoration** — send GTK-encrypted ICMP Echo Request to victim; victim replies, AP rebinds victim MAC to original port; then use gateway bouncing to deliver.

**Phase 3 — Uplink interception:**
1. Attacker connects with gateway's MAC on a different BSSID (NIC1).
2. Sends frames to cause switch to associate gateway MAC with attacker's port.
3. Victim's uplink (destined for gateway) arrives at attacker.

**Phase 4 — Return uplink to real gateway ("Server-triggered Port Restoration"):**
1. Attacker pre-establishes connection to external server; agrees on fixed burst schedule (e.g., every 100 ms).
2. Server sends burst → AP's L2 learning mechanism re-associates gateway MAC with correct uplink port.
3. During this window, attacker forwards queued intercepted packets to real gateway.
4. Alternates between restoration and port stealing to maintain control.

**End-to-end MitM time to completion:** ~2 seconds on Netgear R8000 (victim streaming YouTube, no perceptible lag).

### RADIUS Credential Extraction (Higher-Layer, §VII-G)
Once uplink interception is achieved in WPA2-Enterprise:
1. Intercept RADIUS packet from enterprise AP to RADIUS server.
2. Brute-force the RADIUS Message Authenticator (HMAC-MD5 over shared AP↔RADIUS passphrase).
3. Recover AP-RADIUS passphrase.
4. Set up rogue RADIUS server → rogue WPA2/3 AP → intercept legitimate client credentials.

## Detection & Evasion Notes

**Detection signals:**
- Same MAC address appearing on multiple BSSIDs simultaneously (Tenda RX2 Pro detects/blocks this).
- Unusual broadcast frame volume from a client (GTK abuse generates many broadcast frames).
- Asymmetric traffic flows (victim's downlink arriving at unexpected port).
- RADIUS anomalies: unexpected authentication attempts, brute-force patterns on Message Authenticator.

**Attacker evasion / why detection is hard:**
- GTK abuse frames are injected over the air; the AP never sees them and cannot detect or block them.
- Port stealing uses legitimate 802.11 association procedures.
- Cross-BSSID MAC spoofing is allowed by 802.11 standard (no standard prevents it).
- Dynamic ARP Inspection (DAI) is ineffective — these attacks operate below DAI.

**Successful blockers (from testing):**
- Separate internal L2 bridges per BSSID (DD-WRT and OpenWrt with proper guest network config).
- Per-client MAC uniqueness enforcement (Tenda RX2 Pro in AP mode).
- VLAN-per-SSID (TP-Link EAP verified to nullify all injection techniques).

## Tested Devices & Results

All tested devices were vulnerable to at least one attack:

| Device | Gateway Bouncing | Abusing GTK | Port Stealing (Downlink) | Port Stealing (Uplink) |
|---|---|---|---|---|
| Netgear Nighthawk X6 R8000 | ✓ | ✓ | ✓ | Partial |
| Tenda RX2 Pro | ✓ | ✓ | ✗ (blocked) | Partial |
| D-Link DIR-3040 | ✓ | ✓ | ✓ | ✓ |
| TP-Link Archer AXE75 | ✓ | ✓ | ✓ | Partial |
| ASUS RT-AX57 | Partial | ✓ | Partial | ✓ |
| DD-WRT v3.0-r44715 | Partial | ✓ | ✗ | Partial |
| OpenWrt 24.10 | Partial | ✓ | ✗ | ✗ |
| Ubiquiti AmpliFi Alien | ✓ | ✓ | ✓ | Partial |
| Ubiquiti AmpliFi Router HD | ✓ | ✓ | ✓ | Partial |
| Cisco Catalyst 9130 | ✓ | ✓ | ✓ | ✗ |
| LANCOM LX-6500 | ✓ | ✓ | ✓ | ✓ |

Also validated in two real university WPA2-Enterprise networks.

## Defenses

| Defense | Mitigates |
|---|---|
| VLAN per untrusted BSSID | Port stealing, gateway bouncing across BSSIDs |
| Per-client randomized GTK + DGAF Disable (all handshakes) | GTK abuse |
| IGTK randomization (Passpoint v3.4) | IGTK→GTK escalation |
| Reject spoofed gateway MACs at wireless interface | Uplink port stealing |
| Disconnect clients with duplicate MAC across BSSIDs | Port stealing |
| IP spoofing prevention | Gateway bouncing (return leg) |
| MACsec (IEEE 802.1AE) end-to-end | All attacks (attackers can at most DoS) |
| Separate internal bridges per BSSID | Port stealing, inter-BSSID injection |

## Tools
- [Airsnitch](/wiki/tools/airsnitch/) (macstealer) — PoC framework implementing gateway bouncing, port stealing, GTK abuse
- `aircrack-ng` suite — monitor mode, frame injection
- `hostapd` — AP daemon (most tested devices use it; partial correlation with vulnerability)
- `mac80211_hwsim` — Linux virtual wireless NIC for lab testing without physical hardware

## References
- AirSnitch: Demystifying and Breaking Wi-Fi Client Isolation — Zhou et al., NDSS 2026 (UCR / KU Leuven; includes Mathy Vanhoef)
- Vanhoef & Piessens, "Predicting, Decrypting, and Abusing WPA2/802.11 Group Keys" — USENIX Security 2016 (GTK predictability predecessor)
- Vanhoef & Piessens, "Key Reinstallation Attacks (KRACK)" — CCS 2017
- Ornaghi & Valleri, "Man in the Middle Attacks" (port stealing for Ethernet) — Blackhat Europe 2003
- Passpoint Specification v3.3/v3.4 — Wi-Fi Alliance
