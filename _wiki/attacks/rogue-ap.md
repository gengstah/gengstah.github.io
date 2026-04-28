---
title: Rogue AP (WPA3-SAE clone)
permalink: /wiki/attacks/rogue-ap/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- attack
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/attacks/rogue-ap/
---

# Rogue AP

> Layer: **Wi-Fi encryption** · Section: **NDSS'26 §IV-A** · Mode: **WPA2-PSK / WPA3-SAE**

## What it is

The WPA3 cousin of [machine-on-the-side](/wiki/attacks/machine-on-the-side/). With WPA3-SAE, the [PMK](/wiki/concepts/wifi-key-hierarchy/#pmk--pairwise-master-key) is derived per session via the Dragonfly handshake and **cannot** be derived passively from another client's handshake. So observing the air buys you nothing. But the **passphrase is still shared**. So an attacker who knows the passphrase can simply:

1. Stand up a clone of the AP, advertising the same SSID with the same passphrase.
2. Convince the victim to associate to the clone instead of the real AP.
3. From inside the clone, the attacker is just an AP — it sees and can modify the victim's traffic.

The clone is a fully legitimate party in the WPA3 sense. The Dragonfly handshake will succeed because the passphrase matches. MFP on the victim's end-of-the-air won't help — the rogue AP is the new AP.

## Inducing roam

Just standing up a clone next to the real AP doesn't automatically capture clients — they have to switch to it. Three induction methods (NDSS'26 §IV-A, citing Schepers et al. 2022 and Vanhoef & Pöpper 2020):

- **Stronger signal.** If the rogue AP's signal is louder than the real one for the victim, most clients will roam preferentially.
- **Spoofed (malformed) channel-switch announcement beacons.** Even with MFP — beacons aren't protected at WPA2/SAE level (only at WPA3 BIGTK level, which most networks don't enable). A CSA telling the client "we're moving to channel X now" with X = the rogue AP's channel will work.
- **Disassociation flood** if MFP is off; not directly applicable to WPA3-SAE because WPA3 mandates MFP, but useful for WPA2-PSK clients.

## Why client isolation doesn't help

[Client isolation](/wiki/concepts/client-isolation/) is enforced *on the AP*. Once the victim is associated to a different AP — the attacker's — there's no isolation to enforce. The attacker is an AP, not a peer.

## What this defeats

- WPA3-Personal (SAE).
- WPA2-Personal (PSK), as a fallback to machine-on-the-side when the attacker prefers an in-path position.

## What this does *not* defeat

- WPA2-Enterprise / WPA3-Enterprise — *if the client validates the RADIUS server certificate*. A misconfigured client (no CA pinning, no server name checking) can still be tricked, but at that point the rogue-AP attack has degraded to "the client trusts any RADIUS server" which is its own bug.
- **WPA3-PK (Public Key).** The "passphrase" is derived from a public key whose private counterpart lives on the AP. The clone can't perform the SAE handshake without the private key. (NDSS'26 §IV-A; Vanhoef & Robben 2024 cited there.)

## What it does to the network

Once the victim is connected to the rogue AP, the attacker is a full machine-in-the-middle for that victim — strictly stronger than what AirSnitch's other attacks achieve. The downside for the attacker is that it requires either a higher-power radio than the real AP or careful use of CSA beacons; AirSnitch's other attacks don't need to fight RF.

## What stops it

- **Move to WPA3-PK.** Best fix for "shared passphrase but resistant to clones".
- **Move to WPA-Enterprise** with proper RADIUS server certificate validation on every client (CA pinning + identity match).
- **MFP + Beacon Protection (WPA3 BIGTK)** raises the bar on CSA/disassoc induction — clients should refuse channel switches not signed by the AP they're already associated to. Adoption is patchy.
- **Client-side rogue AP detection** — many enterprise wireless controllers do this with neighbour-AP scanning and triangulation. Outside scope of AirSnitch's paper.

## CLI

No direct AirSnitch test. Standard tooling:

- `hostapd` configured with the target SSID + passphrase, on a USB Wi-Fi card.
- `dnsmasq` or similar to hand out DHCP and DNS.
- `mdk4` or custom Scapy for CSA beacon injection.

The paper notes this works against all seven home APs they tested for the dissociation-and-induce flow (NDSS'26 §VII-D).

## See also

- [Machine-on-the-side](/wiki/attacks/machine-on-the-side/)
- [WPA versions](/wiki/concepts/wpa-versions/)
- [Documentation defence](/wiki/defenses/documentation/) — vendors should warn that client isolation is meaningless under shared passphrases.
