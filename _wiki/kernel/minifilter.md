---
title: Windows Minifilter Drivers
permalink: /wiki/kernel/minifilter/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- kernel
redirect_from:
- /wiki/windows-exploit-research/kernel/minifilter/
---

> **Last updated:** 2026-04-12  
> **Related:** [Architecture](/wiki/kernel/architecture/), [Cldflt](/wiki/kernel/cldflt/), [Cve 2024 30085](/wiki/cves/CVE-2024-30085/), [Cve 2021 31969](/wiki/cves/CVE-2021-31969/)  
> **Tags:** `kernel-mode`, `driver`, `filter-manager`, `filesystem`

## Summary

Windows minifilter drivers are a kernel-mode driver model built on top of the I/O Manager's filter layer (FLTMGR.SYS — the **Filter Manager**). Rather than writing a full legacy filter driver and chaining IRPs manually, minifilters register with the Filter Manager at a specific **altitude** and receive pre/post-operation callbacks for selected I/O operations. This model powers security products (AV real-time scanning, EDR telemetry), filesystem virtualization (CloudFiles/cldflt.sys, CimFS), file encryption, and backup solutions. Understanding minifilter internals is essential both for reverse engineering EDR logic and for exploiting driver-level bugs in production components like `cldflt.sys`.

---

## Architecture Overview

```
User-Mode Application
        │
        │  CreateFile / ReadFile / WriteFile / IOCTL
        ▼
   I/O Manager (ntoskrnl.exe)
        │  IRP creation
        ▼
   Filter Manager (FLTMGR.SYS)          ← FltMgr sits above the filesystem stack
        │  dispatches to registered minifilters in altitude order
        ├─► Minifilter A (alt=385000)  ← Pre/Post callback
        ├─► Minifilter B (alt=150000)  ← Pre/Post callback
        └─► Minifilter C (alt=100000)  ← Pre/Post callback
                │
                ▼
   Legacy filesystem driver (e.g., ntfs.sys, fastfat.sys)
        │
        ▼
   Volume / Disk driver
```

**Key design point:** The Filter Manager eliminates the need for minifilters to manage IRP completion. Minifilters interact only with FLT_CALLBACK_DATA structures via simple return values.

---

## Filter Manager (FLTMGR.SYS) Internals

- Ships with Windows Vista+ as a built-in system component
- Exposes the `FltMgr` kernel API (all exported `Flt*` functions)
- Maintains an **altitude-ordered linked list** of registered minifilters per volume
- Provides COM port–like **communication ports** for user↔kernel messaging
- Manages per-minifilter instance contexts and per-volume attachment

### Key Filter Manager Kernel APIs

| Function | Purpose |
|----------|---------|
| `FltRegisterFilter` | Register a minifilter driver; provide FLT_REGISTRATION |
| `FltStartFiltering` | Begin filtering I/O (called after register) |
| `FltUnregisterFilter` | Unregister at driver unload |
| `FltAttachVolume` | Attach a minifilter instance to a volume |
| `FltDetachVolume` | Detach from a volume |
| `FltBuildDefaultSecurityDescriptor` | Create default DACL for communication port |
| `FltCreateCommunicationPort` | Create kernel-side communication port |
| `FltCloseCommunicationPort` | Close the port |
| `FltSendMessage` | Kernel→user message (async, queued) |
| `FltGetRequestorProcess` | Get the EPROCESS of the I/O requestor |
| `FltGetStreamHandleContext` | Retrieve per-file-handle context |
| `FltSetStreamHandleContext` | Set per-file-handle context |
| `FltAllocatePoolAlignedWithTag` | Pool allocation that respects DMA alignment |
| `FltDoCompletionProcessingWhenSafe` | Defer completion to passive IRQL |

---

## Altitude System

Every minifilter has an **altitude number** — a decimal string assigned by Microsoft. Altitude determines the order in which filters process I/O:

- **Higher altitude** = processed first on the way DOWN (pre-operation) and last on the way UP (post-operation)
- **Lower altitude** = processed last on way down, first on way up

### Altitude Ranges (Windows standard allocation)

| Range | Category |
|-------|----------|
| 420000–429999 | Anti-malware (pre-scan) |
| 385000–389999 | Activity Monitor |
| 340000–349999 | Undelete |
| 320000–329999 | Anti-Virus (scan) |
| 270000–279999 | Encryption (above paging) |
| 250000–259999 | Compression |
| 240000–249999 | HSM (Hierarchical Storage Management) |
| 180000–189999 | Cluster File System |
| 170000–179999 | Content Screening / Filtering |
| 165000–169999 | Quota |
| 160000–169999 | System Recovery |
| 140000–149999 | Encryption (below paging) |
| 130000–139999 | Imaging |
| 120000–129999 | Archival |

