---
title: "Offensive Security Notes \u2014 Log"
permalink: /wiki/offsec-notes/log/
layout: single
author_profile: true
tags:
- offsec-notes
---

# Log

Append-only changelog. Newest entries at the top.

---

## 2026-04-25 — AirSnitch: Wi-Fi client isolation bypass (NDSS 2026)

Ingested "AirSnitch - Demystifying and Breaking.md" (Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, Vanhoef — UCR / KU Leuven).

**New pages:**
- `concepts/wi-fi-client-isolation-bypass.md` — GTK abuse (incl. Passpoint IGTK escalation), gateway bouncing, port stealing (downlink + uplink), broadcast reflection, full MitM construction, RADIUS credential extraction; OS acceptance matrix; tested device results table; defenses
- `entities/airsnitch.md` — macstealer PoC tool; setup, usage, lab environment (mac80211_hwsim)

**Updated pages:**
- `concepts/wireless-attacks.md` — added cross-reference to wi-fi-client-isolation-bypass
- `index.md` — added both new pages

---

## 2026-04-20 — Source ingestion batch 2 (21 new source files)

Ingested all `.md` files in `sources/` root not already in `sources/ingested/`. Created 13 new pages and updated 4 existing pages.

**New pages:**
- `concepts/applocker-abuse.md` — GhostLocker; AppIDSvc enablement; deny rules blocking EDR; detection Event IDs 8001/8004
- `concepts/bind-link-edr-tampering.md` — bindflt.sys folder redirection; EDR-Redir PoC; BfSetupFilter/BfRemoveMapping; Sysmon 7
- `concepts/beacon-object-files.md` — BOF architecture; async BOFs (BeaconWakeup/GetStopJobEvent); boflint linter; COFF format
- `concepts/chrome-ntlm-hash-leak.md` — DragonHash; drag-and-drop DownloadURL UNC coercion; Responder integration
- `concepts/credential-guard-bypass.md` — 4 bypass techniques: patching, pass-the-challenge, downgrade (CVE-2022-34709), SSP negotiation (DumpGuard)
- `concepts/edr-silencing.md` — 6 techniques: WFP (EDRSilencer), hosts file, routing table, NRPT, IPSec, IPMute
- `concepts/gac-hijacking.md` — MIGUIControls.dll via Mono.Cecil; ngen.exe uninstall; mmc.exe Task Scheduler trigger
- `concepts/linux-process-injection.md` — seccomp notify injection (no ptrace, any ptrace_scope); IFUNC resolver technique
- `concepts/lsass-dumping.md` — WerFaultSecure (Windows 8.1) PPL bypass; WSASS tool; PNG header swap; pypykatz
- `concepts/macos-jit-shellcode.md` — allow-jit/allow-unsigned-executable-memory entitlements; MAP_JIT RWX; common app targets
- `concepts/mobile-security.md` — MobSF/AndroBugs/MARA/Qark; smishing/QR/Bluetooth vectors; static analysis workflow
- `concepts/toast-notifications-abuse.md` — AUMID enumeration; Teams/Edge spoofing; ToastNotify BOF; wpnapps.dll detection
- `concepts/windows-service-triggers.md` — 9 trigger types; named pipe/RPC/ETW activation by low-priv user; Remote Registry trick

**Updated pages:**
- `concepts/jwt-attacks.md` — added x5c (embedded cert) and x5u (remote URL) certificate injection attacks; JWT_X509_Re-Signer
- `concepts/ai-agents-offensive.md` — added MCP+ilspycmd .NET deser hunting workflow; Dante-7B RLVR training; trapped COM LLM R&D
- `concepts/lateral-movement.md` — added SpeechRuntime COM hijacking (CLSID {655D9BF9}); winsta.dll session enum; cross-session activation
- `index.md` — added all new pages to appropriate categories

**Sources ingested:**
- "AppLocker Rules Abuse" (ipurple.team 2026-02-02)
- "Async BOFs: Taking the Lead" (Outflank 2025-07-16)
- "Attacking JWT using X509 Certificates" (TrustedSec 2025-06-17)
- "Bind Link – EDR Tampering" (ipurple.team 2025-12-01)
- "BOF Linting with boflint" (Outflank 2025-06-30)
- "Common Mobile Device Threat Vectors" (TrustedSec 2025-06-10)
- "Credential Guard" (ipurple.team 2026-03-17)
- "Dragging Secrets Out of Chrome: NTLM Hash Leaks" (TrustedSec 2025-06-13)
- "EDR Silencing" (ipurple.team 2026-01-12)
- "GAC Hijacking" (ipurple.team 2026-02-10)
- "Accelerating Offensive R&D with LLMs" (Outflank 2025-07-31)
- "Hunting Deserialization Vulnerabilities With Claude" (TrustedSec 2025-06-12)
- "Linux Process Injection via Seccomp Notify" (Outflank 2025-12-09)
- "LSASS Dump – Windows Error Reporting" (ipurple.team 2025-11-18)
- "macOS JIT Memory" (Outflank 2026-02-19)
- "Microsoft Speech" (ipurple.team 2026-04-07)
- "There's More than One Way to Trigger a Windows Service" (TrustedSec 2025-10-16)
- "Toast Notifications" (ipurple.team 2026-03-25)
- "Training Specialist Models" (Outflank 2025-08-07)
- "Purpling Your Ops" (TrustedSec 2025-05-15) — no new page; general purple team guidance
- "Helpful Hints for Writing Cybersecurity Reports" (TrustedSec) — no new page; editorial guidance only

