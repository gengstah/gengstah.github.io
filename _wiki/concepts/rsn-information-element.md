---
title: "RSN Information Element"
permalink: /wiki/concepts/rsn-information-element/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - rsn
  - security
---

*The single 802.11 IE that says everything about a network's security: cipher suites, authentication keys, MFP capability and requirement, PMKSA caching, FT support. The RSN IE is the parameter-negotiation surface attackers manipulate.*

**Status:** drafting
**Related:** [Beacon frames](/wiki/concepts/beacon-frames/), [Authentication and association](/wiki/concepts/authentication-association/), [WPA versions](/wiki/concepts/wpa-versions/), [Handshakes](/wiki/concepts/handshakes/)

---

## Where the RSN IE appears

The same RSN IE (tag 48) is carried in:

- **Beacon** — what the AP advertises.
- **Probe Response** — same.
- **Association Request / Reassociation Request** — what the STA wants to use.
- **EAPOL-Key Message 2 of 4** (4-way handshake) — STA's RSN IE binding.
- **EAPOL-Key Message 3 of 4** — AP's RSN IE binding.

The 4-way handshake binds the STA-side and AP-side RSN IEs into the MIC. Mismatch = PTK install failure.

## Layout

```
Tag (48) | Length | Version (2) | Group Cipher Suite (4)
| Pairwise Cipher Suite Count (2) | Pairwise Cipher Suites (4 × N)
| AKM Suite Count (2) | AKM Suites (4 × N)
| RSN Capabilities (2)
| PMKID Count (2) | PMKIDs (16 × N)        [optional]
| Group Management Cipher Suite (4)        [optional, with MFP]
```

Each cipher / AKM suite is a 4-byte tuple: 3-byte OUI + 1-byte type.

## Cipher suites

Group and Pairwise:

| OUI:type | Suite |
|---|---|
| 00:0F:AC:1 | WEP-40 |
| 00:0F:AC:2 | TKIP |
| 00:0F:AC:4 | CCMP-128 (AES) |
| 00:0F:AC:5 | WEP-104 |
| 00:0F:AC:6 | BIP-CMAC-128 (used for IGTK / management protection) |
| 00:0F:AC:8 | GCMP-128 |
| 00:0F:AC:9 | GCMP-256 |
| 00:0F:AC:10 | CCMP-256 |
| 00:0F:AC:11 | BIP-GMAC-128 |
| 00:0F:AC:12 | BIP-GMAC-256 |
| 00:0F:AC:13 | BIP-CMAC-256 |

The default WPA2 cipher is **CCMP-128**. WPA3 mandates GCMP-256 for the WPA3-Enterprise 192-bit profile. Mixed cipher modes were a downgrade source pre-WPA2-2020.

## AKM suites — Authentication Key Management

| OUI:type | AKM | Notes |
|---|---|---|
| 00:0F:AC:1 | 802.1X (EAP) | WPA2-Enterprise. |
| 00:0F:AC:2 | PSK | WPA2-Personal. |
| 00:0F:AC:3 | FT-802.1X | 802.11r EAP. |
| 00:0F:AC:4 | FT-PSK | 802.11r PSK. |
| 00:0F:AC:5 | 802.1X SHA-256 | |
| 00:0F:AC:6 | PSK SHA-256 | |
| 00:0F:AC:7 | TDLS | |
| 00:0F:AC:8 | SAE | WPA3-Personal. |
| 00:0F:AC:9 | FT-SAE | 11r + WPA3. |
| 00:0F:AC:11 | 802.1X SHA-256 (Suite B) | |
| 00:0F:AC:12 | 802.1X SHA-384 (Suite B 192-bit) | WPA3-Enterprise 192-bit. |
| 00:0F:AC:13 | FT-802.1X SHA-384 | |
| 00:0F:AC:14 | FILS SHA-256 | 802.11ai |
| 00:0F:AC:15 | FILS SHA-384 | |
| 00:0F:AC:18 | OWE | Opportunistic Wireless Encryption. |

**Multiple AKMs** in one IE means the AP supports several modes; the STA picks one in its Association Request. WPA3 transition mode (PSK + SAE) is the common case where downgrade attacks live.

## RSN Capabilities

Two-byte bitmap. Notable bits:

| Bit | Name | Meaning |
|---|---|---|
| 0 | PreAuth | AP supports pre-authentication for fast roaming. |
| 1 | No Pairwise | (Legacy.) |
| 2-3 | PTKSA Replay Counters | |
| 4-5 | GTKSA Replay Counters | |
| 6 | **MFPR** | Management Frame Protection Required. |
| 7 | **MFPC** | Management Frame Protection Capable. |
| 8 | Joint Multi-Band RSNA | |
| 9 | PeerKey Enabled | |
| 10 | Extended Key ID | Per-STA Key ID for transient keys. |
| 11 | OCV (Operating Channel Validation) | Mitigates [FragAttacks](/wiki/attacks/fragattacks/) cross-channel injection. |

A network is **MFP-required** iff `MFPR=1, MFPC=1`. WPA3-Personal mandates MFPR=1.

## RSN IE downgrade

Pre-2020 vulnerability: an attacker rewriting the RSN IE in transit could force a STA / AP into a weaker negotiated state. The Vanhoef + Piessens [KRACK](/wiki/attacks/krack/) work showed the 4-way handshake replays could partially circumvent the IE binding under certain implementations.

Modern fix: every transmission of the RSN IE is structurally compared and binds into MIC. Mismatch aborts the handshake.

## PMKID

The optional PMKID list at the end of the RSN IE in Association Request enables PMKSA caching: "I have a cached PMK for these IDs; skip to PTK derivation." The AP looks up the PMKID; on hit, no full EAP exchange is needed.

**Offensive note.** Steube (hashcat) showed in 2018 that the AP's M1 of the 4-way handshake includes the PMKID — so for WPA2-PSK an attacker can capture M1 *without ever capturing a full handshake* and brute-force the PSK offline. Most APs disable this leak now (`disable_pmksa_caching=1` in hostapd, or PMKID=0 in M1 if not advertised). See `hashcat -m 22000`.

## Group Management Cipher Suite

Last optional 4-byte tuple. Specifies the cipher used for IGTK protection (BIP-CMAC-128 by default; BIP-GMAC for higher security).

## Tooling

- `tshark -V` decodes RSN IE in beacons / probes / association.
- `hostapd.conf`'s `wpa=`, `wpa_pairwise=`, `wpa_key_mgmt=`, `ieee80211w=` map directly to RSN IE fields.
- `wpa_supplicant`'s `ieee80211w=`, `key_mgmt=` likewise.
- `hcxdumptool -m wlan0mon -o capture.pcapng` captures everything needed for `hcxpcapngtool` → `hashcat -m 22000`.

## See also

- [WPA versions](/wiki/concepts/wpa-versions/) — how AKMs map to user-facing modes.
- [Authentication and association](/wiki/concepts/authentication-association/) — where the IE travels.
- [MFP](/wiki/concepts/mfp/) — MFPR/MFPC bits.
- [Handshakes](/wiki/concepts/handshakes/) — IE binding into the 4-way MIC.

## References

- IEEE 802.11-2020 §9.4.2.24 (RSN element).
- Steube — *PMKID-based WPA/WPA2 attack* — <https://hashcat.net/forum/thread-7717.html>
