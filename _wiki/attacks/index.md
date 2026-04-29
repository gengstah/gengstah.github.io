---
title: Attacks
permalink: /wiki/attacks/
layout: single
author_profile: true
---

Wi-Fi protocol attacks — design flaws and implementation bugs in WEP / WPA / WPA2 / WPA3 / 802.1X. Two clusters: the AirSnitch (NDSS'26) corpus on client-isolation bypass, plus the broader Wi-Fi research line — KRACK, Dragonblood, FragAttacks, Framing Frames / MacStealer, TunnelCrack, SSID Confusion, PEAP / IWD bypass, MFP deauthentication, and Pixie Dust WPS.

**17 pages** in this category.

---

- [Abusing GTK](/wiki/attacks/abusing-gtk/)
- [Auxiliary Techniques (Port Restoration, Inter-NIC Relaying)](/wiki/attacks/auxiliary-techniques/)
- [Broadcast Reflection](/wiki/attacks/broadcast-reflection/)
- [Dragonblood — Attacking WPA3's SAE / Dragonfly Handshake](/wiki/attacks/dragonblood/) — Side-channel, downgrade, and DoS attacks against WPA3's SAE handshake — and against EAP-pwd. The first big break of WPA3, two years after the spec.
- [FragAttacks — Fragment and Forge](/wiki/attacks/fragattacks/) — Twelve vulnerabilities — three design flaws in the 802.11 standard, the rest implementation bugs — that let an attacker inject and exfiltrate frames in WPA, WPA2, and WPA3 networks.
- [Framing Frames / MacStealer — Bypassing Wi-Fi Encryption via Transmit Queues](/wiki/attacks/framing-frames/)
- [Gateway Bouncing](/wiki/attacks/gateway-bouncing/)
- [KRACK — Key Reinstallation Attacks on WPA2](/wiki/attacks/krack/) — Forcing nonce reuse in the WPA2 4-way handshake by replaying message 3 — the bug that broke Wi-Fi encryption in 2017.
- [Machine-on-the-Side (WPA2-PSK passphrase derive)](/wiki/attacks/machine-on-the-side/)
- [MFP Deauthentication — Tearing Down Protected-Management-Frame Sessions](/wiki/attacks/mfp-deauthentication/) — MFP / 802.11w was supposed to make deauth attacks impossible. It almost does — but the standard has under-specified edges that let an attacker still tear down sessions.
- [Passpoint Flaws — Forcing the Real GTK](/wiki/attacks/passpoint-flaws/)
- [PEAP / IWD Authentication Bypass (CVE-2023-52160 / CVE-2023-52161)](/wiki/attacks/peap-bypass/) — Skipping inner-PEAP authentication on `wpa_supplicant` (Android default), and a separate handshake-state bug in Intel's IWD that lets an unauthenticated attacker join a protected network.
- [Pixie Dust — Offline WPS PIN Recovery](/wiki/attacks/pixie-dust-wps/) — An offline brute-force of the WPS PIN, exploiting weak PRNGs in many AP chipsets to recover the secret nonces (E-S1, E-S2) — and thus the PSK — in seconds.
- [Port Stealing (Downlink and Uplink)](/wiki/attacks/port-stealing/)
- [Rogue AP (WPA3-SAE clone)](/wiki/attacks/rogue-ap/)
- [SSID Confusion — Making Wi-Fi Clients Connect to the Wrong Network](/wiki/attacks/ssid-confusion/) — The SSID is not authenticated by the 4-way handshake. A client can be silently roamed onto a different protected network sharing the same credentials — UI shows the trusted SSID, the kernel is on a different one.
- [TunnelCrack — Leaking VPN Traffic via Routing Tables](/wiki/attacks/tunnelcrack/) — Two design flaws (LocalNet, ServerIP) that trick a victim's VPN client into leaking traffic outside the tunnel — exploited from a malicious Wi-Fi network.
