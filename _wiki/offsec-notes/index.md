---
title: "Offensive Security Notes \u2014 Index"
permalink: /wiki/offsec-notes/
layout: single
author_profile: true
tags:
- offsec-notes
---

# Offensive Security Wiki — Index

Categorized table of contents. All pages cross-linked.
See `schema.md` for structure and operating procedures.

---

## Methodology & Engagements

- [Vulnerability Assessment](/wiki/offsec-notes/concepts/vulnerability-assessment/) — VA methodology, tools, CVSS, authenticated vs. unauthenticated scanning
- [Red Teaming](/wiki/offsec-notes/concepts/red-teaming/) — adversary simulation, engagement phases, OPSEC, threat actor emulation
- [Purple Teaming](/wiki/offsec-notes/concepts/purple-teaming/) — collaborative detection validation, Atomic Red Team, ATT&CK coverage mapping

---

## Reconnaissance & OSINT

- [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/) — passive and active recon, OSINT sources, tools
- [Network Scanning](/wiki/offsec-notes/concepts/network-scanning/) — host discovery, port scanning, service fingerprinting, evasion

---

## Web Application

- [Web Application Testing](/wiki/offsec-notes/concepts/web-application-testing/) — full web app testing methodology (OWASP)
- [Sql Injection](/wiki/offsec-notes/concepts/sql-injection/) — SQLi types, DB-specific tricks, WAF evasion, tools
- [Xss](/wiki/offsec-notes/concepts/xss/) — reflected, stored, DOM-based XSS; CSP bypass, BeEF
- [Jwt Attacks](/wiki/offsec-notes/concepts/jwt-attacks/) — alg:none, weak HMAC, key confusion, JWK/jku injection, kid path traversal, x5c/x5u cert injection

---

## Active Directory / Windows

- [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/) — overview of all major AD attack categories; honeypot spray detection
- [Kerberoasting](/wiki/offsec-notes/concepts/kerberoasting/) — SPN account hash extraction and cracking
- [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/) — NTLM PtH, Kerberos PtT, overpass-the-hash
- [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/) — SMB, WMI, WinRM, DCOM, pivoting; SpeechRuntime COM hijacking
- [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/) — token abuse, service misconfig, AlwaysInstallElevated, kernel exploits
- [Dll Hijacking](/wiki/offsec-notes/concepts/dll-hijacking/) — search order hijacking, sideloading, CVE-2025-1729, Narrator.exe persistence
- [Mdt Credential Extraction](/wiki/offsec-notes/concepts/mdt-credential-extraction/) — MDT share credential exposure; Bootstrap.ini, ts.xml, unattend.xml
- [Wsus Attacks](/wiki/offsec-notes/concepts/wsus-attacks/) — NTLM relay via WSUS HTTP/HTTPS; ARP spoof + ntlmrelayx; ADCS HTTPS bypass
- [Lnk File Attacks](/wiki/offsec-notes/concepts/lnk-file-attacks/) — CVE-2026-25185; no-click NTLM capture; .lnk structure and abuse
- [Credential Guard Bypass](/wiki/offsec-notes/concepts/credential-guard-bypass/) — 4 techniques: patching, pass-the-challenge, downgrade, SSP negotiation (DumpGuard)
- [Lsass Dumping](/wiki/offsec-notes/concepts/lsass-dumping/) — LSASS credential dump methods; WerFaultSecure PPL bypass; PNG header evasion
- [Gac Hijacking](/wiki/offsec-notes/concepts/gac-hijacking/) — MIGUIControls.dll tampering via Mono.Cecil; mmc.exe Task Scheduler persistence
- [Applocker Abuse](/wiki/offsec-notes/concepts/applocker-abuse/) — EDR blocking via AppLocker deny rules; AppIDSvc enablement; GhostLocker
- [Chrome Ntlm Hash Leak](/wiki/offsec-notes/concepts/chrome-ntlm-hash-leak/) — DragonHash; drag-and-drop UNC NTLM coercion; no-admin required
- [Windows Service Triggers](/wiki/offsec-notes/concepts/windows-service-triggers/) — low-priv service activation; named pipe/RPC/ETW triggers; Remote Registry
- [Toast Notifications Abuse](/wiki/offsec-notes/concepts/toast-notifications-abuse/) — AUMID spoofing; Teams/Edge impersonation; credential phishing via toasts
- [Edr Silencing](/wiki/offsec-notes/concepts/edr-silencing/) — 6 techniques: WFP, hosts file, routing, NRPT, IPSec, IPMute
- [Bind Link Edr Tampering](/wiki/offsec-notes/concepts/bind-link-edr-tampering/) — bindflt.sys folder redirection; EDR-Redir; DLL hijacking in EDR context

---

## Linux / macOS / Post-Exploitation

- [Privilege Escalation Linux](/wiki/offsec-notes/concepts/privilege-escalation-linux/) — sudo misconfig, SUID, cron, capabilities, kernel exploits
- [Linux Process Injection](/wiki/offsec-notes/concepts/linux-process-injection/) — seccomp notify injection (no ptrace); ptrace/procfs/process_vm_writev; shared lib injection
- [Macos Jit Shellcode](/wiki/offsec-notes/concepts/macos-jit-shellcode/) — allow-jit entitlement; MAP_JIT shellcode execution; Firefox/VSCode/Office targets
- [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/) — persistence, credential harvesting, data collection, exfiltration

---

## Infrastructure & C2