---

## 2026-04-19 — Source ingestion complete (13 TrustedSec articles)

Ingested all 13 source files from `sources/`. Created 12 new pages and updated 2 existing pages.

**New pages:**
- `concepts/jwt-attacks.md` — JWT structure, 9 attack techniques (alg:none, weak HMAC, key confusion, JWK/jku/kid attacks)
- `concepts/dll-hijacking.md` — search order hijacking, sideloading, CVE-2025-1729 (Lenovo), Narrator.exe persistence
- `concepts/kubernetes-pentesting.md` — K8s terminology, port reference, API/etcd/kubelet probing, pod escape
- `concepts/lnk-file-attacks.md` — CVE-2026-25185 no-click NTLM capture; .lnk structure deep-dive; LnkMeMaybe tool
- `concepts/ai-agents-offensive.md` — MCP/FastMCP offensive agents; Mythic C2 integration; ReAct paradigm
- `concepts/notepadplusplus-abuse.md` — plugin DLL execution; PythonScript v3 reflective loader; offline packages
- `concepts/offensive-python.md` — MS Store install without admin; ctypes Win32 API; offline pip; IOC profile
- `concepts/mdt-credential-extraction.md` — Bootstrap.ini, CustomSettings.ini, ts.xml, unattend.xml credential locations
- `concepts/wsus-attacks.md` — NTLM relay via WSUS HTTP (8530) and HTTPS (8531); ARP spoof + ntlmrelayx; ADCS bypass
- `concepts/vpn-abuse-windows.md` — standard-user routing table manipulation; SSTP; MitM via built-in VPN providers
- `entities/wmic.md` — WMIC as shell alternative; XSL code execution; remote /node: usage
- `entities/wmic.md` is already listed above

**Updated pages:**
- `concepts/active-directory-attacks.md` — added honeypot account method for zero-FP password spray detection
- `index.md` — added all new pages to appropriate categories

**Sources ingested:**
- "Keys to JWT Assessments" (TrustedSec 2026-02-05)
- "Command Line Underdog: WMIC in Action" (2025-01-14)
- "CVE-2025-1729: Privilege Escalation Using TPQMAssistant.exe" (2025-07-08)
- "Hack-cessibility: When DLL Hijacks Meet Windows Helpers" (2025-10-28)
- "Kubernetes for Pentesters: Part 1" (2025-04-08)
- "LnkMeMaybe — A Review of CVE-2026-25185" (2026)
- "MCP: An Introduction to Agentic Op Support" (2025-03-28)
- "Notepad++ Plugins: Plug and Payload" (2026-02-19)
- "Operating Inside the Interpreted: Offensive Python" (2025-01-23)
- "Red Team Gold: Extracting Credentials from MDT Shares" (2025-05-20)
- "WSUS Is SUS: NTLM Relay Attacks in Plain Sight" (2025-09-12)
- "Detecting AD Password-Spraying with a Honeypot Account" (2025-09-09)
- "Abusing Windows Built-in VPN Providers" (2025-03-11)

---

## 2026-04-19 — Wiki initialized

Created the offensive security LLM wiki from scratch.

**Schema:** `schema.md` — defines structure, page types, and operating procedures.

**Index:** `index.md` — seeded with all initial pages.

**Seed pages created:**

Concepts:
- `concepts/reconnaissance.md`
- `concepts/network-scanning.md`
- `concepts/web-application-testing.md`
- `concepts/sql-injection.md`
- `concepts/xss.md`
- `concepts/active-directory-attacks.md`
- `concepts/kerberoasting.md`
- `concepts/pass-the-hash.md`
- `concepts/lateral-movement.md`
- `concepts/privilege-escalation-linux.md`
- `concepts/privilege-escalation-windows.md`
- `concepts/post-exploitation.md`
- `concepts/command-and-control.md`
- `concepts/cloud-penetration-testing.md`
- `concepts/social-engineering.md`
- `concepts/phishing.md`
- `concepts/red-teaming.md`
- `concepts/purple-teaming.md`
- `concepts/vulnerability-assessment.md`
- `concepts/wireless-attacks.md`
- `concepts/buffer-overflow.md`
- `concepts/evasion-techniques.md`

Entities:
- `entities/metasploit.md`
- `entities/nmap.md`
- `entities/burp-suite.md`
- `entities/cobalt-strike.md`
- `entities/bloodhound.md`
- `entities/impacket.md`
- `entities/mimikatz.md`
- `entities/nuclei.md`
- `entities/responder.md`

Playbooks:
- `playbooks/internal-network-pentest.md`
- `playbooks/web-app-pentest.md`
- `playbooks/active-directory-pentest.md`
- `playbooks/external-pentest.md`
