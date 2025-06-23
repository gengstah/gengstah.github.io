---
permalink: /osee/
title: "Offensive Security Exploitation Expert (OSEE)"
author_profile: true
---

{% include toc %}

# My Notes


# Syllabus

1.	Introduction
2.	Microsoft Edge Type Confusion
    1.	Exploitation Introduction
        1.	64bit Architecture
        2.	Vulnerability Classes
        3.	Basic Security Mitigations
    2.	Edge Internals
        1.	JavaScript Engine
        2.	Chakra Internals
        3.	JIT and Type Confusion
    3.	Type Confusion Case Study
        1.	Triggering the Vulnerability
        2.	Root Cause Analysis
    4.	Exploiting Type Confusion
        1.	Controlling the auxSlots Pointer
        2.	Abuse AuxSlots Pointer
        3.	Create Read and Write Primitive
    5.	Going for RIP
        1.	Vanilla Attack
        2.	CFG Internals
    6.	CFG Bypass
        1.	Return Address Overwrite
        2.	Intel CET
        3.	Out of Context Calls
    7.	Data Only Attack
        1.	Parallel DLL Loading
        2.	Injecting Fake Work
        3.	Faking the Work
        4.	Hot Patching DLLs
    8.	Arbitrary Code Guard (ACG)
        1.	ACG Theory
        2.	ACG Bypasses
    9.	Advanced Out of Context Calls
        1.	Faking it to Make it
        2.	Fixing the Crash
    10. Remote Procedure Calls
        1.	RPC Theory
        2.	Is That My Structure
        3.	Analyzing the Buffers
        4.	Calling an API
        5.	Return of Mitigations
    11. Perfecting Out of Context Calls
        1.	Come Back to JavaScript
        2.	Return Value Alignment
        3.	Call Me Again
    12. Combining the Work
        1.	NOP'ing CFG
        2.	Call Arbitrary API
    13. Browser Sandbox
        1.	Sandbox Theory Introduction
        2.	Sandbox Escape Theory
        3.	The Glue That Binds
    14. Sandbox Escape Practice
        1.	Insecure Access
        2.	The Problem of Languages
    15. The Great Escape
        1.	Activation Factory
        2.	GetTemplateContent
        3.	What Is As?
        4.	Loading the XML
        5.	Allowing Scripts
        6.	Pop That Notepad
        7.	Getting a Shell
    16. Upping The Game: Making the Exploit Version Independent
        1.	Locating the Base
        2.	Locating Internal Functions and Imports
        3.	Locating Exported Functions
    17. Wrapping Up
3.	Kernel Exploitation and Payloads
    1.	The Windows Kernel
        1.	Privilege Levels
        2.	Interrupt Request Level (IRL)
        3.	Windows Kernel Driver Signing
    2.	Kernel Mode Debugging on Windows
        1.	Remote Kernel Debugging Over TCP/IP
    3.	Communicating with the Kernel
        1.	Native System Calls
        2.	Device Drivers
    4.	Kernel Vulnerability Classes
    5.	Kernel Mode Payloads
        1.	Token Stealing
        2.	ALC Editing
        3.	Kernel Mode Rootkits
    6.	Vulnerability Overview and Exploitation
        1.	Triggering the Vulnerability
        2.	Redirecting Execution to Usermode
    7.	ROP Based Attack
        1.	Stack Pivoting
        2.	Kernel Read/Write Primitive
        3.	Restoring the IO Ring Object
    8.	Elevate Privileges
        1.	Data Only Attack
    9.	Developing a Rootkit
        1.	Bypassing DSE
        2.	Elevating Permissions
        3.	Evading Detection
    10.	Version Independence
        1.	Dynamic Gadget Location
    11.	Extra Mile Exercise
    12.	Wrapping Up
4.	Untrusted Pointer Dereference
    1.	Vulnerability Overview and Exploit Types
        1.	Identifying the Vulnerability through Patch Diffing
    2.	Introduction to Memory Paging and Structures
        1.	Memory Descriptor Lists (MDLs)
        2.	The PML Self Reference Entry
        3.	PML Self Reference Entry Randomization
    3.	Virtualization Based Security
        1.	Hyper-V: The Windows Hypervisor
        2.	Windows Hypervisor Debugging
    4.	Interacting With the Device Driver
    5.	Extra Mile Exercise
    6.	Reaching the Vulnerable Code Block
    7.	Joy: From Happiness to Insight
        1.	A Wild Blue Screen Appears
        2.	Contentment: Unveiling Inner Peace
        3.	Uncertainty: Navigating the Unknown
        4.	Doubt: Understanding Self-Doubt
        5.	Fear: Facing Our Deepest Anxieties
        6.	Despair: The Path to Hope
    8.	Mapping Physical Memory to User Mode
    9.	Exploiting the Vulnerability
    10.	Wrapping Up
5.	Unsanitized Usermode Callback
    1.	Windows Desktop Applications
        1.	Windows Kernel Pool Memory
        2.	Creating Windows Desktop Applications
        3.	Reversing the TagWND Object
        4.	Kernel Usermode Callbacks
        5.	Leaking pWND User Mode Objects
    2.	Triggering the Vulnerability
        1.	Spraying the Desktop Heap
        2.	Hooking the Callback
        3.	Arbitrary WndExtra Overwrite
    3.	TagWND Write Primitive
        1.	Overwrite pWND[0].cbWndExtra
        2.	Overwrite pWND[0].WndExtra
    4.	TagWND Leak and Read Primitive
        1.	Changing pWND[0].dwStyle
        2.	Setting The TagWND[0].spmenu
        3.	Creating a fake TagWND[0].spmenu
        4.	GetMenuBarInfo Read Primitive
    5.	Privilege Escalation
        1.	Low integrity
        2.	Data Only Attack
        3.	Restoring The Execution Flow
    6.	Executing Code in Kernel Mode
        1.	Leaking Nt and Wink Base
        2.	NOPing kCFG
        3.	Hijacking a Kernel Mode Routine
        4.	Wrapping Up



# Exam Guide
- 71 hours and 45 minutes
- 24 hours report
- 2 assignments - 1 user-mode and 1 kernel-mode exploit

## Report
```
Table of Contents

1.0 Offensive-Security OSEE Exam Documentation	        3
2.0 192.168.XX.11 (25 Points or 50 Points)	        4
    2.1 Proof.txt	                                4
    2.2 Initial Exploitation	                        4
    2.3 Read and Write Primitive	                4
    2.4 Code Execution	                                4
    2.5 Sandbox Escape	                                4
    2.6 Proof of Concept	                        4
    2.7 Screenshots	                                5
3.0 192.168.XX.63 (25 or 50 Points)	                6
    3.1 Proof.txt	                                6
    3.2 Race Condition	                                6
    3.3 Kernel Memory Leak	                        6
    3.4 Read and Write Primitive	                6
    3.5 Privilege Escalation	                        6
    3.6 PoC Code	                                6
    3.7 Screenshots	                                6
```

## Reference
- https://help.offsec.com/hc/en-us/articles/360046458732-EXP-401-Advanced-Windows-Exploitation-OSEE-Exam-Guide