**`cldflt.sys` altitude:** ~180000 (Cloud Files HSM range — hierarchical storage management)

Altitude determines registration order in Filter Manager's minifilter list. Two minifilters at the same altitude on the same volume = undefined behavior; Microsoft allocates altitudes uniquely.

---

## Registration Structure

```c
// FLT_REGISTRATION — passed to FltRegisterFilter
const FLT_REGISTRATION FilterRegistration = {
    sizeof(FLT_REGISTRATION),       //  Size
    FLT_REGISTRATION_VERSION,       //  Version
    0,                              //  Flags
    ContextRegistration,            //  ContextRegistration
    Callbacks,                      //  OperationRegistration
    FilterUnloadCallback,           //  FilterUnloadCallback
    InstanceSetupCallback,          //  InstanceSetupCallback
    InstanceQueryTeardownCallback,  //  InstanceQueryTeardownCallback
    InstanceTeardownStartCallback,  //  InstanceTeardownStartCallback
    InstanceTeardownCompleteCallback, // ...
    NULL, NULL, NULL                // GenerateFileName, GenerateDestinationFileName, NormalizeNameComponent
};

// FLT_OPERATION_REGISTRATION — per-operation callback table
const FLT_OPERATION_REGISTRATION Callbacks[] = {
    { IRP_MJ_CREATE,          0, PreCreateCallback, PostCreateCallback },
    { IRP_MJ_READ,            0, PreReadCallback,   NULL               },
    { IRP_MJ_WRITE,           0, NULL,              PostWriteCallback  },
    { IRP_MJ_FILE_SYSTEM_CONTROL, 0, PreFSCtlCallback, NULL            },
    { IRP_MJ_OPERATION_END }   // sentinel
};
```

### Callback Return Values (Pre-operation)

| Return Value | Meaning |
|-------------|---------|
| `FLT_PREOP_SUCCESS_WITH_CALLBACK` | Continue, call post-op callback on completion |
| `FLT_PREOP_SUCCESS_NO_CALLBACK` | Continue, skip post-op for this minifilter |
| `FLT_PREOP_COMPLETE` | Complete the IRP now; do not pass down the stack |
| `FLT_PREOP_PENDING` | Pend the operation; resume via `FltCompletePendedPreOperation` |
| `FLT_PREOP_SYNCHRONIZE` | Synchronize with post-op at PASSIVE_LEVEL |

---

## User ↔ Kernel Communication

Minifilters expose a **communication port** as their IPC channel. The kernel side creates the port with `FltCreateCommunicationPort`; user-mode connects with `FilterConnectCommunicationPort` (from fltlib.dll/fltUser.lib).

### Kernel Side

```c
// Create communication port
PSECURITY_DESCRIPTOR sd;
FltBuildDefaultSecurityDescriptor(&sd, FLT_PORT_ALL_ACCESS);

UNICODE_STRING portName = RTL_CONSTANT_STRING(L"\\MyFilterPort");
OBJECT_ATTRIBUTES oa;
InitializeObjectAttributes(&oa, &portName, OBJ_KERNEL_HANDLE | OBJ_CASE_INSENSITIVE,
                            NULL, sd);

FltCreateCommunicationPort(
    gFilterHandle,       // filter handle from FltRegisterFilter
    &gServerPort,        // output port object
    &oa,                 // port name
    NULL,                // context
    ConnectNotifyCallback,     // called when user connects
    DisconnectNotifyCallback,  // called when user disconnects
    MessageNotifyCallback,     // called for user→kernel messages
    1                    // max connections
);
FltFreeSecurityDescriptor(sd);
```

### User Mode Side

```c
// Connect to filter port
HANDLE hPort;
FilterConnectCommunicationPort(
    L"\\MyFilterPort",  // port name (LPCWSTR)
    0,                  // options
    NULL,               // context
    0,                  // context size
    NULL,               // security attributes
    &hPort              // output handle
);

// Send message to kernel
BYTE requestBuf[sizeof(FILTER_MESSAGE_HEADER) + sizeof(MyRequest)];
BYTE replyBuf[sizeof(FILTER_REPLY_HEADER) + sizeof(MyReply)];
FilterSendMessage(hPort, &requestBuf, sizeof(requestBuf),
                  &replyBuf, sizeof(replyBuf), &bytesReturned);

// Receive notification from kernel (kernel called FltSendMessage)
FilterGetMessage(hPort, (PFILTER_MESSAGE_HEADER)replyBuf, sizeof(replyBuf), NULL);
```

