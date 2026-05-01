---
title: "EAP-TLS"
permalink: /wiki/concepts/eap-tls/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - eap
  - eap-tls
  - certificates
---

*Mutual cert-based authentication for Wi-Fi Enterprise. The strongest of the EAP methods if deployed correctly — and a deployment headache that pushes most environments to PEAP-MSCHAPv2 instead.*

**Status:** drafting
**Related:** [EAP framework](/wiki/concepts/eap-framework/), [PEAP / EAP-TTLS](/wiki/concepts/peap-ttls/), [802.1X](/wiki/concepts/8021x/), [Active Directory attacks](/wiki/concepts/active-directory-attacks/)

---

## What it is

A standard TLS handshake (RFC 5216 for TLS 1.2; RFC 9190 for TLS 1.3) embedded in EAP. **Both sides present certificates**:

- The supplicant presents a client cert (issued by the org's enterprise CA, often via AD CS / Intune SCEP).
- The RADIUS server presents a server cert (issued by the same enterprise CA).

After the TLS handshake completes, both sides have a shared secret (the TLS PMS / master secret); from it the EAP-TLS spec derives the MSK that becomes the Wi-Fi PMK. No password, no inner method.

## Why it's the strongest

- **Mutual auth.** Rogue RADIUS without the org's CA's signing key cannot satisfy the supplicant's server-cert validation. Rogue clients without a valid client cert cannot satisfy the server.
- **No password to phish.** There's no MSCHAPv2 hash that an attacker can crack offline. Possession of the private key is the credential.
- **Long credential lifetime.** Rotate via cert renewal, not password change.
- **Hardware-backed.** Client private keys can live in TPM, Secure Enclave, smart card — non-extractable.

## Why it's painful to deploy

- **Cert distribution.** Every laptop, phone, IoT device needs a client cert. AD CS auto-enrolment handles domain-joined Windows; Apple / Android require profile pushes (Intune, JAMF, etc.).
- **Cert lifecycle.** Issuance, renewal, revocation. CRL / OCSP availability matters — RADIUS servers must check.
- **Non-standard devices.** IoT, printers, BMS controllers often can't carry client certs and end up on a parallel WPA2-PSK network.
- **CA private key custody.** Compromise of the enterprise CA = compromise of every client. AD CS [Certified Pre-Owned](/wiki/concepts/active-directory-attacks/) attacks (ESC1-ESC15) are exactly the chain that does this.

This last point is the one that matters most for offence: the AD CS attack surface bleeds directly into Wi-Fi auth. An attacker with `ESC1` enrol-on-behalf-of can mint themselves a client cert for any user and walk onto the corporate Wi-Fi.

## TLS version specifics

- **TLS 1.2 + EAP-TLS** — RFC 5216. The supplicant validates the server cert *before* sending its own ClientCertificateVerify, so the server cert is authenticated first.
- **TLS 1.3 + EAP-TLS** — RFC 9190. Different handshake structure (1-RTT, 0-RTT). Some early implementations had bugs in mapping TLS 1.3 finished/exporter into EAP-TLS MSK derivation.
- **EAP-TLS-PSK** (less common) replaces the cert with a pre-shared key.

## Common misconfigurations

- **No CA pinning on the supplicant.** Even with EAP-TLS, if the supplicant accepts any public CA's cert as the server cert, an attacker can buy `wifi-radius.example.com` from a public CA and stand up a rogue RADIUS terminating EAP-TLS. The client cert is sent and either accepted or rejected — but the attacker has now defeated server auth and (depending on the misconfig) can capture client cert chains.
- **No revocation checking.** An attacker who steals a client cert from a decommissioned laptop / departed employee can use it indefinitely.
- **Weak key generation.** Old AD CS templates with 1024-bit RSA. Modern: 2048+ RSA or P-256 ECDSA.
- **Cert template misconfigurations** — AD CS ESC1-style flaws let an attacker enrol as another user.

## Rogue-RADIUS / impersonation defences

- **CA pinning** — supplicant trusts only the enterprise root CA, not the public trust store.
- **Server name** — supplicant verifies the cert's CN/SAN matches the configured RADIUS server name.
- **Channel binding** — bind inner state to TLS exporter (limited adoption; mostly relevant in tunnelled methods rather than pure EAP-TLS).

In Windows, these settings live under "Authentication settings → CA + server name". Default profiles built by GPO often pin them; user-built profiles often don't.

## Tooling

- **eaphammer** can run as a rogue RADIUS server requesting EAP-TLS, but without the enterprise CA's signing key it can only test misconfigured supplicants (those that don't pin the CA).
- **mitm6 + ntlmrelayx** chains aren't directly applicable to EAP-TLS but ARE applicable to mixed environments where machine-cert auth happens via SChannel.
- **Certify** / **Certipy** enumerate AD CS templates; an ESC1+EAP-TLS chain is the Wi-Fi-relevant flavour.

## See also

- [PEAP / EAP-TTLS](/wiki/concepts/peap-ttls/) — what most environments end up using instead.
- [Active Directory attacks](/wiki/concepts/active-directory-attacks/) — AD CS abuse.
- [802.1X](/wiki/concepts/8021x/), [EAP framework](/wiki/concepts/eap-framework/).

## References

- RFC 5216 — *The EAP-TLS Authentication Protocol*.
- RFC 9190 — *EAP-TLS 1.3*.
- Schroeder + Christensen — *Certified Pre-Owned* — SpecterOps — AD CS abuse.
