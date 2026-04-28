---
title: Mobile Security Testing
permalink: /wiki/concepts/mobile-security/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/mobile-security/
---

**Category:** Mobile / Application Security
**MITRE ATT&CK:** T1476 — Deliver Malicious App via Other Means; T1516 — Input Injection
**Related:** [Social Engineering](/wiki/concepts/social-engineering/), [Phishing](/wiki/concepts/phishing/), [Web Application Testing](/wiki/concepts/web-application-testing/)

## Overview
Mobile penetration testing covers static analysis of apps, dynamic testing of APIs and data storage, and evaluation of device-level attack vectors including physical access, Bluetooth abuse, and social engineering via SMS and QR codes.

## Threat Vectors

### Application-Level

| Threat | Description |
|--------|-------------|
| Insecure data storage | Credentials, tokens in SharedPreferences, SQLite, or SD card |
| Insecure network | No cert pinning, cleartext traffic, weak TLS |
| Code vulnerabilities | Hardcoded secrets, debug code, SQL injection in app |
| Malicious apps | Repackaged/trojanized APKs distributed outside official stores |
| Deep link abuse | Intent hijacking via exposed Activities |

### Device/Social

| Threat | Description |
|--------|-------------|
| Smishing | SMS phishing — fake package notifications, bank alerts |
| Email phishing | Same as desktop phishing, smaller screen reduces scrutiny |
| QR phishing | Malicious QR codes in physical spaces or emails |
| Fake apps | Lookalike apps in third-party stores; credential harvesters |
| OAuth phishing | Fake OAuth consent screens stealing tokens |
| Bluetooth spoofing | Fake device pairing to enable eavesdropping or data exfil |
| Sideloading | Installing APKs outside Play Store via social engineering |
| MDM bypass | Exploiting MDM enrollment gaps to enroll attacker device |

## Static Analysis Tools

| Tool | Platform | Purpose |
|------|----------|---------|
| MobSF | Android / iOS | Automated static + dynamic analysis framework |
| AndroBugs | Android | Vulnerability scanner for APKs |
| Androwarn | Android | Detects potential malicious behaviors in APKs |
| MARA | Android | Mobile Application Reverse Engineering & Analysis |
| Qark | Android | Static analysis for common Android vulnerabilities |
| jadx | Android | APK decompiler to readable Java |
| apktool | Android | APK unpacker / smali disassembler |
| objection | Android / iOS | Runtime exploration using Frida |

## Dynamic Analysis Setup

### Android
```bash
# Extract APK
adb shell pm path com.target.app
adb pull /data/app/com.target.app-1/base.apk

# Static analysis
jadx -d output/ base.apk

# MobSF automated scan
docker pull opensecurity/mobile-security-framework-mobsf
docker run -it -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest

# Runtime analysis with Frida / objection
frida-server &   # on device (requires root)
objection -g com.target.app explore
```

### Certificate Pinning Bypass
```bash
# objection — runtime disable cert pinning
android sslpinning disable

# Frida script
frida -U -f com.target.app -l bypass-ssl-pinning.js --no-pause
```

## Common Findings

### Android
- `android:debuggable="true"` in `AndroidManifest.xml`
- `android:allowBackup="true"` — enables ADB backup of app data
- Exported Activities/Services without permission requirements
- Hardcoded API keys in `strings.xml` or smali code
- Sensitive data logged via `android.util.Log`
- WebView with JavaScript enabled + `addJavascriptInterface` (JS injection)

### iOS
- Sensitive data in NSUserDefaults or unencrypted SQLite
- ATS (App Transport Security) disabled
- Weak or missing keychain access controls
- Jailbreak detection that can be bypassed

## Bluetooth Attack Vectors
- **Spoofing:** Fake Bluetooth device name/MAC to appear as trusted peripheral
- **Eavesdropping:** If pairing uses weak/no PIN on older devices (BT 2.0)
- **BLUESMACK/BLUEBUGGING:** Historical — mostly patched; check older devices
- **BLE scan:** Enumerate BLE beacons, track movements, probe GATT characteristics

## OPSEC / Engagement Notes
- Mobile testing typically requires physical or MDM-enrolled device
- Over-the-air assessment requires attacker to be on same network segment (WiFi MITM)
- iOS testing without jailbreak is limited to API testing and binary analysis; Corellium provides cloud iOS virtualization

## References
- TrustedSec — "Common Mobile Device Threat Vectors" (2025-06-10)
- OWASP Mobile Security Testing Guide (MSTG)
- MobSF — github.com/MobSF/Mobile-Security-Framework-MobSF
