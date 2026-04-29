---
title: "FragAttacks — Fragment and Forge"
permalink: /wiki/attacks/fragattacks/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - fragmentation
  - aggregation
  - vanhoef
  - design-flaw
---

*Twelve vulnerabilities — three design flaws in the 802.11 standard, the rest implementation bugs — that let an attacker inject and exfiltrate frames in WPA, WPA2, and WPA3 networks.*

**Status:** drafting
**Venue:** USENIX Security 2021 (also Black Hat USA 2021)
**Author:** Mathy Vanhoef (NYU Abu Dhabi)
**Related:** [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [WPA Versions](/wiki/concepts/wpa-versions/), [KRACK](/wiki/attacks/krack/), [Framing Frames](/wiki/attacks/framing-frames/), [Dragonblood](/wiki/attacks/dragonblood/)

---

## What it is

Wi-Fi has two performance features that became attack surfaces:

- **Fragmentation** — large frames split into smaller fragments, each encrypted independently.
- **Aggregation (A-MSDU)** — multiple inner frames packed into one MAC payload via an `A-MSDU` flag in the QoS header.

FragAttacks identifies three *design* flaws in how the 802.11 standard treats these features, plus nine *implementation* bugs in how individual products implement them.

---

## The three design flaws

1. **A-MSDU flag is unauthenticated** (CVE-2020-24588). The bit in the QoS header that marks a payload as "this is multiple A-MSDU frames" is not covered by the per-frame MIC. An attacker who induces the AP to encrypt a fully-attacker-chosen plaintext (e.g., via an ICMP echo path that doubles as plaintext injection) can flip the bit on a later legitimate frame so the receiver re-parses the payload as nested A-MSDU subframes. The first subframe's destination MAC is attacker-controlled — landing arbitrary IP packets at arbitrary clients.
2. **Mixed-key fragmentation** (CVE-2020-24587). The standard does not require all fragments of a frame to be encrypted under the same key. An attacker can mix one fragment encrypted under the GTK with another encrypted under a victim's PTK; the receiver reassembles them and treats the result as authenticated.
3. **Fragment cache not flushed on disassociation** (CVE-2020-24586). Fragments left in the receiver's reassembly buffer between sessions persist; an attacker who reconnects can cause their own (under their own key) fragment to be reassembled with the previous victim's leftover fragment, producing forged plaintext.

Each design flaw lets an attacker either inject plaintext into the network (via the AP) or exfiltrate a target client's data (by tricking the target into sending it elsewhere).

---

## The implementation bugs (sample)

- Receivers that accept plaintext A-MSDU frames during a 4-way handshake.
- Receivers that accept fragmented frames as plaintext if the first fragment was unencrypted.
- Receivers that accept broadcast fragments encrypted under the pairwise key.
- Routers that forward EAPOL frames to other clients before authentication completes (lets the attacker inject IP packets through the AP at any time).
- Linux drivers that didn't verify the IV/key-id when reassembling fragments.

A dozen products were tested; every product had at least one issue; most had several.

---

## Exploitation

The headline demo: a client visits an attacker-controlled HTTP page; the page issues an XHR that the AP forwards over the LAN; FragAttacks forges that into a plaintext IP packet from the AP itself, which the AP routes back into the LAN at IP layer, reaching internal devices that were supposed to be unreachable from the wireless side. The attacker has converted a Wi-Fi association into "I can ping the LAN".

In a more direct variant, the attacker injects a UDP DNS response from the AP to a client, redirecting the client's traffic to an attacker-controlled server.

---

## What stops it

- **Driver and firmware updates.** Wi-Fi Alliance and CERT/CC coordinated a 9-month embargo through May 2021; most major vendors shipped fixes.
- **Spec amendments** to authenticate the A-MSDU flag, require uniform-key fragmentation, and flush the fragment cache on disassociation.
- **No new key-recovery requirement** — the bugs are in framing, not crypto. Existing PSK / SAE remain unaffected.

The persistent class of design flaws — *L2 framing decisions that aren't authenticated* — recurs in [Framing Frames](/wiki/attacks/framing-frames/) (transmit-queue manipulation), [SSID Confusion](/wiki/attacks/ssid-confusion/) (SSID not in the 4-way handshake), and the broader [AirSnitch](/wiki/concepts/airsnitch-overview/) work on client-isolation bypass.

---

## References

- Mathy Vanhoef — *Fragment and Forge: Breaking Wi-Fi Through Frame Aggregation and Fragmentation* — USENIX Security 2021 — <https://papers.mathyvanhoef.com/usenix2021.pdf>
- Black Hat USA 2021 whitepaper — <https://papers.mathyvanhoef.com/blackhat2021-fragattacks.pdf>
- Project page — <https://www.fragattacks.com/>
- IACR ePrint 2021/763 — <https://eprint.iacr.org/2021/763>
