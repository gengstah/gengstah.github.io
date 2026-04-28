---
title: RADIUS
permalink: /wiki/concepts/radius/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/concepts/radius/
---

**RADIUS** (Remote Authentication Dial-In User Service, RFC 2865 + many extensions) is the protocol enterprise APs use to talk to the authentication server during WPA2/WPA3-Enterprise. The AP terminates the 802.1X / EAP exchange with the client; everything from the EAP-Identity onwards is wrapped in RADIUS messages and forwarded to a central RADIUS server (often FreeRADIUS, Cisco ISE, Microsoft NPS).

Relevant to AirSnitch because it shows up in two places: as the authentication backplane that makes [WPA-Enterprise](/wiki/concepts/wpa-versions/) resistant to [machine-on-the-side](/wiki/attacks/machine-on-the-side/), and as a target the AirSnitch authors steal credentials from in the §VII-G case study.

## How it carries the PMK

In WPA-Enterprise the wire flow is:

```
Client ──EAP──► AP ──RADIUS──► RADIUS server
```

After EAP authentication succeeds, the RADIUS server derives the EAP MSK, returns it to the AP wrapped in a RADIUS `Access-Accept`, and the AP uses it as the PMK for the [4-way handshake](/wiki/concepts/handshakes/#4-way-handshake) with the client.

Two protections sit on the RADIUS hop:

1. A **shared secret** between AP and RADIUS server, used as a key for HMAC-MD5 (the legacy "Message Authenticator" attribute) and for hand-rolled stream encryption of the User-Password and the MS-MPPE keys (which carry the PMK).
2. Optionally, **RADIUS over TLS / DTLS** (RadSec) wrapping the whole exchange in real TLS.

Almost no enterprise APs use RadSec. The shared-secret-only mode is the default.

## Why AirSnitch can attack it

If the attacker manages to **intercept the AP's outbound RADIUS packets** — exactly what [uplink port stealing](/wiki/attacks/port-stealing/#uplink) achieves by spoofing the gateway MAC — the shared secret becomes the only defence. Two of its protections are weak:

- The Message Authenticator is HMAC-MD5 over the packet contents using the shared secret as key. With one captured packet the attacker can do offline brute force on the shared secret, exactly as for any HMAC with weak input entropy. Most deployment guides suggest "long random strings", but real-world shared secrets are often dictionary words or short.
- The MS-MPPE Send-Key / Recv-Key attributes use a custom MD5-based stream construction that is similarly attackable.

Once the attacker recovers the shared secret they can:

- decrypt PMKs in transit and impersonate any user;
- stand up a **rogue RADIUS server** for the same realm;
- pair the rogue RADIUS with a [rogue AP](/wiki/attacks/rogue-ap/) advertising the same SSID, and harvest legitimate users' EAP credentials when they connect.

This is the chain demonstrated in NDSS'26 §VII-G, on a TP-Link EAP613-based testbed.

## Related work and current state

- The "RADIUS/UDP considered harmful" paper (Goldberg et al., USENIX Security 2024) is the contemporary canonical reference for the underlying weaknesses; the AirSnitch authors cite it. Their contribution is the *delivery mechanism* — port-stealing the AP's uplink to get the RADIUS packets in the first place.
- The fix is RadSec (RADIUS over TLS, RFC 6614) or RADIUS/DTLS (RFC 7360). Adoption is patchy.

## Implications for defenders

If your network uses WPA-Enterprise:

- Treat the AP→RADIUS link as if it could be intercepted by a Wi-Fi insider. Either run RadSec or pin the AP's RADIUS traffic to a dedicated VLAN that cannot be reached from any Wi-Fi BSSID.
- Use long, random RADIUS shared secrets (≥ 32 bytes, generated, not chosen by humans). Rotate when the AP is replaced.
- Monitor for RADIUS `Access-Request` packets that don't originate from the expected AP MACs.

## See also

- [WPA versions](/wiki/concepts/wpa-versions/)
- [Port stealing](/wiki/attacks/port-stealing/)
- [Rogue AP](/wiki/attacks/rogue-ap/)
- [MAC spoofing prevention](/wiki/defenses/spoofing-prevention/)
