---
title: "Captive Portals"
permalink: /wiki/concepts/captive-portals/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - captive-portal
  - hotspot
---

*The "click I agree" web page airports, hotels, and cafes show before letting you reach the internet. Sits at L3+, not at the Wi-Fi layer — but inseparable from open / OWE Wi-Fi in practice.*

**Status:** drafting
**Related:** [OWE](/wiki/concepts/owe/), [WNM and ANQP](/wiki/concepts/wnm-anqp/), [Passpoint](/wiki/concepts/passpoint/)

---

## How captive portals work

Once a STA associates and gets DHCP, the gateway intercepts traffic in one of these ways:

| Mechanism | What happens |
|---|---|
| **HTTP redirect** | All HTTP traffic to TCP/80 is redirected (302) to the portal URL until the client authenticates. |
| **DNS hijack** | DNS queries return the portal IP; HTTPS connection attempts get TLS errors but the browser fetches the portal in a follow-up HTTP request. |
| **ICMP Destination Unreachable** for unreachable IPs while portal is pending. |
| **RFC 8908 / 8910 (Captive-Portal API)** — DHCP option 114 / RA option 37 supply the portal URL; the OS opens it in a sandboxed browser. The modern, well-behaved approach. |

Modern OSes (iOS, Android, macOS, Windows) detect a captive portal by issuing **probe requests** to known endpoints and checking responses:

- iOS / macOS: `http://captive.apple.com/hotspot-detect.html`.
- Android: `http://connectivitycheck.gstatic.com/generate_204`.
- Windows: `http://www.msftconnecttest.com/connecttest.txt`.
- Firefox: `http://detectportal.firefox.com/success.txt`.

If the response doesn't match the expected fingerprint, the OS pops a "Sign in to network" UI in a captive-portal sandbox.

## Operational structure

A typical hotel / airport portal has three roles:

- **Wi-Fi AP / WLC** — terminates 802.11 + sets up Wi-Fi encryption (often OPEN or OWE, sometimes a shared PSK).
- **Captive Portal Gateway** — does the L3 interception, typically a Cisco ISE / Aruba ClearPass / Meraki / Ruckus appliance.
- **External authentication** — RADIUS, LDAP, or vendor SSO that the portal logs against.

Once authenticated, the gateway whitelists the client's MAC address (sometimes also IP) and permits L3 traffic. MAC ACLs survive across associations until they expire.

## Common (and persistent) weaknesses

- **MAC spoofing.** Once the gateway whitelists MAC `aa:bb:cc:dd:ee:ff`, anyone using that MAC is authenticated. An attacker spoofing the MAC of a paying-guest STA (visible from a quick `airodump-ng`) gets free network access. Fix: 802.1X or per-flow authentication. Many portals don't.
- **HTTP-only portals.** Login form posted over plain HTTP from inside a hostile cafe network lets an attacker between the STA and the portal harvest credentials.
- **DNS exfiltration / tunnelling.** Many portals leak DNS-before-auth (the device must resolve the portal hostname). A DNS tunnel (`iodine`, `dnscat2`) gets data out before the user logs in.
- **ICMP / IPv6 leakage.** Portal blocks HTTP/HTTPS but lets IPv6, ICMP, or specific UDP ports through. `ping` over UDP-encapsulated tunnels (yes, real) drains data without ever logging in.
- **Privacy.** The portal sees every URL the user visits (for HTTP) or every SNI (for HTTPS) — historical hotel chains have logged + sold this.
- **Captive-portal browser sandbox escapes.** The mini-browser the OS pops up has historically had its own bugs (Safari pre-iOS 13, Chrome's PWA shell). Loading attacker JS in a CP browser can pivot.

## OWE + captive portal: the new normal

Newer airport / cafe deployments combine **OWE** (encrypted air) with a **captive portal** (auth and policy). For sniffing, OWE makes the air opaque. For authentication, the portal still suffers all the L3 weaknesses above. Net: the threat model shifted from "free passive sniffing" to "rogue-AP + same-portal-stack still works".

## Passpoint as the alternative

Hotspot 2.0 / Passpoint replaces the portal with carrier-issued credentials and auto-association. No portal, no captive browser. The attack surface shifts entirely to [Passpoint](/wiki/concepts/passpoint/) and [WNM/ANQP](/wiki/concepts/wnm-anqp/).

## Operator workflow (red team)

| Step | Tool / approach |
|---|---|
| Identify portal type | Browse a non-standard URL; observe redirect / TLS error pattern. Look for `wispr` XML in responses (legacy WISPr v1.0). |
| Enumerate MACs of authenticated clients | `airodump-ng` shows every associated MAC. |
| MAC spoof | `macchanger -m <victim>` then re-associate. Expect to lose connectivity briefly while the gateway reconciles. |
| DNS tunnel as fallback | `iodine -P` for low-bandwidth exfil before auth. |
| If forced to auth, watch for plaintext credential | Many portals log `email + last name` style identifiers in the clear. |

## Defensive notes

- **Per-user authentication, not per-MAC.** RADIUS-backed portals + 802.1X-equivalent auth.
- **HTTPS on the portal.** Public CA cert; HSTS.
- **Block DNS-before-auth.** Or rate-limit it heavily.
- **Use Passpoint** where the user population is operator-managed (carrier offload, enterprise visitor Wi-Fi).

## See also

- [OWE](/wiki/concepts/owe/) — companion: encrypted air without auth.
- [Passpoint](/wiki/concepts/passpoint/), [WNM and ANQP](/wiki/concepts/wnm-anqp/) — the carrier-grade alternative.
- [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/) — captive-portal SSIDs in the PNL are KARMA-bait.

## References

- RFC 8908 — *Captive-Portal Identification in DHCP and RA*.
- RFC 8910 — *Captive-Portal API*.
- Apple — *Captive networks* developer docs.