---

## FLT_CALLBACK_DATA Structure

The core structure passed to every pre/post callback:

```c
typedef struct _FLT_CALLBACK_DATA {
    FLT_CALLBACK_DATA_FLAGS     Flags;           //0x00 FLTFL_CALLBACK_DATA_*
    PETHREAD                    Thread;           //0x08 requestor thread
    PFLT_IO_PARAMETER_BLOCK     Iopb;            //0x10 I/O parameters
    IO_STATUS_BLOCK             IoStatus;        //0x18 final status
    struct _FLT_TAG_DATA_BUFFER *TagData;        //0x28 reparse tag data
    union {
        struct {
            LIST_ENTRY          QueueLinks;      //0x30 work item queue
            PVOID               QueueContext[2]; //0x40
        };
        PVOID                   FilterContext[4];//0x30 minifilter context
    };
    KPROCESSOR_MODE             RequestorMode;   //0x50
} FLT_CALLBACK_DATA;
```

`Iopb->MajorFunction` = `IRP_MJ_*` opcode; `Iopb->Parameters` = union of per-operation parameters (same layout as `IO_STACK_LOCATION`).

---

## Attack Surface for Exploitation

### 1. IOCTL / Communication Port Message Parsing

Most minifilter bugs come from the message parsing logic in `MessageNotifyCallback` (kernel side) or from IOCTL handling inside the minifilter's `IRP_MJ_DEVICE_CONTROL` path. Typical patterns:

- **Insufficient length validation** on user-supplied buffer in `FilterSendMessage`
- **Type confusion** when parsing structured messages (fixed-size header + variable body)
- **Integer overflow** in size computations before allocation
- **TOCTOU** between validation and use of user-supplied data

### 2. Pre/Post Operation Callback Bugs

- **Memory corruption in reparse point parsing** — minifilters that process reparse buffers from filesystem layer (e.g., CloudFiles/cldflt.sys parsing HSM reparse tags)
- **Context lifetime bugs** — UAF when filter context freed before callback completes (race with volume detach)
- **Incomplete validation of nested buffer fields** — e.g., element arrays within a reparse buffer where only total size is checked, not per-element sizes

### 3. hasBuf=false Bypass (CVE-2024-30085 Pattern)

`cldflt.sys` contains `HsmpBitmapIsReparseBufferSupported()` — a validation gate:

```c
// Simplified cldflt.sys logic:
bool HsmpBitmapIsReparseBufferSupported(REPARSE_DATA_BUFFER *buf, bool hasBuf) {
    if (!hasBuf) return true;   // ← CRITICAL: skips all validation when hasBuf=false
    // ... element type/size validation follows ...
}
```

When `hasBuf=false` is passed (e.g., from `HsmIBitmapNORMALOpen` during open path), the function returns `true` immediately, bypassing bounds validation for bitmap element arrays. An attacker crafts a reparse buffer with element type `0x11` (BITMAP) and a `BitmapDataSize` > 0x1000, triggering unchecked `memcpy` of attacker-controlled size to a 0x1000-byte paged pool allocation.

**Root cause pattern**: Boolean flag passed down a call chain that disables validation for an entire class of inputs. Common in code with multiple call contexts (open vs. create vs. query), where the "fast path" skips safety checks.

See [Cve 2024 30085](/wiki/cves/CVE-2024-30085/) for the complete exploit chain.

### 4. Communication Port Access Control

`FltBuildDefaultSecurityDescriptor` with `FLT_PORT_ALL_ACCESS` grants access to all processes including low-integrity/AppContainer — unless the driver explicitly tightens the DACL. Many minifilters fail to restrict port access, making their parsing logic reachable from sandboxed processes.

---

## cldflt.sys (Cloud Files Mini Filter) — Key Details

- **Altitude:** ~180000 (HSM range)
- **Pool tag:** `HsRp` (reparse point allocs), `HsBm` (bitmap allocs), `HsRe`, `HsDa`
- **Reparse tag:** `IO_REPARSE_TAG_CLOUD` = `0x9000001A`; variants `IO_REPARSE_TAG_CLOUD_6` = `0x9000601a` 
- **Registration:** registered via `CfLoadFilter` → `FltRegisterFilter` → `FltStartFiltering`
- **IOCTL interface:** exposed via `\\Device\\CloudFilesControl`
- **Key callbacks:** `IRP_MJ_CREATE`, `IRP_MJ_FILE_SYSTEM_CONTROL`, `IRP_MJ_SET_INFORMATION`

