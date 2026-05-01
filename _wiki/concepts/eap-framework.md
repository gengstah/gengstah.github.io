---
title: "EAP Framework"
permalink: /wiki/concepts/eap-framework/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - eap
  - enterprise
---

*EAP — the negotiation skeleton inside which every Wi-Fi Enterprise authentication method runs. Method-agnostic on purpose; method-defined where it matters.*

**Status:** drafting
**Related:** [802.1X](/wiki/concepts/8021x/), [EAP-TLS](/wiki/concepts/eap-tls/), [PEAP / EAP-TTLS](/wiki/concepts/peap-ttls/), [EAP-PWD](/wiki/concepts/eap-pwd/)

---

## What EAP is

The *Extensible Authentication Protocol* (RFC 3748). A request/response message format with **method types** that the negotiating peers select from.

Frame format:

```
Code (1) | ID (1) | Length (2) | Type (1) | Data ...
```

| Code | Name |
|---|---|
| 1 | Request — from authenticator to supplicant. |
| 2 | Response — from supplicant. |
| 3 | Success. |
| 4 | Failure. |

`Type` selects the method:

| Type | Method |
|---|---|
| 1 | Identity |
| 2 | Notification |
| 3 | NAK (response to Request: "I won't do this method, propose another") |
| 4 | MD5-Challenge (broken) |
| 5 | One-Time Password |
| 6 | Generic Token Card |
| 13 | EAP-TLS |
| 17 | EAP-LEAP (Cisco, broken) |
| 18 | EAP-SIM |
| 21 | EAP-TTLS |
| 23 | EAP-AKA |
| 25 | PEAP |
| 26 | EAP-MSCHAPv2 |
| 43 | EAP-FAST |
| 47 | EAP-PSK |
| 48 | EAP-PAX |
| 50 | EAP-AKA' |
| 52 | EAP-PWD |
| 254 | Expanded Type (vendor-specific) |

## Negotiation

The Authenticator (AP, via RADIUS) sends `Request / Identity` first. The Supplicant replies. The Authenticator's auth server then sends `Request / Type=X` for some method. If the Supplicant doesn't speak X, it replies with `Response / NAK` listing types it does support. They iterate until they agree.

This is the **method down-selection** surface. A rogue RADIUS server can refuse strong methods and force a weaker one (e.g. force EAP-MSCHAPv2 directly without TLS wrapping). Modern supplicants reject this; older ones don't.

## Inner / outer methods

Most modern EAP methods are *tunnelled*: an outer TLS exchange protects an inner authentication.

| Outer | Inner | Purpose |
|---|---|---|
| TLS | (none) | EAP-TLS: cert-based mutual auth. |
| PEAP | MSCHAPv2 / GTC / TLS | PEAP-MSCHAPv2 is the "AD-creds-over-Wi-Fi" classic. |
| TTLS | PAP / CHAP / MSCHAPv2 | EAP-TTLS allows *non-EAP* inner methods. |
| FAST | MSCHAPv2 / GTC | Cisco fork; PAC instead of cert. |

The inner identity and credential are not visible until inside the tunnel. That's how PEAP/TTLS get away with sending "anonymous@realm" as the outer Identity.

## MSK and EMSK

After the EAP method finishes:

- **MSK** (Master Session Key) — 64 bytes, derived deterministically inside the method. Sent from RADIUS server to AP in `MS-MPPE-Recv-Key` / `MS-MPPE-Send-Key` attributes (encrypted under the RADIUS shared secret).
- **EMSK** (Extended Master Session Key) — also 64 bytes. Stays with the home server; used for derivation of FILS / 11r FT material.

Wi-Fi's PMK is the first 32 bytes of MSK. The 4-way handshake then derives PTK from PMK + nonces.

## Channel binding

A defence against [PEAP](/wiki/concepts/peap-ttls/)-style relay: bind the inner authentication to the outer TLS session via TLS Exporter (RFC 5705). A relay attacker terminating the supplicant's TLS sees a different exporter value than the legitimate server, and the inner auth fails.

Adoption is partial. Microsoft NPS supports it; many supplicants don't enable it.

## Identity privacy and pseudonymity

The first EAP-Identity is sent in the clear (it's pre-tunnel). A real username here = privacy leak. Standard mitigations:

- **Anonymous identity** in PEAP / TTLS — `anonymous@realm`. The realm is needed for RADIUS routing; the username inside TLS.
- **Pseudonyms** (EAP-SIM/AKA) — an opaque identifier per session, mapped server-side.
- **Permanent identifiers** — IMSI for SIM-based methods. Concealed in 5G via SUCI (concealed SUPI), not yet in widespread Wi-Fi use.

## Common attack surfaces

- **Rogue RADIUS server** (eaphammer, hostapd-wpe). Captures inner method credentials.
- **MSCHAPv2 cracking.** Inner-method captures yield NTLM hashes that crack offline.
- **Method downgrade.** Rogue AP refuses TLS, forces MD5 / GTC / MSCHAPv2 outer.
- **Supplicant logic flaws.** [CVE-2023-52160](/wiki/attacks/peap-bypass/) — wpa_supplicant accepts a forged inner-method success without server auth (PEAP). [CVE-2023-52161](/wiki/attacks/peap-bypass/) — IWD state machine completes 4-way without finishing EAP.
- **Lack of CA pinning.** Trusting "any public CA" lets an attacker mint a valid-but-irrelevant cert and impersonate the RADIUS server.

## See also

- [802.1X](/wiki/concepts/8021x/) — the transport.
- [EAP-TLS](/wiki/concepts/eap-tls/) — cert-based.
- [PEAP / EAP-TTLS](/wiki/concepts/peap-ttls/) — TLS-tunnelled.
- [EAP-PWD](/wiki/concepts/eap-pwd/) — Dragonfly password.

## References

- RFC 3748 — *Extensible Authentication Protocol*.
- RFC 5247 — *EAP Key Management Framework*.
- Bhargavan et al. — *Triple Handshakes and Cookie Cutters: Breaking and Fixing Authentication over TLS* — relevant to channel binding.
