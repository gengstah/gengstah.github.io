---
title: Windows Service Triggers
permalink: /wiki/offsec-notes/concepts/windows-service-triggers/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Execution / Persistence / Privilege Escalation
**MITRE ATT&CK:** T1543.003 — Create or Modify System Process: Windows Service; T1574 — Hijack Execution Flow
**Related:** [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/), [Wmic](/wiki/offsec-notes/entities/wmic/)

## Overview
Windows service triggers allow services to start automatically when a specific condition is met — without modifying the service's start type. Several trigger types allow **low-privilege users** to start services they wouldn't otherwise be permitted to start, including Remote Registry, WebClient, and EFS. This is useful both for activating built-in services and for persistence via planted service trigger configurations.

## Trigger Types

### 1. Device Interface Arrival
Fires when a device of a specific hardware class is connected (USB, etc.). No code required to activate — just plug in hardware matching the class. Can be set to auto-trigger on boot using always-present device classes (e.g., `GUID_DEVINTERFACE_KEYBOARD`).

### 2. Domain Join
Fires at boot based on domain membership state:
- `DOMAIN_JOIN_GUID` → starts if machine IS domain-joined
- `DOMAIN_LEAVE_GUID` → starts if machine is NOT domain-joined

Useful for implanting a service that looks like a legitimate domain-aware component.

### 3. Firewall Port Event
Fires on **any** Windows Firewall configuration change (not just the specified port). Effectively auto-starts on boot as firewall config is applied.

**⚠️ Bug (reported to Microsoft 2025-09-04):** Providing a port without a protocol in the trigger config causes BFE (Base Filtering Engine) to fail at next boot — disabling the entire Windows Firewall.

### 4. Group Policy
Fires when Group Policy is updated.
- Use `gpupdate /force` as a low-privilege user to trigger the service
- Only useful for triggering, not boot persistence on non-domain machines

### 5. IP Address Available
Fires when first IP address is assigned or last is removed. In normal environments this fires on every boot — effectively another auto-start mechanism.

### 6. Network Endpoint (Named Pipe / RPC) — Most Useful for Pentesters
**Named pipe triggers:** Service starts when any process attempts to connect to the named pipe — even without the connection completing.

**RPC endpoint triggers:** Service starts when the endpoint mapper is queried for a specific interface UUID.

Both can be triggered by a **low-privilege user** remotely.

### 7. System State Change (WNF)
Undocumented — triggers on Windows Notification Facility (WNF) messages. Research area.

### 8. Custom ETW
Fires when a specific ETW provider raises a message. WebClient service uses this trigger type.

### 9. Aggregate (Undocumented)
Combines multiple trigger conditions. Used by `CDPSvc` on Windows 11. Stored under `HKLM\SYSTEM\CurrentControlSet\Control\ServiceAggregatedEvents`.

## Tools for Listing Triggers

```cmd
# Native - list triggers for a service
sc.exe qtriggerinfo <servicename>
sc.exe qtriggerinfo remoteregistry
sc.exe qtriggerinfo webclient

# Registry query (raw trigger data)
reg query HKLM\SYSTEM\CurrentControlSet\Services\RemoteRegistry\TriggerInfo /s

# Win32 API (QueryServiceConfig2 with SERVICE_CONFIG_TRIGGER_INFO)
# TrustedSec CS-Situational-Awareness-BOF: sc_qtriggerinfo BOF

# Remote (RPC)
# Titanis framework: Scm.exe qtriggers
# Impacket structures defined but no example yet
```

## Activating Service Triggers

### Named Pipe (Remote Registry example)
Remote Registry has a trigger on the `winreg` named pipe. Start it without admin rights:
```powershell
# Ensure service is not DISABLED (must be DEMAND or AUTO)
ls \\localhost\pipe\winreg  # Accessing the pipe triggers the service
```

### RPC Endpoint
```cmd
# Start ClipSVC via its RPC endpoint
rpcping -s localhost -e endpoint_uuid -T ncacn_np
```

### ETW Trigger (WebClient)
```c
// Register ETW provider session for provider GUID
// {22B6D684-FA63-4578-87C9-EFFCBE6643C7} = WebClient trigger provider
// Any message raised by this provider starts WebClient
// See: tiraniddo.dev/2015/03/starting-webclient-service.html
```

## Offensive Use Cases

### 1. Start Services Without Admin
- `RemoteRegistry` — start via named pipe access → enables registry manipulation
- `WebClient` — start via ETW → enables WebDAV auth coercion (NTLM capture)
- `EFS` — start via named pipe → useful for certain bypass techniques

### 2. Persistence Without Modifying Start Type
Add a trigger to an existing (or planted) service so it starts automatically without changing from DISABLED — evades baseline checks that look for service start type changes.

### 3. Lateral Movement: Start Remote Registry Remotely
```powershell
# Low-privilege user on remote host — trigger RemoteRegistry via named pipe
ls \\<target>\pipe\winreg
# Service starts → now accessible for registry operations (with appropriate rights)
```

## Detection

- Service trigger configuration stored in `HKLM\SYSTEM\CurrentControlSet\Services\<name>\TriggerInfo` — changes here should be audited (Event ID 4657)
- New service installations with trigger info in the same registry write
- Named pipe connections to specific pipe names that are known service triggers

## References
- TrustedSec — "There's More than One Way to Trigger a Windows Service" (2025-10-16)
- TrustedSec CS-Situational-Awareness-BOF — github.com/trustedsec/CS-Situational-Awareness-BOF (sc_qtriggerinfo BOF)
- Titanis framework — github.com/trustedsec/Titanis
- tiraniddo.dev — "Starting WebClient Service Programmatically" (2015)
- SpecterOps — "Will WebClient Start" (2025-08-19)
