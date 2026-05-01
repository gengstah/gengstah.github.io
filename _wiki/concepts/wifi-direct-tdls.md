---
title: "Wi-Fi Direct, TDLS, and Wi-Fi Aware (NAN)"
permalink: /wiki/concepts/wifi-direct-tdls/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - p2p
  - wifi-direct
  - tdls
  - nan
---

*Three peer-to-peer Wi-Fi modes that bypass the AP. Wi-Fi Direct (P2P) for ad-hoc groups (printer, screen casting), TDLS for direct STA-to-STA links inside an existing BSS (low-latency LAN), Wi-Fi Aware / NAN for service discovery without an AP at all (AirDrop, Nearby Share).*

**Status:** drafting
**Related:** [Authentication and association](/wiki/concepts/authentication-association/), [Action frames](/wiki/concepts/action-frames/), [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/)

---

## Wi-Fi Direct (P2P)

A Wi-Fi Alliance certification using 802.11 mechanics to form an ad-hoc group:

- One device becomes the **Group Owner (GO)** — runs as a soft-AP.
- One or more other devices are **Clients**.
- The group has a unique SSID (`DIRECT-XX-...`), a passphrase, an internal P2P group ID.

Used for: AirPlay-style screen casting (Miracast), wireless printing, file transfer (Samsung Quick Share, Wi-Fi Direct file transfer), camera-to-phone, remote-control gaming peripherals.

### Pairing

P2P pairing happens via:

- **Push Button** — like WPS PBC; both devices agree to pair within a window.
- **PIN entry** — PIN displayed by one, entered on the other.
- **Persistent groups** — the pair remembers each other and reconnects automatically.
- **Wi-Fi Direct Services** (defined but rarely used).

Pre-2020 implementations had WPS-style weaknesses (predictable PINs, default PIN re-use, no GO authentication). Modern Android and Windows fixed most of these; legacy printers / IoT often haven't.

### Attack surface

- **Trivial impersonation** of a known GO if pairing relied on PIN-only and the PIN was weak / static.
- **Persistent-group leakage** — devices remember the GO's MAC + PSK; an attacker spoofing a known GO's MAC can re-establish the persistent group.
- **Push-button race** — two devices in PBC mode in proximity; an attacker presses-equivalent at the same time and pairs.
- **Driver bugs** — the Wi-Fi Direct stacks (Linux, Android, Windows) historically had parsing flaws on P2P management frames.

## TDLS — Tunneled Direct Link Setup

A direct STA-to-STA link **inside an existing BSS**. Useful when two STAs are physically close to each other but the AP is congested / far. Both STAs must remain associated to the AP; TDLS just adds a side-channel.

### Setup

1. STA-A wants to talk to STA-B directly. STA-A sends a TDLS Setup Request to STA-B *via the AP* (relayed transparently).
2. STA-B replies with TDLS Setup Response.
3. STA-A confirms.
4. Both STAs derive a TDLS Peer Key (TPK) and start exchanging frames directly.
5. Periodic teardown / re-keying as needed.

The AP MAY learn the TDLS link is happening (it sees the setup frames in transit); the AP MAY discover it by overhearing direct frames between STAs. The AP can disable TDLS by stripping the TDLS Capability bit.

### Security

TDLS uses the AKM `00:0F:AC:7` (TDLS) — a separate handshake derives TPK. Modern WPA2/WPA3 stacks pin TPK to the AP's PMK so an attacker cannot stand up a rogue STA-B without the right credentials.

Pre-2017 Linux mac80211 had bugs in TDLS state machines that allowed a STA-A to be tricked into setting up TDLS to a rogue STA-B. KRACK had TDLS variants.

## Wi-Fi Aware / NAN

**Neighbor Awareness Networking** — peer discovery and direct link without any AP. Defined by the Wi-Fi Alliance (NAN spec). Each NAN device joins a NAN cluster on a fixed channel (typically channel 6 in 2.4 GHz, 149 in 5 GHz); the cluster lets devices publish / subscribe to services and form datapaths.

### Used by

- **Apple AirDrop / Continuity** — AirDrop is NAN-based since iOS 10 / macOS 10.12.
- **Google Nearby Share / Quick Share** — Android counterpart.
- **Samsung Quick Share**.
- **Microsoft Phone Link / Connect**.

### Attack surface

NAN frames are Public Action frames. They're observable by anyone in range with a monitor-mode radio. Apple AirDrop in particular has been the subject of:

- **Receiver enumeration** — broadcast NAN service discovery beacons reveal which Apple devices are nearby and which are AirDrop-discoverable.
- **Hash collision / brute force** of the AirDrop "contact only" mode — phone numbers / emails are hashed but the search space is small enough to brute-force from observed broadcasts. Disclosed by TU Darmstadt 2019 + Heinrich et al.
- **AppleSetupDone-style provisioning** — accidental MITM during initial NAN handshake.

Nearby Share / Quick Share have similar surfaces though less publicly studied.

## Tooling

- `wpa_cli p2p_find` / `p2p_connect` — Linux Wi-Fi Direct.
- `iw dev wlan0 station dump` shows TDLS peers.
- **OWL / OWLink** (TU Darmstadt) — open implementation of Apple Wireless Direct Link.
- `nan-discovery` proof-of-concepts in research code.

## See also

- [Authentication and association](/wiki/concepts/authentication-association/) — TDLS reuses standard auth machinery.
- [Action frames](/wiki/concepts/action-frames/) — NAN, Wi-Fi Direct, TDLS Setup all live in vendor-specific Public Action.
- [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/) — NAN broadcasts share fingerprintability concerns.

## References

- Wi-Fi Alliance — *Wi-Fi Direct Specification v2.x*.
- IEEE 802.11-2020 §11.21 (TDLS).
- Heinrich et al. — *AirDrop, Vulnerabilities and Privacy* — TU Darmstadt 2019 — <https://www.usenix.org/system/files/sec21-heinrich.pdf>
- *Open Wireless Link (OWL)* — <https://owlink.org/>
