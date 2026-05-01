---
title: "Probe Requests and the Preferred Network List"
permalink: /wiki/concepts/probe-requests-pnl/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - privacy
  - tracking
---

*The frames a client emits before it has joined any network — the single most useful passive surveillance source on Wi-Fi, and the substrate of the KARMA family of attacks.*

**Status:** drafting
**Related:** [802.11 frame types](/wiki/concepts/80211-frame-types/), [Beacon frames](/wiki/concepts/beacon-frames/), [Rogue AP](/wiki/attacks/rogue-ap/)

---

## Active vs passive scanning

Two ways for a client to find a BSS:

- **Passive** — listen on each channel for beacons. No transmission. Slow.
- **Active** — broadcast a Probe Request, wait for a Probe Response. Fast.

In practice every modern OS active-scans. A station scanning across all channels typically takes 100–500 ms per channel in active mode vs 1–2 s passive.

## The Probe Request

A Probe Request is a management frame (subtype 4) sent from the client's MAC to the broadcast destination `ff:ff:ff:ff:ff:ff`. It carries:

- **SSID IE** — empty (wildcard) *or* the specific SSID being searched for.
- **Supported Rates / Extended Supported Rates / HT / VHT / HE / EHT capabilities** — what the client can do. These are extremely vendor-specific and act as a fingerprint.
- **Vendor-specific IEs** — Apple devices include `wps.dev_password_id`, `aware.discovery.ie`; Microsoft includes Wi-Fi Direct PSP capabilities; etc.
- **Extended Capabilities, Interworking, etc.**

## The Preferred Network List (PNL)

Historically, when a client joined a network, the SSID was added to its PNL — a list of "trusted" SSIDs it would auto-rejoin. Older clients (Windows ≤ 7, macOS ≤ 10.10, Android ≤ 8) emitted directed Probe Requests for *every* PNL entry on every scan cycle: `Probe Req SSID="HomeWiFi"`, `Probe Req SSID="StarbucksWiFi"`, `Probe Req SSID="ConfHotel-2018"` …

This leak is monumental: a passive observer with a monitor-mode radio can, over a few minutes near a target, enumerate every Wi-Fi network the target has joined in years. The list is effectively a location-history disclosure.

Modern OSes have *largely* fixed this:

- **Apple iOS 14 (2020), Android 10 (2019), Windows 10 1903 (2019)** randomise the source MAC for probe requests by default.
- Apple and Android stopped emitting directed probes for hidden SSIDs unless the user marks the network as "hidden" explicitly.
- Some chipsets still leak PNL during fast roaming or after wake-from-sleep.

But field measurements (e.g. Vanhoef + Piessens, USENIX 2016 *Why MAC Address Randomization is Not Enough*) consistently find a fraction of devices still leaking — older Android, IoT, embedded, kiosks, printers, BMS controllers.

## KARMA / Mana

If the client probes for "HomeWiFi" and a nearby attacker AP responds claiming to be "HomeWiFi", many clients (especially older iOS, Android, and most IoT) will associate. The attacker has now intercepted the client's L3 traffic.

Modern variants:

- **MANA** (mod-Wi-Fi tooling) — keep per-MAC PNL state, respond with each entry's SSID until the client picks one.
- **Loud MANA** — broadcast probe responses for the union of all PNLs ever observed.
- **Known Beacons** — beacon every popular SSID continuously, hoping a client auto-joins.
- **EvilTwin variants** — use the same SSID + same encryption profile as the legitimate AP, possibly upgraded with stronger signal (proximity / power).

WPA3 / Enterprise auth break the simplest KARMA flow because the client's credential won't match an attacker AP without the right PSK / RADIUS server. But for **open / Captive-portal** SSIDs (airports, hotels, conferences) KARMA still works trivially.

## MAC randomisation and its limits

Modern OSes implement two forms:

- **Pre-association randomisation** — every probe-request scan uses a fresh random source MAC. Resets per-scan.
- **Per-SSID randomisation** — once associated, the client uses one persistent randomised MAC per SSID (so the network can still recognise the device for DHCP, ACLs, MAC filters).

Limitations researchers have published:

- The randomised MAC is sometimes per-driver-load, not per-scan, leaking aggregation across scans.
- Vendor-specific IEs in probe requests are *not* randomised and are stable across MAC changes (chipset capabilities, model strings). These act as a hardware fingerprint.
- Sequence numbers in the 802.11 header can correlate frames across MAC changes if the chipset reuses the same counter.
- Bluetooth Random Address randomises independently — some chipsets schedule both at once, leaking a Wi-Fi/BT correlation.

## Operational implications

| Phase | What probe requests / PNL give you |
|---|---|
| Reconnaissance | Enumerate which SSIDs a target has joined, hardware fingerprint, presence detection. |
| Initial access | KARMA → forced association to attacker AP. |
| OPSEC tradecraft | Attacker's *own* devices leak PNL — your kit must use a clean, randomised, profile-stripped device. Failing to do so deanonymises engagements. |

## Tooling

- `airodump-ng` will display probe-request SSIDs in the bottom pane.
- `hcxdumptool` captures probes to PCAPNG with parsed station summaries.
- `wifite` automates KARMA / Known-Beacons from a captured probe corpus.
- `eaphammer` runs a rogue-AP / KARMA stack with EAP/PEAP support.
- `mana-toolkit` (legacy) and `bettercap`'s `wifi.ap` / `wifi.recon`.

## See also

- [Rogue AP](/wiki/attacks/rogue-ap/) — the active-attack form.
- [Authentication and association](/wiki/concepts/authentication-association/) — what happens after KARMA succeeds.
- [802.11 frame types](/wiki/concepts/80211-frame-types/) — Probe Request is subtype 4.

## References

- Vanhoef, Matte, Cunche, Cardoso, Piessens — *Why MAC Address Randomization is Not Enough* — ASIA CCS 2016 — <https://papers.mathyvanhoef.com/asiaccs2016.pdf>
- Apple — *Wi-Fi privacy* — Platform Security Guide.
- Wright — *Asleep at the Wheel: Practical Wi-Fi Security* — historical KARMA exposition.
