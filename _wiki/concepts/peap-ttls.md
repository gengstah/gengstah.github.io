---
title: "PEAP and EAP-TTLS"
permalink: /wiki/concepts/peap-ttls/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - eap
  - peap
  - ttls
  - enterprise
---

*The two TLS-tunnelled EAP methods that pair an outer TLS handshake (server-only auth) with an inner password mechanism. The default for AD-shop Wi-Fi Enterprise — and the most-attacked Enterprise method.*

**Status:** drafting
**Related:** [EAP framework](/wiki/concepts/eap-framework/), [EAP-TLS](/wiki/concepts/eap-tls/), [802.1X](/wiki/concepts/8021x/), [PEAP / IWD bypass](/wiki/attacks/peap-bypass/)

---

## PEAP — Protected EAP

Microsoft / Cisco / RSA proposed PEAP in the early 2000s as a deployment-friendlier alternative to EAP-TLS — only the **server** needs a cert; the client authenticates inside the TLS tunnel with a password.

### Flow

1. Outer TLS handshake. Server presents cert; supplicant validates (in theory).
2. After TLS, inner EAP starts. Supplicant sends inner Identity (real username).
3. Server runs an inner EAP method — almost always **EAP-MSCHAPv2** in AD environments, occasionally **GTC** (token) or **TLS** (PEAP-TLS).
4. Inner method completes. Server sends **PEAP TLV-Success** or **TLV-Failure** inside the tunnel.
5. Outer EAP-Success.
6. MSK derivation from outer TLS exporter.

### EAP-MSCHAPv2 inside PEAP

The most common inner method. MSCHAPv2 is challenge-response:

```
server     →  challenge_S (16 bytes)
client     →  challenge_C (16 bytes), NT-Response = NTLMv1(NTHash, SHA1(challenge_S || challenge_C || username))
server     →  Auth-Response (proves server has the same hash)
```

The credential is the **NT hash** (MD4 of UTF-16-LE password), aka the user's NTLM hash. The Wi-Fi engineering team rarely thinks of it that way; the AD team does.

## EAP-TTLS — Tunnelled TLS

Functionally similar to PEAP, with one key difference: the inner method need **not** be EAP. It can be plain PAP, CHAP, MSCHAP, MSCHAPv2 — non-EAP password mechanisms. This is why EAP-TTLS is popular with non-Microsoft auth back-ends (LDAP, Kerberos, Radiator).

### EAP-TTLS-PAP

The inner exchange is just `PAP { username, password }` in clear text, inside the TLS tunnel. The RADIUS server knows the cleartext password (or can validate against an LDAP bind). This is functionally **equivalent to plaintext password over TLS** — fine if the TLS is sound, devastating otherwise.

## The shared weakness: server cert validation

Both PEAP and TTLS depend on the supplicant *validating the server's cert* before sending the inner credential. Without that, every "minor" mistake lets an attacker capture credentials:

| Misconfig | Effect |
|---|---|
| No CA pinning, default Windows profile | Trust any cert chained to a public CA. Attacker buys cert for `radius.example.com`, presents it; supplicant happy; attacker captures inner MSCHAPv2. |
| `ValidateServerCertificate = no` (Android, custom profiles) | Same, but worse — accepts any cert. |
| Server-name mismatch tolerated | Attacker uses a cert for an unrelated name. |
| Pinned to public CA but not specific server | Same as no pinning, effectively. |

The relay attack pattern, sometimes called the "Cloudflare-of-Wi-Fi":

1. Stand up rogue RADIUS server (eaphammer / hostapd-wpe). Use a cert the victim's supplicant will accept.
2. Victim STA initiates PEAP. Attacker terminates the outer TLS.
3. Victim sends inner MSCHAPv2 challenge/response.
4. Attacker either (a) forwards the inner exchange to the legitimate RADIUS server (relay), or (b) captures the response and cracks the NT hash offline (`hashcat -m 5500`).

Either path produces working AD credentials.

## eaphammer attacks at a glance

```
# Capture creds against a specific SSID
eaphammer -i wlan0 --essid CorpWiFi --auth wpa-eap --creds

# Force EAP-MSCHAPv2 (no inner-method down-select to GTC, etc.)
eaphammer ... --negotiate weakest

# GTC downgrade (shows password in clear)
eaphammer ... --auth wpa-eap --creds --negotiate gtc-downgrade
```

`hostapd-wpe` is the older / canonical tool; eaphammer wraps it.

## Recent supplicant logic flaws

[CVE-2023-52160 / 52161](/wiki/attacks/peap-bypass/) — Vanhoef + Heitman.

- **CVE-2023-52160** — wpa_supplicant accepts a server-side `PEAP TLV-Success` *before* the inner method has actually completed. Attacker sends Success; supplicant proceeds to 4-way handshake; if the network is open at L3, attacker has decryptable traffic.
- **CVE-2023-52161** — IWD (Intel's WPA supplicant) similar logic flaw skipping inner method entirely.

Both are *supplicant-side* bypasses, independent of the more familiar relay attacks.

## When PEAP/TTLS is fine

- Strict CA pinning (only org's enterprise root) AND server-name verification AND hardware-managed profile (MDM-pushed; user can't disable validation).
- TLS 1.2+ with strong ciphers.
- Channel binding enabled (rarely deployed).

In practice, EAP-TLS is preferred for new deployments when feasible.

## See also

- [EAP framework](/wiki/concepts/eap-framework/) — the surrounding negotiation.
- [EAP-TLS](/wiki/concepts/eap-tls/) — the cert-only alternative.
- [PEAP / IWD bypass](/wiki/attacks/peap-bypass/) — recent supplicant flaws.
- [Active Directory attacks](/wiki/concepts/active-directory-attacks/) — what you do with the captured NT hashes.

## References

- *Protected EAP Protocol (PEAP)* — IETF draft (Microsoft).
- RFC 5281 — *Extensible Authentication Protocol Tunneled Transport Layer Security Authenticated Protocol Version 0 (EAP-TTLSv0)*.
- Vanhoef + Heitman — CVE-2023-52160 / 52161 disclosures (Feb 2024).
