---
title: "OWE — Opportunistic Wireless Encryption (Enhanced Open)"
permalink: /wiki/concepts/owe/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - owe
  - open
---

*"Open" Wi-Fi without authentication, but encrypted on the air. RFC 8110. Wi-Fi Alliance brands it "Enhanced Open". The replacement for the cafe / airport / hotel SSID where you don't want a password but do want passive sniffing protection.*

**Status:** drafting
**Related:** [WPA versions](/wiki/concepts/wpa-versions/), [Authentication and association](/wiki/concepts/authentication-association/), [Rogue AP](/wiki/attacks/rogue-ap/), [Captive portals](/wiki/concepts/owe/)

---

## What it is

OWE replaces the open authentication step of an "open" SSID with an unauthenticated **Diffie-Hellman exchange**. The result is a per-session PMK; the rest of the stack (4-way handshake, PTK derivation, CCMP/GCMP) runs as usual.

```
STA                            AP
 │── Auth (algo=Open) + DH pubkey IE ──►
 │  ◄── Auth (algo=Open) + DH pubkey IE ──
 │
 │ both sides derive shared secret → PMK
 │
 │── Assoc Req ──►
 │  ◄── Assoc Resp ──
 │
 │ 4-way handshake using OWE-derived PMK
 │
 │── data (encrypted) ──►
```

DH groups: P-256 (default), P-384, P-521.

## What it does and doesn't defend

**Defends against**:

- Passive sniffing of L2 traffic (the entire point).
- Most "free Wi-Fi sniffing" by anyone-with-Wireshark in a coffee shop.

**Does not defend against**:

- **Active man-in-the-middle.** No authentication of either party — anyone can stand up a rogue AP with the same SSID, accept OWE associations from victim STAs, and proxy. From the STA's perspective the connection is "encrypted" but the encryption peer is the attacker.
- **DNS / TLS attacks** the layers above.
- **Passpoint / Hotspot 2.0 captive-portal flows** that follow OWE association.

OWE is an honest "encrypted but unauthenticated" guarantee. It's strictly better than open, strictly weaker than WPA-Personal.

## OWE Transition mode

A trick to deploy OWE alongside legacy "open" without disrupting old clients. The AP runs **two** SSIDs:

- The visible SSID (e.g. `CafeWiFi`) is still open / unencrypted; legacy clients connect normally.
- A *hidden* SSID (random / vendor-chosen, e.g. `CafeWiFi_OWE_xxxx`) runs OWE. The visible SSID's beacons advertise an `OWE Transition Mode IE` pointing to the hidden BSSID.
- Modern clients see the OWE pointer, switch to the hidden SSID, and use OWE.

**Trade-off.** During transition, an attacker can detect transition-aware clients (they probe for the hidden SSID) and force them to fall back to the open SSID by spoofing channel-busy / dropped OWE.

## How it appears in the field

- **Wi-Fi 6E / Wi-Fi 7** — WPA3 is mandatory on 6 GHz, and "Enhanced Open" is the equivalent for unauthenticated networks. Some 6 GHz deployments use OWE-only.
- **Apple iOS, Android 10+, Windows 10 1903+, modern macOS** all support OWE.
- **Many consumer routers** (ASUS, NETGEAR, Linksys, Eero) ship OWE as a guest-network option.
- **Carrier hotspot offload** sometimes mandates OWE alongside Passpoint.

## Operational implications for offence

| Concern | Notes |
|---|---|
| Rogue AP / KARMA | OWE adds *zero* protection against rogue AP. Same SSID + same OWE = same victim association. |
| Passive sniffing | Defeated by OWE — no longer a free win. |
| Cracking | No PSK to crack. |
| Downgrade | OWE-Transition lets an attacker steer modern clients to the open SSID; combine with KARMA. |

For a red team operator, OWE means the cafe-Wi-Fi MITM stack has shifted from "passive PSK-cracking" to "active rogue-AP" — slightly louder, but still effective.

## See also

- [WPA versions](/wiki/concepts/wpa-versions/) — OWE sits alongside WPA2-PSK / WPA3-SAE / Enterprise as a fourth column.
- [Authentication and association](/wiki/concepts/authentication-association/).
- [Rogue AP](/wiki/attacks/rogue-ap/) — the residual surface.

## References

- RFC 8110 — *Opportunistic Wireless Encryption*.
- Wi-Fi Alliance — *Enhanced Open* certification — <https://www.wi-fi.org/discover-wi-fi/wi-fi-enhanced-open>.
