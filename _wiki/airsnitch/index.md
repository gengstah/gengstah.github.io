---
title: "AirSnitch — Index"
permalink: /wiki/airsnitch/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
---

*Subsection catalog for the AirSnitch ingest. Parent index: [/wiki/](/wiki/).*

**Status:** drafting
**Source:** [NDSS'26 paper](/wiki/airsnitch/sources/ndss2026-paper/), [AirSnitch upstream README](/wiki/airsnitch/sources/airsnitch-readme/).

## Top of the wiki

- [overview](/wiki/airsnitch/overview/) — one-page tour of AirSnitch and the eight attacks.

## Attacks

The eight techniques AirSnitch implements, plus the auxiliary helpers that turn interception into stable MitM.

- [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) — inject unicast IP via GTK-encrypted broadcast (NDSS'26 §IV-B).
- [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) — bounce a packet via the gateway to reach a "MAC-isolated" client (§V-A).
- [Port Stealing](/wiki/airsnitch/attacks/port-stealing/) — poison the AP's bridge FDB to redirect victim traffic, downlink and uplink (§V-B).
- [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) — `ToDS=1, addr3=ff:ff:..` makes the AP re-encrypt under the victim's GTK (§V-C).
- [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/) — WPA2-PSK passphrase derives any victim's PTK (§IV-A).
- [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) — clone a WPA3-SAE network and induce victims to roam (§IV-A).
- [Passpoint Flaws](/wiki/airsnitch/attacks/passpoint-flaws/) — get the real GTK via FT/FILS/group-key/WNM-Sleep handshakes (§IV-B-2).
- [Auxiliary Techniques](/wiki/airsnitch/attacks/auxiliary-techniques/) — server-/client-triggered port restoration, Inter-NIC relaying (§VI-A, §VII-G).

## Concepts

Background needed to read the attack pages.

- [Client Isolation](/wiki/airsnitch/concepts/client-isolation/) — what the feature is supposed to be.
- [Wi-Fi Key Hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/) — PMK/PTK/GMK/GTK/IGTK/BIGTK and what each one enables.
- [Handshakes](/wiki/airsnitch/concepts/handshakes/) — 4-way, group-key, FT, FILS, WNM-Sleep — and which ones leak GTK.
- [BSSID, SSID, and ESS](/wiki/airsnitch/concepts/bssid-ssid-ess/) — terminology behind `--same-bss` / `--other-bss`.
- [Virtual Ports](/wiki/airsnitch/concepts/virtual-ports/) — the abstraction port stealing exploits.
- [Passpoint](/wiki/airsnitch/concepts/passpoint/) — the only spec that tries to enforce client isolation at L2.
- [WPA Versions](/wiki/airsnitch/concepts/wpa-versions/) — Personal/Enterprise/SAE/PK and what they buy you.
- [RADIUS](/wiki/airsnitch/concepts/radius/) — the AP↔auth-server protocol AirSnitch's §VII-G case study attacks.
- [Management Frame Protection (MFP / 802.11w)](/wiki/airsnitch/concepts/mfp/) — how IGTK enters the picture.

## Defences

- [Defences — Index and Matrix](/wiki/airsnitch/defenses/index/) — defence-vs-attack matrix and recommended baseline.
- [Group Key Randomization](/wiki/airsnitch/defenses/group-key-randomization/) — the cleanest single fix for GTK-layer attacks.
- [VLANs and Firewall Rules](/wiki/airsnitch/defenses/vlans/) — the most practical fix for cross-domain attacks.
- [MAC and IP Spoofing Prevention](/wiki/airsnitch/defenses/spoofing-prevention/) — what's missing from most APs.
- [Filter Unicast IP in L2 Broadcast](/wiki/airsnitch/defenses/filter-unicast-in-broadcast/) — Linux sysctl, partial mitigation.
- [MACsec](/wiki/airsnitch/defenses/macsec/) — single most powerful defence; deployment cost.
- [Centralised Wi-Fi Decryption](/wiki/airsnitch/defenses/centralized-decryption/) — controller-managed alternative.
- [Documentation and Warnings](/wiki/airsnitch/defenses/documentation/) — the deployment-layer fix.

## Tools — the AirSnitch tool itself

- [airsnitch.py — CLI Reference](/wiki/airsnitch/tools/airsnitch-cli/) — all flags.
- [Repo Layout](/wiki/airsnitch/tools/repo-layout/) — where each file lives.
- [Configuration Files](/wiki/airsnitch/tools/configurations/) — `client.conf`, `eap.conf`, `multipsk.conf`, `saepk.conf`.
- [Setup Scripts and the Simulated Testbed](/wiki/airsnitch/tools/setup-scripts/) — reproduce attacks without hardware.

## Devices

- [Tested Devices and Findings](/wiki/airsnitch/devices/tested-devices/) — Tables I–III digest.

## Sources

Provenance pages — one per ingested raw source.

- [NDSS'26 paper](/wiki/airsnitch/sources/ndss2026-paper/) — primary academic source.
- [AirSnitch upstream README](/wiki/airsnitch/sources/airsnitch-readme/) — user-facing operator's manual.

## Stats

| Section | Pages |
| --- | --- |
| Top | 1 |
| Attacks | 8 |
| Concepts | 9 |
| Defences | 8 |
| Tools | 4 |
| Devices | 1 |
| Sources | 2 |
| **Total** | **33** |