See [Cldflt](/wiki/kernel/cldflt/) for full driver reference.

---

## Security Products Using Minifilters

| Product | Altitude | Notes |
|---------|----------|-------|
| Windows Defender (WdFilter.sys) | 328010 | Real-time AV pre-scan |
| Carbon Black (cbk.sys) | 322410 | EDR telemetry |
| CrowdStrike (csagent.sys) | 328010 | Highest altitude; single-point-of-failure for CrowdStrike BSOD (July 2024 content update) |
| CloudFiles (cldflt.sys) | ~180000 | HSM for OneDrive cloud-tier files |
| CimFS (cimfs.sys) | — | Composite Image FS; not a minifilter, uses FltMgr's volume management layer |

**Security research note:** Bugs in high-altitude AV/EDR minifilters are especially valuable — they're reachable from all processes, run at kernel mode with all privileges, and often have large attack surfaces from complex file parsing logic.

---

## Debugging Minifilters

```
// WinDbg commands for minifilter analysis:
!fltkd.filters          // list all registered minifilters
!fltkd.filter <addr>    // details for specific filter
!fltkd.instances        // list all filter instances
!fltkd.volumes          // volumes with attached filters
!fltkd.cbdq             // callback data queue
!fltkd.port <addr>      // communication port details

// Enumerate minifilters from kernel debugger:
dt fltmgr!_FLT_FILTER <addr>
dt fltmgr!_FLT_INSTANCE <addr>
dt fltmgr!_FLT_PORT_OBJECT <addr>
```

---

## Exploit Relevance

- Minifilters run at kernel mode, operate on every file I/O — bugs are high-impact (no privilege escalation needed for LPE; already running as kernel)
- **cldflt.sys** in particular has had 3+ exploited vulnerabilities (CVE-2021-31969, CVE-2024-30085) from parsing bugs in reparse point buffers — pattern will likely repeat
- Communication port parsing bugs (FilterSendMessage path) are reachable from AppContainer if DACL is loose — AppContainer-to-kernel path
- hasBuf=false pattern generalizes: any "validation bypass flag" in a code path that processes attacker-controlled structured data is a candidate for similar bugs

---

## Extended Bug Classes (James Forshaw / Project Zero)

The following bug classes are documented in depth by James Forshaw (Project Zero, January 2021) based on analysis of CVE-2020-17103, -17134, -17136, -17139 (Cloud Filter / WOF):

### 5. Incorrect RequestorMode Check (Missing SL_FORCE_ACCESS_CHECK)

A mini-filter may check `Data->RequestorMode` but fail to also check whether the `SL_FORCE_ACCESS_CHECK` flag is set in `Data->Iopb->OperationFlags`. This flag is set when the IO was initiated via `IoCreateFile` with `IO_FORCE_ACCESS_CHECK` (IFAC) — meaning access checking should be re-enabled even though `RequestorMode == KernelMode`.

```c
// VULNERABLE: checks RequestorMode but not SL_FORCE_ACCESS_CHECK
FLT_PREOP_CALLBACK_STATUS PreCreateOperation(
    PFLT_CALLBACK_DATA Data, ...) {
    if (!SeSinglePrivilegeCheck(SeExports->SeTcbPrivilege,
                                Data->RequestorMode)) {  // ← passes for KernelMode callers!
        Data->IoStatus.Status = STATUS_ACCESS_DENIED;
        return FLT_PREOP_COMPLETE;
    }
    // ... performs privileged action
}

// CORRECT: must also check SL_FORCE_ACCESS_CHECK flag
KPROCESSOR_MODE effectiveMode = Data->RequestorMode;
if (Data->Iopb->OperationFlags & SL_FORCE_ACCESS_CHECK) {
    effectiveMode = UserMode;  // force user-mode checking
}
if (!SeSinglePrivilegeCheck(SeExports->SeTcbPrivilege, effectiveMode)) { ... }
```

**Exploitability**: Requires an Initiator that calls `IoCreateFile`/`IoCreateFileEx` with `IO_NO_PARAMETER_CHECKING + IO_FORCE_ACCESS_CHECK` but **without** `OBJ_FORCE_ACCESS_CHECK`. The IO Manager then sets `RequestorMode = KernelMode` and `SL_FORCE_ACCESS_CHECK` — the mini-filter must check both. See [Architecture](/wiki/kernel/architecture/) §IO Manager Access Mode Mismatch for the full Initiator/Receiver model.

### 6. Driver and Kernel IO Operation Mismatch (New FSCTLs)

