---
title: "Framing Frames / MacStealer — Bypassing Wi-Fi Encryption via Transmit Queues"
permalink: /wiki/attacks/framing-frames/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - power-save
  - transmit-queue
  - client-isolation
  - schepers
  - vanhoef
---

*Manipulate an AP's transmit queue and its security context with the unauthenticated power-save bit. The result: queued frames leak plaintext, encrypted under the group key, or even under an all-zero key. Includes MacStealer — a single-BSSID downlink port-stealing attack.*

**Status:** drafting
**Venue:** USENIX Security 2023
**Authors:** Domien Schepers (Northeastern), Aanjhan Ranganathan (Northeastern), Mathy Vanhoef (KU Leuven imec-DistriNet)
**Related:** [Client Isolation](/wiki/concepts/client-isolation/), [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Handshakes](/wiki/concepts/handshakes/), [AirSnitch](/wiki/concepts/airsnitch-overview/), [Port Stealing](/wiki/attacks/port-stealing/), [KRACK](/wiki/attacks/krack/)

---

## What it is

Wi-Fi APs queue downstream frames at multiple stack layers — kernel transmit queues, hardware ring buffers, the per-client power-save buffer used when a station is asleep. The 802.11 standard says nothing explicit about how to manage the **security context** of those buffered frames as keys rotate (rekey, reassociation, roam). The paper investigates the resulting ambiguity and finds three distinct ways to extract plaintext from the queue.

The unauthenticated **power-save bit** in the frame header is the lever. An attacker can spoof a frame from the victim with the power-save bit set; the AP buffers subsequent downstream frames for the "sleeping" victim. By later toggling the bit and triggering re-encryption, the attacker can choose what key the AP encrypts the buffer under.

---

## The three primary results

1. **Plaintext leaks from the queue.** When a station deauthenticates and reauthenticates without proper queue management, the AP can be tricked into transmitting buffered frames *in plaintext* to a (now-attacker-controlled) MAC.
2. **Group-key downgrade on queued frames.** The AP re-encrypts buffered unicast frames under the **GTK** instead of the pairwise key, so any insider on the BSSID can decrypt them. Variant: under an **all-zero key**, when key state has been wiped but the queue hasn't been flushed.
3. **MacStealer — single-BSSID downlink port stealing.** By spoofing the victim's MAC during a window the AP considers "the same client", the attacker has the AP forward downstream frames to the attacker. Variant of classic port stealing, scoped to one BSSID. (CVE-2022-47522.)

The fundamental design flaw: an unprotected one-bit signal in the frame header can change how the AP routes and encrypts a queue's worth of data.

---

## How to think about it

Reading this paper alongside [AirSnitch](/wiki/concepts/airsnitch-overview/) (NDSS 2026) and [FragAttacks](/wiki/attacks/fragattacks/) (USENIX 2021): all three say the same thing differently — *Wi-Fi keeps stuffing security-relevant decisions into unauthenticated framing fields.* Power-save bit. A-MSDU flag. SSID. Each one is the next chapter of the same book.

MacStealer in particular is the *single-BSSID downlink* case that AirSnitch later generalized to multi-BSSID, uplink, and inter-AP scenarios — see the AirSnitch [Port Stealing](/wiki/attacks/port-stealing/) page.

---

## What stops it

- **Per-key queue flushes.** Drivers patched to drop buffered frames whenever the security context changes (rekey, reassociation, key wipe).
- **Power-save bit suppression** during sensitive windows.
- **Queue isolation per security epoch** — modern hostap and Linux mac80211 add explicit security-epoch tracking.
- **MACsec** between AP and the wired distribution layer — see [MACsec](/wiki/defenses/macsec/) — eliminates the plaintext-in-flight class entirely.

---

## Tooling

- **MacStealer** — proof-of-concept tool, tests for the single-BSSID port-stealing variant. <https://github.com/domienschepers/wifi-framing>

---

## References

- Domien Schepers, Aanjhan Ranganathan, Mathy Vanhoef — *Framing Frames: Bypassing Wi-Fi Encryption by Manipulating Transmit Queues* — USENIX Security 2023 — <https://papers.mathyvanhoef.com/usenix2023-wifi.pdf>
- USENIX page — <https://www.usenix.org/conference/usenixsecurity23/presentation/schepers>
- Repo — <https://github.com/domienschepers/wifi-framing>
- CVE-2022-47522
