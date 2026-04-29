---
title: "MFP Deauthentication — Tearing Down Protected-Management-Frame Sessions"
permalink: /wiki/attacks/mfp-deauthentication/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - mfp
  - 802.11w
  - deauth
  - schepers
---

*MFP / 802.11w was supposed to make deauth attacks impossible. It almost does — but the standard has under-specified edges that let an attacker still tear down sessions.*

**Status:** drafting
**Venue:** WiSec 2022; FPS 2022 ("Cut It")
**Authors:** Domien Schepers (Northeastern), Mathy Vanhoef (KU Leuven imec-DistriNet)
**Related:** [Management Frame Protection (MFP)](/wiki/concepts/mfp/), [Handshakes](/wiki/concepts/handshakes/), [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Rogue AP](/wiki/attacks/rogue-ap/)

---

## What it is

802.11w (a.k.a. **PMF / MFP** — Protected Management Frames) authenticates a subset of management frames — most importantly **Deauthentication** and **Disassociation**. With MFP enabled, a third party should not be able to forge a deauth and bump a victim off the network.

The Schepers / Vanhoef line of work shows that **MFP doesn't fully close the deauth gap**:

- **Unprotected SA-Query timeout.** When the AP can't decide whether a station is still associated (e.g., race during a roam), it sends an SA-Query. If the response doesn't arrive in time, the AP disassociates the client. An attacker who blocks SA-Query responses can force this disassociation without forging any frame.
- **Unauthenticated frame types.** Some frame types (Beacon, Probe Request/Response, parts of WNM) are not protected even with MFP. Manipulating these can drive the client into a state where the legitimate AP will eventually deauthenticate it cleanly — the attacker doesn't forge the deauth, the AP sends it for them.
- **Implementation bugs.** Multiple stacks (Linux, Apple, Windows, Android) accept deauth frames that should be filtered, accept them with mismatched RSNs, or follow contradictory rules between different parts of the standard.
- **Cut It** (FPS 2022) demonstrates concrete deauth attacks against PMF-enabled WPA2-PSK and WPA3-PSK networks despite "the protection".

---

## Why it matters

Deauth attacks are the entry point to many further attacks:

- They drop a victim off the network so the attacker can [rogue-AP](/wiki/attacks/rogue-ap/) them with a clone.
- They force a fresh 4-way handshake the attacker can capture for offline cracking.
- They reset queue / power-save state in ways [Framing Frames](/wiki/attacks/framing-frames/) can exploit.

Closing the deauth gap is therefore a precondition for trusting any of the higher-layer Wi-Fi guarantees.

---

## What stops it

- **Updated implementations** — the WiSec 2022 paper drove patches in mac80211, hostap, IWD, Apple, Microsoft, and Android.
- **Spec clarifications** — IEEE 802.11 working group amendments tighten the rules around SA-Query timeouts and frame-type protection.
- **Beacon protection** (BIGTK, IGTK extensions) raises the cost of unprotected-frame manipulation.
- **Wired-side hygiene** — combining MFP with [VLANs / firewalling](/wiki/defenses/vlans/) limits what an attacker can do *after* a deauth even if they succeed.

---

## Tooling

- **wifi-deauthentication** — Schepers's PoC repo testing MFP-deauth resistance — <https://github.com/domienschepers/wifi-deauthentication>

---

## References

- Domien Schepers, Mathy Vanhoef, Aanjhan Ranganathan — *On the Robustness of Wi-Fi Deauthentication Countermeasures* — WiSec 2022 — <https://papers.mathyvanhoef.com/wisec2022.pdf>
- *Cut It: Deauthentication Attacks on Protected Management Frames in WPA2 and WPA3* — FPS 2022 — <https://dl.acm.org/doi/10.1007/978-3-031-08147-7_16>
- Wi-Fi Alliance — *Protected Management Frames Enhance Wi-Fi Network Security* — <https://www.wi-fi.org/beacon/philipp-ebbecke/protected-management-frames-enhance-wi-fi-network-security>
