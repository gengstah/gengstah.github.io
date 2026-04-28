---
title: Beacon Object Files (BOFs)
permalink: /wiki/offsec-notes/concepts/beacon-object-files/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Beacon Object Files (BOFs)

**Category:** Command and Control / Execution / Defense Evasion
**MITRE ATT&CK:** T1055 — Process Injection; T1620 — Reflective Code Loading
**Related:** [Command And Control](/wiki/offsec-notes/concepts/command-and-control/), [Cobalt Strike](/wiki/offsec-notes/entities/cobalt-strike/), [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/)

## Overview
Beacon Object Files (BOFs) are small COFF (Common Object File Format) objects executed in-process by a C2 agent (Cobalt Strike Beacon, Outflank C2, Core Impact). They run as shellcode within the agent's existing thread, avoiding process creation and DLL loading artifacts. The Beacon API provides safe wrappers for Windows API calls and output formatting.

## Architecture

BOFs are compiled COFF objects — not linked executables. The agent:
1. Receives the COFF blob over the C2 channel
2. Allocates memory and copies sections
3. Processes relocations
4. Calls the entry point (`go` or `sleep_mask`)

### Standard BOF vs. Async BOF

| Feature | Standard BOF | Async BOF |
|---------|-------------|-----------|
| Execution | Blocks beacon while running | Background thread |
| Duration | Short (seconds) | Long-running (minutes/hours) |
| Communication | Synchronous | Event-driven wakeup |
| Sleepmask safe | Yes (when sleeping) | Yes (runs during sleep) |
| API | BeaconPrintf, BeaconOutput | + BeaconWakeup, BeaconGetStopJobEvent |

## Async BOF Design (Outflank, 2025)

The Outflank C2 async BOF extension enables event-driven, long-running background tasks that wake the beacon to report results without polling.

### Core Async APIs
```c
// Wake beacon and send output
BeaconWakeup(output_buffer, output_size);

// Get event handle — signaled when operator sends stop command
HANDLE stop_event = BeaconGetStopJobEvent();

// Typical async loop pattern
while (WaitForSingleObject(stop_event, 0) != WAIT_OBJECT_0) {
    // Monitor for condition...
    
    if (condition_met) {
        BeaconWakeup(data, data_size);
    }
    Sleep(poll_interval);
}
```

### Async BOF Categories

**1. Event Monitoring**
- Admin login monitoring: watch for privileged logon events via WMI or event log subscription
- Process start monitoring: alert when target process (AV scanner, backup agent) starts
- Cookie dump triggers: wait for browser process to open, then dump cookies

**2. Long-Running Tasks**
- Keyloggers that accumulate input and batch-send results
- Credential harvesting that waits for user activity
- File system watchers

**3. OPSEC Risk Management**
- Queue tasks to run during beacon's sleep cycle (reduces CPU/memory spikes during active callback)
- Sleepmask-safe — async BOF thread can run while the beacon's main thread is sleeping and encrypted

### Server-Side Scripting Integration
```python
# Python (Havoc/Outflank C2) — auto-process async BOF results
async def on_bof_output(beacon_id, data):
    if "admin_logged_in" in data:
        # Automatically trigger next stage
        await run_bof(beacon_id, "dump_lsass.o", args)
```

```cna
# Cobalt Strike Aggressor Script
on beacon_output {
    if ($3 matches "*admin_login*") {
        btask($1, "Triggering credential dump");
        binline_execute($1, script_resource("dump.o"), ...);
    }
}
```

## BOF Linting (boflint)

**Tool:** boflint.py (post-compilation COFF analyzer)

Catches common BOF development errors before deployment:

| Check | What It Catches |
|-------|----------------|
| Relocation types | Unsupported relocations that will crash the agent |
| Entry point | Missing `go` or `sleep_mask` export |
| Unresolved imports | `printf` instead of `BeaconPrintf`; CRT functions that aren't available |
| Stack variable size | Large locals that may overflow BOF stack |
| Exception handling | SEH/C++ exceptions that don't work in BOF context |

```bash
# Run linter after compilation
python boflint.py mybof.o

# Integrate with build system (Makefile)
post-build: boflint.py $(TARGET).o
```

### Supported C2 Frameworks
- Cobalt Strike
- Outflank C2
- Core Impact

### BOF-VS Integration
Visual Studio template (BOF-VS) integrates boflint as a post-build step, showing errors in the IDE.

## Writing a BOF

### Minimal Structure
```c
#include "beacon.h"

// Entry point — always named 'go'
void go(char *args, int len) {
    datap parser;
    BeaconDataParse(&parser, args, len);
    
    char *target = BeaconDataExtract(&parser, NULL);
    
    // Use BEACON_API macros for Windows API calls
    WINBASEAPI HANDLE WINAPI KERNEL32$OpenProcess(DWORD, BOOL, DWORD);
    
    HANDLE h = KERNEL32$OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pid);
    if (h) {
        BeaconPrintf(CALLBACK_OUTPUT, "Got handle: %p\n", h);
        KERNEL32$CloseHandle(h);
    }
}
```

### Key Constraints
- No CRT (no `printf`, `malloc`, `strlen` unless using BeaconCompat)
- No C++ exceptions
- No global/static constructors in standard BOFs
- Stack allocations should be minimal — BOFs share the agent's thread stack

## OPSEC Notes
- BOFs execute in-process — no new process = no process creation event
- Memory allocated for BOF code may show as unbacked RWX sections (flagged by some EDRs)
- Async BOFs run in a new thread — thread creation from beacon process is an IOC
- Use sleepmask-compatible implementations to hide BOF memory during sleep

## References
- Outflank — "Async BOFs: Taking the Lead" (2025-07-16)
- Outflank — "BOF Linting with boflint" (2025-06-30)
- Cobalt Strike BOF documentation
- TrustedSec CS-Situational-Awareness-BOF — github.com/trustedsec/CS-Situational-Awareness-BOF