- [Command And Control](/wiki/offsec-notes/concepts/command-and-control/) — C2 architecture, protocols, frameworks, Malleable C2, OPSEC
- [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/) — AV/EDR bypass, AMSI, process injection, DLL sideloading, LOLBins
- [Vpn Abuse Windows](/wiki/offsec-notes/concepts/vpn-abuse-windows/) — standard-user routing table manipulation; SSTP; MITM via built-in VPN
- [Beacon Object Files](/wiki/offsec-notes/concepts/beacon-object-files/) — BOF architecture; async BOFs (BeaconWakeup); boflint linting; COFF format
- [Ai Agents Offensive](/wiki/offsec-notes/concepts/ai-agents-offensive/) — MCP offensive agents; ilspycmd .NET vuln hunting; Dante-7B RLVR; trapped COM R&D

---

## Cloud / Containers

- [Cloud Penetration Testing](/wiki/offsec-notes/concepts/cloud-penetration-testing/) — AWS, Azure, GCP; IAM attacks, metadata, storage, privilege escalation
- [Kubernetes Pentesting](/wiki/offsec-notes/concepts/kubernetes-pentesting/) — K8s recon, API server, etcd, kubelet exploitation; port reference

---

## Social Engineering & Phishing

- [Social Engineering](/wiki/offsec-notes/concepts/social-engineering/) — vishing, smishing, pretexting, physical SE
- [Phishing](/wiki/offsec-notes/concepts/phishing/) — credential harvesting, AiTM, malware delivery, infrastructure setup
- [Chrome Ntlm Hash Leak](/wiki/offsec-notes/concepts/chrome-ntlm-hash-leak/) — DragonHash drag-and-drop UNC coercion (also in AD/Windows)
- [Toast Notifications Abuse](/wiki/offsec-notes/concepts/toast-notifications-abuse/) — Windows toast notification spoofing for user manipulation
- [Mobile Security](/wiki/offsec-notes/concepts/mobile-security/) — smishing, QR phishing, Bluetooth spoofing, MobSF, static analysis

---

## Network / Wireless

- [Wireless Attacks](/wiki/offsec-notes/concepts/wireless-attacks/) — WPA2-PSK, WPA2-Enterprise (PEAP), evil twin, Bluetooth
- [Wi Fi Client Isolation Bypass](/wiki/offsec-notes/concepts/wi-fi-client-isolation-bypass/) — GTK abuse, gateway bouncing, port stealing, broadcast reflection; full MitM bypassing client isolation (NDSS 2026)

---

## Exploit Development

- [Buffer Overflow](/wiki/offsec-notes/concepts/buffer-overflow/) — stack overflow, ROP, heap exploitation, format strings, mitigations

---

## Tools (Entity Pages)

### Frameworks
- [Metasploit](/wiki/offsec-notes/entities/metasploit/) — MSF; exploit, auxiliary, post modules; msfvenom
- [Cobalt Strike](/wiki/offsec-notes/entities/cobalt-strike/) — commercial C2; Beacon, Malleable C2 profiles, post-ex

### Active Directory
- [Bloodhound](/wiki/offsec-notes/entities/bloodhound/) — attack path graph analysis; SharpHound collection; Cypher queries
- [Impacket](/wiki/offsec-notes/entities/impacket/) — Python AD attack toolkit; PtH, DCSync, Kerberoasting, relay
- [Mimikatz](/wiki/offsec-notes/entities/mimikatz/) — credential extraction; Golden/Silver tickets; DCSync; OPSEC notes
- [Responder](/wiki/offsec-notes/entities/responder/) — LLMNR/NBT-NS poisoning; NTLM hash capture; relay setup

### Wireless
- [Airsnitch](/wiki/offsec-notes/entities/airsnitch/) — macstealer PoC; gateway bouncing, port stealing, GTK abuse; NDSS 2026

### Scanning & Recon
- [Nmap](/wiki/offsec-notes/entities/nmap/) — network scanner; NSE scripts; timing; evasion flags
- [Nuclei](/wiki/offsec-notes/entities/nuclei/) — template-based vulnerability scanner; custom templates; project discovery workflow
- [Burp Suite](/wiki/offsec-notes/entities/burp-suite/) — web app intercepting proxy; Repeater, Intruder, Scanner, extensions

### LOLBins & Interpreted Languages
- [Wmic](/wiki/offsec-notes/entities/wmic/) — WMI shell when cmd/PS blocked; XSL code execution; remote /node: usage
- [Offensive Python](/wiki/offsec-notes/concepts/offensive-python/) — MS Store install without admin; ctypes Win32 API; offline pip; reflective DLL loader
- [Notepadplusplus Abuse](/wiki/offsec-notes/concepts/notepadplusplus-abuse/) — plugin DLL execution; PythonScript reflective loader; offline packages

---

## Playbooks (Step-by-Step Procedures)

- [External Pentest](/wiki/offsec-notes/playbooks/external-pentest/) — external attack surface recon, vuln ID, initial access
- [Internal Network Pentest](/wiki/offsec-notes/playbooks/internal-network-pentest/) — internal LAN testing from domain user to DA
- [Active Directory Pentest](/wiki/offsec-notes/playbooks/active-directory-pentest/) — AD-focused; ACL abuse, delegation, ADCS, DCSync
- [Web App Pentest](/wiki/offsec-notes/playbooks/web-app-pentest/) — web app testing from mapping to injection to logic flaws

---

## Engagements

*(Empty — add per-engagement notes here as they are created)*

---

## How to Use This Wiki

**Ingest a new source:** Paste it and say "ingest this." Claude will update relevant pages and the log.

**Ask a question:** "How do I exploit RBCD?" → Claude reads relevant pages and synthesizes an answer.

**Add a topic:** "Add a page on SSRF" → Claude creates `concepts/ssrf.md` and updates the index.

**Lint:** "Lint the wiki" → Claude checks for orphans, contradictions, stale references.