When Windows adds a new FSCTL or information class that overlaps with what a mini-filter is protecting, the filter may miss it. Example: **CVE-2020-17139 (WOF)**:
- WOF blocks `FSCTL_SET_REPARSE_POINT` with `IO_REPARSE_TAG_WOF`
- Windows added `FSCTL_SET_REPARSE_POINT_EX` — WOF didn't handle it
- Application could add/remove WOF IO tag → forge cached code signatures → bypass WDAC/AppLocker

**Pattern**: Any filter that enforces security on a specific FSCTL must explicitly handle all variants (including `_EX` forms, new information classes, etc.).

### 7. Altitude Sickness (Filter Ordering Bugs)

Filters at higher altitude process IO first on the way down, last on the way up. Security products at altitude ~385000 (WdFilter) miss file writes done through LUAFV at altitude ~135000 because LUAFV uses `FltCreateFileEx` (which only dispatches to filters **below** LUAFV):

```
NtWriteFile → [WdFilter 385000 sees it] → [LUAFV 135000 redirects via FltCreateFileEx]
                                           ← FltCreateFileEx skips WdFilter (above LUAFV)
```

**Implication**: EICAR written to a virtualized path bypasses WdFilter's real-time scan. (Low practical impact since the file is scanned on next use — but illustrates the general principle.)

**Debug tip**: Reattach Process Monitor filter at altitude 100 (`fltmc detach PROCMON24 C: && fltmc attach PROCMON24 C: -i "..." -a 100`) to see IO operations hidden by LUAFV.

### 8. Concurrency and Reentrancy

No explicit locking in the filter manager prevents multiple IO requests to the same file object simultaneously. Filters that maintain per-file state between pre/post callbacks are vulnerable to races.

**CVE-2019-0836 (LUAFV)**: Race between read and write IO requests on the same virtualized file. The wrong `SECTION_OBJECT_POINTERS` structure gets assigned to the virtual file → user bypasses access checks and maps a read-only file as writable.

**Detection**: Look for per-stream-context or per-file-context that's modified in pre/post callbacks without locking; look for calls to user-mode APIs (APCs, named pipes) mid-operation that create TOCTOU windows.

### 9. Incorrect Forwarding of IO Operations

When a mini-filter redirects IO (by changing `TargetFileObject`), access checks on the new target are NOT re-run:
- A handle opened read-only for file A can be redirected to write to file B
- The I/O Manager only checks the original handle's access rights
- LUAFV CVE-2019-0836 also exploits this: read-only handle → write dispatched via redirected file object

**Rule**: Mini-filters that redirect must themselves verify that the operation's requested access is compatible with the target file object's access mode.

---

## Reparse Point Attack Surface

### ECP (Extra Create Parameters) Filtering

Minifilters can use ECPs to mark their own create requests (preventing re-entry):
- Call `FltInsertExtraCreateParameter` with driver-specific GUID before `FltCreateFileEx`
- Check `FltFindExtraCreateParameter` in pre-create callback → if found, ignore (our own request)

**Security issue**: If filter checks for ECP too broadly (wrong GUID, weak matching), a user could craft a file open request that looks like it came from the filter itself.

### Arbitrary Reparse Point Tag Parsing

`FsRtlValidateReparsePointBuffer` only does basic length checks for non-symlink tags. A filter processing custom reparse buffers receives completely unvalidated `DataBuffer` contents from NTFS. Entire buffer is attacker-controlled (any user can set reparse points with non-reserved tags).

---

## WinDbg: Filter Communication Port Enumeration

```
// Enumerate FilterConnectionPort objects in OMNS root:
!object \

// Inspect a specific port's security descriptor:
!object \CLDMSGPORT
dt nt!_OBJECT_HEADER <addr-from-above>
// SD address from ObjectHeader.SecurityDescriptor & ~0x7
!sd <sd-addr> 1
```

---

## References

- James Forshaw (Project Zero), "Hunting for Bugs in Windows Mini-Filter Drivers", projectzero.google, 2021-01
- James Forshaw (Project Zero), "Windows Kernel Logic Bug Class: Access Mode Mismatch in IO Manager", projectzero.google, 2019-03
- Chen Le Qi, "Walking Through Windows Minifilter Drivers (EN)", 2024
- Microsoft Docs, "Filter Manager Concepts" — docs.microsoft.com/en-us/windows-hardware/drivers/ifs/filter-manager-concepts
- Cherie-Anne Lee (StarLabs), "All I Want for Christmas is a CVE-2024-30085 Exploit" — StarLabs blog, 2024
- Alex Birnberg (SSD Security Research), "Exploitation of a kernel pool overflow from a restrictive chunk size (CVE-2021-31969)" — ssd-disclosure.com
