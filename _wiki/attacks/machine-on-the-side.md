---
title: Machine-on-the-Side (WPA2-PSK passphrase derive)
permalink: /wiki/attacks/machine-on-the-side/
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
- /wiki/airsnitch/attacks/machine-on-the-side/
---

# Machine-on-the-Side

> Layer: **Wi-Fi encryption** · Section: **NDSS'26 §IV-A** · Mode: **WPA2-PSK only**

## What it is

A pre-existing, well-known result, included in the AirSnitch attack catalogue for completeness. With **WPA2-PSK**, the [PMK](/wiki/concepts/wifi-key-hierarchy/#pmk--pairwise-master-key) is derived purely from the passphrase and the SSID, and is therefore **identical for every client on the network**. Any insider who knows the passphrase can:

1. Sniff a target client's [4-way handshake](/wiki/concepts/handshakes/#4-way-handshake) (the four EAPOL frames carry ANonce, SNonce, MAC addresses, and a MIC).
2. Compute that client's [PTK](/wiki/concepts/wifi-key-hierarchy/#ptk--pairwise-transient-key) = `PRF(PMK, ANonce || SNonce || AP MAC || STA MAC)`.
3. Decrypt and inject that client's unicast traffic, off-AP, over the air.

Robert Moskowitz first wrote this up in 2003 ("Weakness in Passphrase Choice in WPA Interface"). The AirSnitch paper revisits it in §IV-A to make explicit that it **trivially bypasses [client isolation](/wiki/concepts/client-isolation/)** — the AP never sees the attacker's traffic at all.

## Capturing the handshake

If the victim is already associated when the attacker arrives, the attacker spoofs a deauthentication frame (no MFP → unauthenticated, accepted) to force the victim to redo the 4-way handshake. The four EAPOL frames go over the air in the clear; the attacker captures them, computes the PTK.

If MFP is on, deauth is authenticated and can't be spoofed. The attacker waits for a natural disconnect or uses a channel-switch beacon trick (NDSS'26 §IV-A, citing Vanhoef & Pöpper 2020).

## Why this is "machine-on-the-side"

A "machine-in-the-middle" sits in the data path. A "machine-on-the-side" doesn't — it observes traffic over the air and injects forged traffic into it, without ever being a forwarding hop. With WPA2-PSK and a derived PTK, the attacker can do both observation and injection without needing the AP's cooperation.

## What this defeats

- WPA2-Personal client isolation, full stop. The AP can refuse to forward client-to-client traffic; it doesn't matter. The attacker is a peer of the AP for that victim's PTK.
- Any L2/L3 isolation that depends on the AP being in the data path. The attacker bypasses the AP.

## What this does *not* defeat

- WPA2-Enterprise (per-user PMK).
- WPA3-SAE (Dragonfly-derived PMK with forward secrecy — passive sniffing yields nothing useful).
- WPA3-Enterprise.
- WPA3-PK.

So the trivial fix is *don't use WPA2-PSK if you care about client isolation*. The AirSnitch authors' framing: client isolation in any shared-passphrase network is "fundamentally flawed" (NDSS'26 §IV-A header).

## CLI

There is no AirSnitch test for this directly — the technique predates AirSnitch and is publicly available in tools like `aircrack-ng`. The paper notes this in §IV-A: "it is well-known that a Machine-on-the-Side attacker who possesses the WPA2 passphrase can intercept handshake messages".

For verification on your own network, the standard recipe is:

1. `airodump-ng` the target BSSID, write a pcap.
2. `aireplay-ng --deauth` the victim if you don't see a handshake quickly.
3. `aircrack-ng -p <passphrase> -e <SSID> capture.pcap` to derive the victim's PTK.
4. `tshark`/Scapy to decrypt unicast frames using the PTK.

## What stops it

- Move off WPA2-PSK. WPA3-SAE (Personal mode) is the simplest upgrade that preserves the "shared passphrase" UX; per-device PSK / PPSK is a stronger alternative.
- WPA-Enterprise eliminates the shared-PMK problem entirely.
- **Client isolation does not stop this attack.** Important to flag in vendor documentation, per NDSS'26 §VIII-D ("When enabling client isolation in an open network, or a network with a shared WPA password, give a warning that this provides no security benefit.").

## See also

- [WPA versions](/wiki/concepts/wpa-versions/) — which modes are vulnerable.
- [Rogue AP](/wiki/attacks/rogue-ap/) — the WPA3 cousin (shared passphrase, different exploitation path).
- [Documentation defence](/wiki/defenses/documentation/)
