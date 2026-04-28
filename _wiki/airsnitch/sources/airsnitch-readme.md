---
title: "Source \u2014 AirSnitch upstream README"
permalink: /wiki/airsnitch/sources/airsnitch-readme/
layout: single
author_profile: true
tags:
- airsnitch
- source
sources: []
updated: 2026-04-28
---

# Source: AirSnitch upstream README

**File:** [`airsnitch/README.md`](../../airsnitch/README.md)

The user-facing operator's manual for the AirSnitch tool, maintained by Mathy Vanhoef. Lives at the root of the [`vanhoefm/airsnitch`](https://github.com/vanhoefm/airsnitch) GitHub repo.

## Summary

Operational walkthrough of AirSnitch from prerequisites to per-attack invocation. Sections:

1. **Introduction.** High-level descriptions of the three attack categories (Abusing GTK, Gateway Bouncing, Port Stealing) with the canonical injected-frame examples in Scapy notation. Includes a comparison to MacStealer (USENIX'23) explicitly pointing out which AirSnitch tests are *novel* relative to that prior work.
2. **Prerequisites.** Ubuntu 22.04.5 LTS recommended. Build dependencies. `setup.sh` → `airsnitch/research/build.sh` → `pysetup.sh`.
3. **Before every usage.** Environment setup, `client.conf` configuration, BSSID selection arguments.
4. **Main vulnerability tests.** Per-flag walkthroughs — `--check-gtk-shared`, `--c2c-ip`, `--c2c-port-steal`, `--c2c-port-steal-uplink`. Includes the exact "vulnerable" output strings.
5. **Extra vulnerability tests.** `--c2c-broadcast`, manual tests, BSSID specification.
6. **Defenses and mitigations.** The eight-step defensive recommendation set the wiki's [defenses index](/wiki/airsnitch/defenses/index/) is built from.
7. **Troubleshooting.** Common environmental issues. Includes the `drop_unicast_in_l2_multicast=0` requirement for `--c2c-gtk-inject` testing on a Linux machine.
8. **Clarifications.** Caveats about how Enterprise AP results in the paper should be interpreted.

## Local copy

The README is not duplicated under `raw/`. Read it directly at [`airsnitch/README.md`](../../airsnitch/README.md). It is updated upstream; pull the latest version with `git pull` inside the `airsnitch/` directory.

## Pages this source informs

(Every wiki page with `sources: [airsnitch-readme]` in its frontmatter.)

- [overview](/wiki/airsnitch/overview/)
- [Concepts: client isolation, WPA versions](../concepts/)
- [Attacks: abusing-gtk, gateway-bouncing, port-stealing, broadcast-reflection](../attacks/)
- [Defences: index, vlans, filter-unicast-in-broadcast, documentation](../defenses/)
- [Tools: airsnitch-cli, configurations, repo-layout, setup-scripts](../tools/)

## Notable framing choices in the README

A handful of stances the README takes that are worth carrying forward in the wiki:

- *"AirSnitch can 'break' Wi-Fi encryption" is wrong.* The README pushes back on this framing in the introduction. AirSnitch is a key-management/identity-binding attack, not a cipher attack. Wiki pages should follow this framing.
- *Switching to WPA3 alone does not stop the attacks.* The README is explicit. See [WPA versions](/wiki/airsnitch/concepts/wpa-versions/).
- *Most attacks are independent of the encryption protocol.* See the matrix in [overview](/wiki/airsnitch/overview/).
- *Use the tool to test your own network.* The README's intent is operational. The wiki should preserve this — every attack page ends with a "test it on your network" CLI snippet.

## Status

The upstream README is more recent than the NDSS'26 artifact-evaluated code; the upstream version contains "various updates" per its banner. When the two disagree, prefer the upstream README for *operational* questions and the paper for *analytical* claims.
