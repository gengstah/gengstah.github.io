---
title: "SSID Confusion — Making Wi-Fi Clients Connect to the Wrong Network"
permalink: /wiki/attacks/ssid-confusion/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - ssid
  - 4-way-handshake
  - vanhoef
  - gollier
---

*The SSID is not authenticated by the 4-way handshake. A client can be silently roamed onto a different protected network sharing the same credentials — UI shows the trusted SSID, the kernel is on a different one.*

**Status:** drafting
**Venue:** WiSec 2024 (best paper)
**Authors:** Héloïse Gollier, Mathy Vanhoef (KU Leuven)
**CVE:** CVE-2023-52424
**Related:** [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Handshakes](/wiki/concepts/handshakes/), [BSSID, SSID, ESS](/wiki/concepts/bssid-ssid-ess/), [Rogue AP](/wiki/attacks/rogue-ap/), [TunnelCrack](/wiki/attacks/tunnelcrack/)

---

## What it is

When a Wi-Fi client connects to a protected network, the 4-way handshake authenticates the **PMK** (derived from the SSID + passphrase, or from EAP) and the BSSID. The **SSID itself is not** part of the handshake — it's only advertised in unprotected beacons / probe responses.

If two networks (`TrustedNet` and `WrongNet`) share the same credentials — same passphrase, same EAP CA, same wpa3 transition setup — a man-in-the-middle attacker can:

1. Block the victim's beacon for `TrustedNet` and inject a forged beacon for `TrustedNet` whose BSSID actually matches `WrongNet`'s AP.
2. Let the 4-way handshake complete normally — both sides hold the same PMK.
3. The victim is now on `WrongNet`, but every UI element (`iwconfig`, the OS Wi-Fi indicator, the captive-portal logic, the "auto-disable VPN on trusted SSID" rule) believes it is on `TrustedNet`.

The headline practical impact: laptops configured with policies like "*disable my VPN on the corporate SSID*" can be silently dropped onto a coffee-shop network with the same name in a different city, the policy fires, and the device exposes its traffic.

---

## Affected scenarios

- **Home WPA2/WPA3-Personal mesh networks** that share credentials across multiple SSIDs.
- **802.1X / EAP networks** that use the same RADIUS server / CA across multiple network names — common for `eduroam`-style federations and corporate guest+main pairs.
- **AMPE / mesh mode networks.**

The flaw is in the IEEE 802.11 standard itself — implementations cannot fix it without protocol-level changes.

---

## What changed

The IEEE 802.11 working group has updated the standard to **bind the SSID into the 4-way handshake** — the SSID becomes part of the PMK derivation / handshake context, so a connection that's nominally to `TrustedNet` cannot be silently swapped to a network with a different SSID. **Beacon protection** improvements were also added.

Until clients and APs both ship the updated handshake, the attack remains viable on networks whose credentials are reused across multiple SSIDs.

---

## What stops it

- **Don't reuse credentials** across network names (the cleanest mitigation).
- **VPN policies that key off the BSSID, not the SSID.** BSSID can also be spoofed (a sophisticated attacker can clone any BSSID), but it raises the bar.
- **Updated 802.11 stacks** with SSID-in-handshake binding.

---

## References

- Héloïse Gollier, Mathy Vanhoef — *SSID Confusion: Making Wi-Fi Clients Connect to the Wrong Network* — WiSec 2024 — <https://papers.mathyvanhoef.com/wisec2024.pdf>
- Vanhoef blog — *The SSID Confusion Attack: Common Misconceptions* — <https://www.mathyvanhoef.com/2024/08/the-ssid-confusion-attack-common.html>
- Top10VPN write-up — <https://www.top10vpn.com/research/wifi-vulnerability-ssid/>
- Best Paper Award — DistriNet — <https://distrinet.cs.kuleuven.be/news/heloise-gollier-wins-best-paper-award-at-wisec-24>
