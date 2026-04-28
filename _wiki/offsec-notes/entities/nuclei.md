---
title: Nuclei
permalink: /wiki/offsec-notes/entities/nuclei/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool
**Also known as:** ProjectDiscovery Nuclei
**Related:** [Vulnerability Assessment](/wiki/offsec-notes/concepts/vulnerability-assessment/), [Web Application Testing](/wiki/offsec-notes/concepts/web-application-testing/), [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/)

## Description
Nuclei is a fast, template-based vulnerability scanner developed by ProjectDiscovery. Templates are community-contributed YAML files that define how to detect specific vulnerabilities, misconfigurations, and exposures. It is superior to traditional scanners for specific known-vulnerability checks and is widely used in both offensive and defensive contexts.

## Usage / Details

### Installation
```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
# Or
apt install nuclei       # Kali
nuclei -update-templates # Always update before scanning
```

### Basic Usage
```bash
# Scan a single target
nuclei -u https://target.com

# Scan with specific tags
nuclei -u https://target.com -tags cve,rce,sqli

# Scan multiple targets
nuclei -l targets.txt -o results.txt

# Only critical and high severity
nuclei -u https://target.com -severity critical,high

# Use specific template(s)
nuclei -u https://target.com -t cves/2021/CVE-2021-44228.yaml

# Scan a network range
nuclei -l hosts.txt -tags network,exposure

# Rate limiting (be polite)
nuclei -u https://target.com -rate-limit 10 -bulk-size 5
```

### Template Categories

| Category | Content |
|----------|---------|
| `cves/` | CVE-specific checks |
| `exposures/` | Sensitive file/info exposure |
| `misconfigurations/` | Misconfigured services |
| `takeovers/` | Subdomain takeover checks |
| `technologies/` | Tech fingerprinting |
| `network/` | Network service checks |
| `vulnerabilities/` | Generic vuln checks |
| `fuzzing/` | Input fuzzing templates |
| `default-logins/` | Default credential checks |

### Writing Custom Templates
```yaml
id: custom-check-example

info:
  name: Custom Exposed Admin Panel
  author: attacker
  severity: high
  tags: exposure,admin

requests:
  - method: GET
    path:
      - "{{BaseURL}}/admin"
      - "{{BaseURL}}/administrator"
    matchers-condition: and
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "Admin Panel"
          - "Dashboard"
        condition: or
```

### Useful Flags
```bash
-silent          # Only print findings
-nc              # No color
-json            # JSON output (for piping to jq)
-interactsh-url  # Custom interactsh server for OOB
-proxy           # Route through proxy (Burp)
-resume          # Resume interrupted scan
-stats           # Show live stats
-headless        # Browser-based templates (JS-rendered pages)
```

### Integration with ProjectDiscovery Workflow
```bash
# Full recon → scan pipeline
subfinder -d target.com | httpx | nuclei -tags cve,exposure
```

## References
- Nuclei documentation — docs.projectdiscovery.io/tools/nuclei
- Template community — github.com/projectdiscovery/nuclei-templates
