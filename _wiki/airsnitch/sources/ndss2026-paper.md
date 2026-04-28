---
title: "Source \u2014 NDSS'26 AirSnitch paper"
permalink: /wiki/airsnitch/sources/ndss2026-paper/
layout: single
author_profile: true
tags:
- airsnitch
- source
sources: []
updated: 2026-04-28
---

# Source: NDSS'26 — AirSnitch paper

**Title:** *AirSnitch: Demystifying and Breaking Client Isolation in Wi-Fi Networks*

**Authors:**
- Xin'an Zhou (UC Riverside)
- Juefei Pu (UC Riverside)
- Zhutian Liu (UC Riverside)
- Zhiyun Qian (UC Riverside)
- Zhaowei Tan (UC Riverside)
- Srikanth V. Krishnamurthy (UC Riverside)
- Mathy Vanhoef (DistriNet, KU Leuven)

**Venue:** Network and Distributed System Security (NDSS) Symposium 2026 — 23–27 February 2026, San Diego, CA, USA

**ISBN:** 979-8-9919276-8-0 · **DOI:** [`10.14722/ndss.2026`](https://dx.doi.org/10.14722/ndss.2026)

**Canonical PDF:** https://papers.mathyvanhoef.com/ndss2026-airsnitch.pdf

**Code/artifact:**
- https://github.com/zhouxinan/airsnitch — exact artifact-evaluated snapshot
- https://github.com/vanhoefm/airsnitch — upstream maintained version
- https://doi.org/10.5281/zenodo.17905486 — artifact-evaluated archive
- https://doi.org/10.5281/zenodo.17905485 — paper data

## Local copy

[`raw/ndss2026-airsnitch-paper.md`](../../raw/ndss2026-airsnitch-paper.md) — text extraction provided by the user during wiki bootstrapping. Layout artefacts; cite by section, not page number.

## Summary

Structured security analysis of Wi-Fi client isolation across encryption, switching, and routing layers. Identifies three classes of root cause: (1) shared group keys are abusable as broadcast injection vectors; (2) isolation is enforced at L2 but not L3 (or vice versa); (3) client identity is not synchronized across the network stack — a client's keys, MAC, and IP are not bound to each other.

Builds end-to-end MitM primitives that work across home and enterprise networks, single- and multi-BSSID, single- and multi-AP, even when client isolation is "enabled". Demonstrates 11 devices and 2 real university networks; every one was vulnerable to at least one attack.

## Pages this source informs

(Every wiki page with `sources: [ndss2026-paper]` in its frontmatter — listed here as a manual cross-check; if this list goes out of sync with reality, that's a [lint](/wiki/schema/#lint) failure.)

- [overview](/wiki/airsnitch/overview/)
- [Concepts](../concepts/) — all of them
- [Attacks](../attacks/) — all of them
- [Defences](../defenses/) — all of them
- [Tools](../tools/) — implicitly via the artifact appendix
- [Tested devices](/wiki/airsnitch/devices/tested-devices/)

## Citation

```bibtex
@inproceedings{zhou2026airsnitch,
  title     = {AirSnitch: Demystifying and Breaking Client Isolation in Wi-Fi Networks},
  author    = {Zhou, Xin'an and Pu, Juefei and Liu, Zhutian and Qian, Zhiyun
               and Tan, Zhaowei and Krishnamurthy, Srikanth V. and Vanhoef, Mathy},
  booktitle = {Network and Distributed System Security (NDSS) Symposium},
  year      = {2026},
  doi       = {10.14722/ndss.2026.23xxx}
}
```

(DOI suffix is the placeholder seen in the paper draft; replace with the final assigned identifier when published.)

## Related work cited by the paper

Worth ingesting next when growing the wiki:

- **MacStealer** (Schepers, Ranganathan, Vanhoef — USENIX Security 2023, "Framing Frames"). The same-BSSID downlink port-stealing case AirSnitch generalises. → consider creating `sources/macstealer.md` + `sources/framing-frames.md`.
- **Hole 196** (Md Sohail Ahmad, DEF CON 2010). The original "shared group keys are abusable" observation — but in a different setting (not in the context of client isolation).
- **KRACK** (Vanhoef & Piessens, CCS 2017) and **Release the Kraken** (CCS 2018). Background on 4-way handshake exploits.
- **Dragonblood** (Vanhoef & Ronen, S&P 2020). WPA3 SAE side channels.
- **FragAttacks** (Vanhoef, USENIX 2021). Frame fragmentation/aggregation flaws.
- **WPA3-PK security analysis** (Vanhoef & Robben, ACNS 2024).
- **RADIUS/UDP considered harmful** (Goldberg et al., USENIX 2024). RADIUS shared-secret weaknesses; relevant to AirSnitch's §VII-G case study.
- **Passpoint specification** v3.3 (and subsequent v3.4).
