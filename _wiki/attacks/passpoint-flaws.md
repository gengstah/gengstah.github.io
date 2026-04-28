---
title: Passpoint Flaws — Forcing the Real GTK
permalink: /wiki/attacks/passpoint-flaws/
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
- /wiki/airsnitch/attacks/passpoint-flaws/
---

# Passpoint Flaws

> Layer: **Wi-Fi encryption** · Section: **NDSS'26 §IV-B-2** · CLI: not directly testable yet (manual / `--c2c-gtk-inject` after triggering)

## What it is

[Passpoint DGAF Disable](/wiki/concepts/passpoint/) is supposed to give every client a **unique random GTK** so [GTK abuse](/wiki/attacks/abusing-gtk/) doesn't work. The catch: DGAF Disable only mandates randomization in the **4-way handshake**. Every other handshake that delivers a GTK was overlooked in the spec. AirSnitch attacks that gap.

There are two sub-flaws, distinguished by which key is the lever:

- **Non-randomized GTK in non-4-way handshakes.** The spec doesn't require randomization in the [group-key handshake](/wiki/concepts/handshakes/#group-key-handshake), [FT](/wiki/concepts/handshakes/#fast-bss-transition-ft-handshake-ieee-80211r), [FILS](/wiki/concepts/handshakes/#fast-initial-link-setup-fils-handshake-ieee-80211ai), or [WNM-Sleep Response](/wiki/concepts/handshakes/#wnm-sleep-request--response-ieee-80211v). So even when DGAF Disable is honoured at association, the *real* shared GTK leaks during any of these later events.
- **Non-randomized [IGTK](/wiki/concepts/wifi-key-hierarchy/#igtk--integrity-group-temporal-key).** Even if every GTK delivery is randomized, the shared IGTK lets an attacker forge broadcast management frames.

## Sub-flaw 1: get the real GTK via a later handshake

Three reliable triggers, no waiting required:

| Trigger | Mechanism |
| --- | --- |
| **Periodic GTK rotation** | APs typically rotate GTK every hour. Wait one hour. The group-key handshake delivers the *real, shared* new GTK to every client, including the attacker. |
| **Spoofed BSS Transition Request** | Tell the victim to roam to another AP in the same Mobility Domain. The victim performs an FT handshake with that AP. The FT handshake delivers the *real, shared* GTK. |
| **Spoofed deauth + reassoc on a FILS-enabled network** | Same effect via FILS. |

Once the attacker holds the shared GTK, they switch to standard [GTK abuse](/wiki/attacks/abusing-gtk/).

## Sub-flaw 2: install an attacker-chosen GTK via forged WNM-Sleep Response

The most surprising of the two. Walkthrough:

1. The attacker associates as a normal client. Receives the per-client randomized GTK (correct DGAF behaviour) and the shared IGTK (the spec doesn't randomize this).
2. The attacker constructs a **broadcast WNM-Sleep Response frame**, authenticated using the shared IGTK. The frame carries a *new GTK chosen by the attacker*.
3. The attacker transmits the broadcast WNM-Sleep Response. Most clients ignore it because they're not waiting for a sleep response. The victim — if the attacker first prompts a WNM-Sleep Request, or just opportunistically — accepts it and **installs the attacker-chosen GTK**.
4. The attacker now sends GTK-encrypted broadcast frames carrying unicast IP payloads. The victim decrypts under the attacker's GTK and accepts the embedded unicast packets.

(NDSS'26 §IV-B-2.)

The 802.11 standard does not prohibit a broadcast receiver address on a WNM-Sleep Response; AirSnitch found that all the OSes they tested process such a frame.

## Why this is a Passpoint design flaw rather than an implementation bug

The Passpoint specification only says the 4-way handshake's GTK must be unique-random per client. It is silent on every other GTK-bearing handshake and on IGTK. Implementations that follow the spec to the letter are vulnerable.

## What's been fixed

- **Wi-Fi Alliance Passpoint v3.4** (2026): mandates IGTK randomization. Sub-flaw 2 is closed *for spec-compliant v3.4 implementations*. (NDSS'26 §VIII-D.) Most deployed APs are not yet v3.4.
- The other GTK-delivering handshakes (group-key, FT, FILS, WNM-Sleep) are **not yet fixed in the spec** as far as the AirSnitch authors document. Re-check on next ingest.

## What stops it (without waiting for the spec)

- **Vendor patches that randomize GTK in every handshake.** LANCOM has added an option for this (NDSS'26 §VIII-D). Other vendors are evaluating.
- **VLANs per BSSID with `gtk-per-vlan`.** Limits the radius of any leaked GTK.
- **MACsec.** Independent of all Wi-Fi key management.
- **Filtering unicast IP in L2 broadcast** at the OS (`drop_unicast_in_l2_multicast=1` on Linux). Same partial mitigation as for direct GTK abuse — only IPv4.

## How AirSnitch tests it (today)

There is no end-to-end CLI flag for this attack chain in the repo as of April 2026. The components exist:

- Trigger a handshake that leaks the shared GTK (BSS Transition Request injection).
- Use `--check-gtk-shared` to confirm the GTKs are the same after the trigger.
- Use `--c2c-gtk-inject` to confirm the OS accepts the resulting injection.

Listed under [README §5.3 "Manual tests"](/wiki/tools/airsnitch-cli/#manual-tests) as a possible future addition: "Testing whether the IGTK group key is randomized under client isolation."

## See also

- [Passpoint](/wiki/concepts/passpoint/) — the spec being attacked.
- [Handshakes](/wiki/concepts/handshakes/) — what each handshake delivers.
- [Abusing GTK](/wiki/attacks/abusing-gtk/) — what to do once you hold the real GTK.
- [Group key randomization](/wiki/defenses/group-key-randomization/)
