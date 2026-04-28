---
title: BloodHound
permalink: /wiki/tools/bloodhound/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
redirect_from:
- /wiki/tools/bloodhound/
---

**Type:** Tool / Framework
**Also known as:** BloodHound CE (Community Edition), BloodHound Enterprise (commercial)
**Related:** [Active Directory Attacks](/wiki/concepts/active-directory-attacks/), [Kerberoasting](/wiki/concepts/kerberoasting/), [Lateral Movement](/wiki/concepts/lateral-movement/)

## Description
BloodHound uses graph theory to reveal hidden attack paths in Active Directory and Azure AD environments. SharpHound (Windows) or BloodHound.py (Linux) collect AD data and BloodHound visualizes it as a graph. Attackers use it to identify the shortest path from any compromised account to Domain Admin. Defenders use it to find and eliminate those paths.

## Usage / Details

### Collection (SharpHound / BloodHound.py)
```bash
# Windows: SharpHound (run as domain user)
.\SharpHound.exe -c All --outputdirectory C:\temp\
.\SharpHound.exe -c DCOnly                     # DC-only, less noisy
.\SharpHound.exe -c All --stealth              # Reduced LDAP queries

# Linux: BloodHound.py (Impacket-based)
bloodhound-python -u user -p pass -d domain.local -dc dc01.domain.local -c All
bloodhound-python -u user -p pass -d domain.local -c DCOnly,Group,Trusts

# With hash
bloodhound-python -u user --hashes :NTLMhash -d domain.local -c All
```

### Import & Setup
```bash
# Start BloodHound CE (Docker)
docker run -p 7474:7474 -p 7687:7687 specterops/bloodhound:latest

# Import zip from SharpHound
# Drag-and-drop zip into BloodHound UI, or use Upload Data button
```

### Key Pre-Built Queries
- "Find all Domain Admins"
- "Shortest Paths to Domain Admins"
- "Find Principals with DCSync Rights"
- "Shortest Path from Owned Principals to Domain Admin"
- "Find Computers where Domain Users are Local Admin"
- "Find AS-REP Roastable Users"
- "Find Kerberoastable Users with Most Privileges"
- "Find Dangerous Rights for Domain Users"

### Mark Nodes as Owned
Right-click compromised user/computer → "Mark as Owned" → re-run attack path queries from owned nodes.

### Key Edge Types (Attack Paths)

| Edge | Meaning |
|------|---------|
| `MemberOf` | Group membership |
| `AdminTo` | Local admin on target |
| `HasSession` | User has active session on computer |
| `CanRDP` | Can RDP to target |
| `GenericAll` | Full control over object |
| `GenericWrite` | Can write to object attributes |
| `WriteDACL` | Can modify permissions |
| `Owns` | Object owner |
| `ForceChangePassword` | Can reset password |
| `AllExtendedRights` | Includes DS-Replication rights (DCSync) |
| `AddMember` | Can add members to group |
| `AllowedToDelegate` | Delegation trust |
| `AllowedToAct` | RBCD trust |

### Custom Cypher Queries
BloodHound uses Neo4j's Cypher query language for custom analysis:
```cypher
// Find all users with paths to DA under 5 hops
MATCH p=shortestPath((u:User)-[*1..5]->(g:Group {name:"DOMAIN ADMINS@DOMAIN.LOCAL"}))
RETURN p

// Find computers with unconstrained delegation (not DCs)
MATCH (c:Computer {unconstraineddelegation:true}) WHERE NOT c.name CONTAINS "DC" RETURN c

// Find users with AdminTo on servers
MATCH (u:User)-[:AdminTo]->(c:Computer) RETURN u.name, c.name
```

## Notable Features (BloodHound CE vs Enterprise)
- **CE (open-source):** Full graph analysis, custom queries, free.
- **Enterprise:** Attack path management, continuous collection, tiering/exposure metrics, remediation tracking.

## References
- BloodHound documentation — support.bloodhoundenterprise.io
- "Six Degrees of Domain Admin" — SpecterOps blog (original BloodHound paper)
- BloodHound.py — github.com/fox-it/BloodHound.py
