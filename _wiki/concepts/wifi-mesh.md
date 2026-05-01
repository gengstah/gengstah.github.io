---
title: "Wi-Fi Mesh (802.11s) and Vendor Mesh"
permalink: /wiki/concepts/wifi-mesh/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mesh
  - 80211s
---

*Multi-hop Wi-Fi where the radios route for themselves. Two flavours coexist: the IEEE-standard 802.11s (rare in consumer) and the consumer-mesh stacks (Eero, Google Wifi, Asus AiMesh, NETGEAR Orbi) that do mostly the same thing in vendor-specific dialect.*

**Status:** drafting
**Related:** [Authentication and association](/wiki/concepts/authentication-association/), [Action frames](/wiki/concepts/action-frames/), [BSSID / SSID / ESS](/wiki/concepts/bssid-ssid-ess/)

---

## What mesh adds

A standard ESS has APs with wired backhaul. In a mesh:

- Each Mesh Point (MP) speaks Wi-Fi to clients **and** to other MPs.
- Frames flow across multiple wireless hops. The mesh routes them.
- One or more **Mesh Portals (MPP)** bridge to wired infrastructure or the internet.
- Designed for: dense WLANs without enough Ethernet runs, residential whole-home coverage, ad-hoc emergency networks.

## 802.11s

IEEE-standard mesh, ratified 2011. Operating concepts:

- **Mesh ID** instead of (or alongside) SSID — identifies the mesh.
- **Peering** — two Mesh Peering Open / Confirm exchanges between MPs to establish a peer link.
- **HWMP** (Hybrid Wireless Mesh Protocol) — the default routing protocol. Combines tree-based proactive (root portal) with on-demand AODV-style discovery.
- **Mesh Beaconing** — MPs beacon the Mesh ID; collisions resolved via TBTT adjustment.
- **Encryption** uses **SAE** (yes — SAE was originally specified for 11s mesh peer auth, *then* repurposed for WPA3-Personal) plus per-link AES-CCMP.

802.11s is the substrate for `mac80211_hwsim`-based research, embedded mesh radios (e.g. some industrial ISM / battlefield comms), and a handful of vendor mesh products (some Aruba, some Ubiquiti).

### Why 11s isn't widespread in consumer

Most consumer mesh (Eero, Orbi, Google Wifi) doesn't use 802.11s. They use:

- **Dedicated 5/6 GHz backhaul** between nodes.
- **Vendor proprietary protocols** for routing decisions.
- **Standard WPA2/WPA3** for client connections.
- **Wired/Ethernet uplink** when available, falling back to wireless.

The marketing "mesh" maps to "many APs cooperating with a controller", not to 802.11s.

## Consumer mesh attack surface

For consumer mesh products, the attack surface usually breaks into:

| Surface | Notes |
|---|---|
| Cloud control plane | Most consumer-mesh stacks register with a vendor cloud for setup / OTA / app control. Cloud account compromise → router pwn. |
| Mobile app pairing | Bluetooth + Wi-Fi onboarding; some vendors had no auth on first-boot pairing (e.g. early Google Wifi). |
| Backhaul auth | Some vendors used static or weakly-derived keys for inter-node Wi-Fi — cracked once, every-customer's-mesh-decryptable forever. |
| Web management | LAN-side admin UI; CSRF, default creds, command injection on `ping` / `traceroute` features. |
| Firmware update | Auto-updating firmware that doesn't validate signatures — supply-chain shenanigans. |

This is a separate world from on-air 802.11 attacks; it's mostly traditional consumer router pen testing.

## 802.11s attack surface

Less-studied because deployment is sparse. Known classes:

- **SAE peer-auth flaws** — pre-Hash-to-Curve 11s mesh inherited [Dragonblood](/wiki/attacks/dragonblood/).
- **HWMP injection** — routing protocol messages were unauthenticated in early implementations; spoofed PERR / PREQ could blackhole traffic.
- **Mesh ID confusion** — analogous to [SSID confusion](/wiki/attacks/ssid-confusion/) but on Mesh ID.

## Detection / observation

- Beacons from MPs include a `Mesh ID` IE (tag 114) and `Mesh Configuration` IE (tag 113).
- HWMP frames are Action frames in the Mesh category (category 13).
- `iw` lets Linux mac80211 join an 802.11s mesh — `iw dev wlan0 mesh join MyMesh`.

## Modern direction

Wi-Fi 7 doesn't prescribe a new mesh protocol but the EasyMesh R3 / R4 specifications from the Wi-Fi Alliance are converging consumer mesh on a shared spec — interoperable mesh between vendors. The security model still leans on standard WPA3 plus a vendor-defined cloud control plane.

## See also

- [Authentication and association](/wiki/concepts/authentication-association/) — peer-to-peer auth in 802.11s borrows the auth-frame mechanics.
- [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/) — 11s's peer-link auth.
- [Wi-Fi Direct and TDLS](/wiki/concepts/wifi-direct-tdls/) — other peer-to-peer Wi-Fi modes.

## References

- IEEE 802.11s-2011 (folded into 802.11-2020 §14).
- Wi-Fi Alliance — *EasyMesh Specification* — <https://www.wi-fi.org/discover-wi-fi/wi-fi-easymesh>.
