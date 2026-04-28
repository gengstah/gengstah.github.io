---
title: Group Key Randomization
permalink: /wiki/airsnitch/defenses/group-key-randomization/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
updated: 2026-04-28
---

The cleanest single fix to [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/), [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/), and the [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/) attack chain. The principle: **stop sharing the GTK between clients.** Give every client its own random GTK. Translate broadcast traffic that genuinely needs to reach all clients (ARP, DHCP, ND, mDNS) into multiple per-client unicasts at the AP.

This is the defence Passpoint introduces under the name *DGAF Disable* (Downstream Group-Addressed Forwarding Disable). It works — when implemented in *every* GTK-bearing handshake. AirSnitch's contribution is showing that the Passpoint spec, until v3.4, only required it in the 4-way handshake (NDSS'26 §IV-B-2 and §VIII-C).

## What complete coverage looks like

A correctly random-GTK implementation gives each client a unique GTK in:

- [4-way handshake](/wiki/airsnitch/concepts/handshakes/#4-way-handshake) ✓ (Passpoint mandated this from the start)
- [Group-key handshake](/wiki/airsnitch/concepts/handshakes/#group-key-handshake) ✓ (must be added — used for periodic rotation)
- [FT handshake](/wiki/airsnitch/concepts/handshakes/#fast-bss-transition-ft-handshake-ieee-80211r) ✓ (must be added — triggered by roaming or spoofed BSS Transition Request)
- [FILS handshake](/wiki/airsnitch/concepts/handshakes/#fast-initial-link-setup-fils-handshake-ieee-80211ai) ✓ (must be added)
- [WNM-Sleep Response](/wiki/airsnitch/concepts/handshakes/#wnm-sleep-request--response-ieee-80211v) ✓ (must be added)

And **also**: random per-client [IGTK](/wiki/airsnitch/concepts/wifi-key-hierarchy/#igtk--integrity-group-temporal-key). The IGTK is shared by default and lets an attacker forge broadcast management frames (specifically, a broadcast WNM-Sleep Response that installs an attacker-chosen GTK). Wi-Fi Alliance Passpoint v3.4 fixed this in 2026 (NDSS'26 §VIII-D).

## The translation half

If you randomize the GTK, broadcasts no longer have a key everyone can decrypt. So the AP has to *translate* broadcast traffic that's genuinely needed:

- **ARP** → Proxy ARP. The AP answers ARP queries on behalf of clients using its own ARP table.
- **DHCP** → AP relays unicast.
- **IPv6 Neighbour Discovery, Router Advertisements** → AP translates / suppresses depending on the network design.
- **mDNS / SSDP / Bonjour** → either drop, or relay via a service-specific gateway. Disable by default in guest networks.

Without these translations, randomizing the GTK breaks normal connectivity. With them, the network keeps working and the [shared-GTK attacks](/wiki/airsnitch/attacks/abusing-gtk/) lose their footing.

## Per-VLAN GTK as a partial measure

Some equipment (Cambium's `gtk-per-vlan` option is the canonical example, NDSS'26 §VIII-C) supports a unique GTK *per VLAN* without going as far as per-client. This is a useful intermediate step:

- A guest-VLAN GTK is no longer shared with the main-VLAN clients, so a guest-side insider can't broadcast-inject into the main VLAN.
- Within the guest VLAN, [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/) still works between guests. If you also need intra-VLAN isolation, you still need per-client randomization.

## What it doesn't fix

Group key randomization is a **Wi-Fi encryption layer** defence. It does nothing about:

- [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) — pure L3.
- [Port Stealing](/wiki/airsnitch/attacks/port-stealing/) — exploits the bridge FDB after decryption.
- [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/), [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) — exploit the shared passphrase, not the GTK.

## Vendor status (as of NDSS'26 disclosure cycle)

- **Wi-Fi Alliance Passpoint v3.4** — IGTK randomization mandated.
- **LANCOM** — added an option to randomize group keys (NDSS'26 §VIII-D).
- **Ubiquiti** — evaluating mitigations.
- **D-Link** — provided test devices for validation.
- Most consumer router vendors had not shipped a fix at the time of paper publication. Re-check on next ingest.

## How to verify

```
sudo ./airsnitch.py wlan2 --check-gtk-shared wlan3 --no-ssid-check --same-bss
sudo ./airsnitch.py wlan2 --check-gtk-shared wlan3 --no-ssid-check --other-bss
```

If GTKs differ, the **4-way handshake** is randomized. Re-run after waiting for a GTK rotation, or after triggering FT/FILS/WNM-Sleep, to verify those handshakes also randomize.

(README §4.1.)

## See also

- [Passpoint](/wiki/airsnitch/concepts/passpoint/) — the spec.
- [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/), [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/), [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/) — the attacks this fixes.
- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/)
