---
title: Cloud Penetration Testing
permalink: /wiki/offsec-notes/concepts/cloud-penetration-testing/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Cloud (AWS / Azure / GCP)
**MITRE ATT&CK:** Multiple — Initial Access, Privilege Escalation, Lateral Movement in cloud context
**Related:** [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/), [Privilege Escalation Linux](/wiki/offsec-notes/concepts/privilege-escalation-linux/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/)

## Overview
Cloud penetration testing targets misconfigurations, identity and access management (IAM) weaknesses, exposed storage, and cloud-native service vulnerabilities in AWS, Azure, and GCP environments. Cloud attacks differ from traditional network attacks — the attack surface is API-driven and identity is the new perimeter.

## How It Works

### Common Entry Points
- Exposed AWS Access Keys / Azure Service Principals / GCP Service Account keys in code repos, environment variables, instance metadata
- SSRF to cloud metadata endpoints → credential theft
- Publicly exposed storage (S3 buckets, Azure Blobs, GCS buckets)
- Overly permissive IAM roles / policies
- Misconfigured cloud services (Lambda, API Gateway, ECS, AKS)
- Unauthenticated dashboards (Kubernetes, Consul, Elasticsearch)

### AWS-Specific Attacks

#### Metadata Service (IMDS)
- IMDSv1 (no auth): `curl http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>`
- IMDSv2 (token required): two-step request; SSRF must support redirects.
- Retrieve temporary credentials → use with AWS CLI / Pacu.

#### S3 Bucket Attacks
```bash
aws s3 ls s3://bucket-name --no-sign-request     # Unauthenticated list
aws s3 cp s3://bucket-name/sensitive.txt .        # Download
# Find buckets: DNS brute-force, Google dork: site:s3.amazonaws.com
```

#### IAM Privilege Escalation (AWS)
- `iam:CreatePolicyVersion` → create new policy version with AdministratorAccess
- `iam:AttachUserPolicy` → attach AdministratorAccess to self
- `iam:PassRole` + `ec2:RunInstances` → launch EC2 with privileged role
- Lambda / CloudFormation / CodeBuild privilege escalation chains
- Use Pacu's `iam__privesc_scan` module

#### Azure-Specific
- Azure AD (Entra ID): Service Principal abuse, Managed Identity, token theft
- Resource misconfiguration: public VMs, unprotected storage accounts
- Key Vault access policies: `Get` on secrets without proper restrictions
- `az cli` token theft from `~/.azure/`
- Roadtools / Stormspotter for Azure AD enumeration

#### GCP-Specific
- Metadata: `http://metadata.google.internal/computeMetadata/v1/` with `Metadata-Flavor: Google` header
- Service account key leakage
- GCS bucket permissions: `allUsers` IAM binding
- Workload Identity Federation misconfigurations

## Attack Methodology
1. Gather public intelligence: GitHub secrets, S3 buckets, public cloud resources.
2. If credentials found: enumerate permissions (`aws iam get-user`, `aws sts get-caller-identity`).
3. Check for privilege escalation paths (Pacu / Cloudsplaining / Prowler).
4. Escalate to admin; access sensitive resources.
5. Look for cross-account trust abuse.
6. Identify data exfiltration targets (S3, RDS snapshots, Secrets Manager).

```bash
# Enumerate AWS permissions
python3 enumerate-iam.py --access-key KEY --secret-key SECRET
aws iam list-attached-user-policies --user-name <name>
aws iam simulate-principal-policy ...

# Pacu (AWS exploitation framework)
import_keys <profile>
run iam__enum_permissions
run iam__privesc_scan
```

## Detection & Evasion Notes
- CloudTrail logs all API calls; GuardDuty alerts on anomalous behavior.
- Avoid high-volume API calls (throttling + alerts).
- Use legitimate-looking access patterns; avoid `DescribeInstances` on all regions at once.
- Some actions don't log to CloudTrail (e.g., S3 data plane events unless enabled).
- Exfil via snapshot sharing (RDS, EBS) — can be done quietly.

## Tools
- `Pacu` — AWS exploitation framework
- `ScoutSuite` — multi-cloud security auditing
- `Prowler` — AWS/Azure/GCP security best practices scanner
- `CloudSploit` — cloud misconfiguration scanner
- `Enumerate-IAM` — bruteforce IAM permissions
- `Roadtools` / `Stormspotter` — Azure AD
- `GCPBucketBrute` — GCS bucket enumeration
- `truffleHog` / `gitleaks` — secret scanning in repos
- `aws_consoler` — convert IAM credentials to console URL

## References
- Rhino Security Labs AWS Privilege Escalation Paths
- HackTricks Cloud (cloud.hacktricks.xyz)
- flaws.cloud / flaws2.cloud — AWS misconfig learning labs
- CloudGoat — vulnerable-by-design AWS environment
