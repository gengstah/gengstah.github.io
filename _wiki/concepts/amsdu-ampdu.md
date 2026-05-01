---
title: "A-MSDU and A-MPDU Aggregation"
permalink: /wiki/concepts/amsdu-ampdu/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - aggregation
  - fragattacks
---

*The two aggregation features 802.11n introduced to amortise PHY overhead — and the unauthenticated-bit + sub-frame-reinterpretation surface that makes [FragAttacks](/wiki/attacks/fragattacks/) possible.*

**Status:** drafting
**Related:** [802.11 frame types](/wiki/concepts/80211-frame-types/), [FragAttacks](/wiki/attacks/fragattacks/), [Beacon frames](/wiki/concepts/beacon-frames/)

---

## A-MSDU — Aggregated MAC Service Data Unit

A single 802.11 data frame can carry **several** L2 payloads (MSDUs) concatenated under one MAC header. Each sub-frame has its own DA, SA, and length, padded to 4-byte alignment.

```
+-----------+ +--- A-MSDU container -----------------------+
| MAC hdr   | | sub1: DA|SA|len|LLC/SNAP|payload|pad       |
| (1 BSSID) | | sub2: DA|SA|len|LLC/SNAP|payload|pad       |
+-----------+ | sub3: …                                    |
              +--------------------------------------------+
```

Win: one PHY preamble, one ACK, one MAC overhead — for many payloads.

The presence of A-MSDU is signalled by the **A-MSDU Present bit** in the QoS Control field of the QoS Data frame. That field is in the MAC header, **outside the encrypted MSDU body**.

## A-MPDU — Aggregated MAC Protocol Data Unit

A different layer of aggregation: many full 802.11 MPDUs (each with its own MAC header, security header, FCS) bundled into one PHY transmission, separated by an MPDU delimiter. Each sub-MPDU is independently encrypted; the receiver can ACK them via Block Ack.

```
PHY preamble
| MPDU-delim | MPDU 1 (hdr+payload+FCS)
| MPDU-delim | MPDU 2
| …
```

Win: amortise PHY overhead at higher MCS rates where overhead dominates short frames.

A-MPDU and A-MSDU are independent — a single PPDU can be A-MPDU(A-MSDU(...), A-MSDU(...)).

## Why this is FragAttacks territory

**The A-MSDU bit is unauthenticated.** It lives in the QoS Control byte, which is part of the MAC header — encrypted only as Additional Authentication Data (AAD) under CCMP, not as plaintext-with-MIC.

The FragAttacks paper observed three design defects:

1. **A-MSDU bit toggle** — flip the A-MSDU Present bit on a regular frame from 0 to 1 in transit. The receiver now interprets the legitimate frame's payload as a sequence of A-MSDU sub-frames, with attacker-controlled length / destination fields. Because IPv4 packets begin with `0x4500`, those bytes get reinterpreted as length / sub-frame header. The attacker injects whatever sub-frame they want.
2. **Mixed-key fragmentation** — the receiver's defragmentation buffer keys frames by MAC + sequence number, not by the encryption key in use. An attacker triggers a key change between fragments and the receiver reassembles fragments encrypted under different keys.
3. **Fragment-cache not flushed** — fragments persist in the receiver's reassembly buffer across associations, allowing an attacker to inject a first-fragment that combines with a later legitimate fragment.

Plus a list of nine implementation-level bugs across major stacks: Linux mac80211, Windows Wi-Fi, macOS, Cisco, Aruba, NetGear, ASUS.

## Mitigations standardised since FragAttacks

- **A-MSDU presence is now MIC-authenticated** in all WPA3-2020 implementations: the QoS Control byte's A-MSDU bit is bound into AAD per CCMP/GCMP-256 spec, and stacks reject mismatches.
- **Fragments must use the same PN/PTK or be discarded.**
- **Receivers flush the fragment cache on dissociation.**

The fixes ride on the firmware/driver layer; older devices remain vulnerable. FragAttacks remains a relevant surface against IoT and embedded.

## Block Ack and ADDBA

A-MPDU operation requires a Block Ack session, set up by the [ADDBA Action frame](/wiki/concepts/action-frames/). Parameters:

- TID (one of 0–7).
- Buffer size (16, 64, 256 — Wi-Fi 6 ups it to 1024).
- Starting sequence number.

Once an ADDBA succeeds, the receiver maintains a window starting at the SSN; out-of-order MPDUs within the window are buffered until contiguous, then delivered. This is the substrate FragAttacks variants exploit by skewing the window after a forged DELBA.

## Tooling notes

- Wireshark dissects A-MSDU sub-frames; expand the `IEEE 802.11 QoS Data, Flags: ........+...` tree.
- `aircrack-ng` doesn't natively craft A-MSDU; for that you need `Scapy` `Dot11()/QoS_Frame()/Raw()` or a patched Linux mac80211.
- The reference FragAttacks PoC at <https://github.com/vanhoefm/fragattacks> is the canonical lab harness.

## See also

- [FragAttacks](/wiki/attacks/fragattacks/) — the full attack family.
- [Action frames](/wiki/concepts/action-frames/) — ADDBA / DELBA live here.
- [802.11 standards](/wiki/concepts/802-11-standards/) — aggregation introduced in 802.11n.

## References

- Vanhoef — *Fragment and Forge: Breaking Wi-Fi Through Frame Aggregation and Fragmentation* — USENIX Security 2021 — <https://papers.mathyvanhoef.com/usenix2021.pdf>
- IEEE 802.11-2020 §10.3 (A-MPDU), §10.4 (A-MSDU).
