---
permalink: /osee/
title: "Offensive Security Exploitation Expert (OSEE)"
author_profile: true
---

{% include toc %}

# My Notes


# Syllabus

- 1	Introduction
- 2	Microsoft Edge Type Confusion
    - 2.1	Exploitation Introduction
        - 2.1.1	64bit Architecture
        - 2.1.2	Vulnerability Classes
        - 2.1.3	Basic Security Mitigations
    - 2.2	Edge Internals
        - 2.2.1	JavaScript Engine
        - 2.2.2	Chakra Internals
        - 2.2.3	JIT and Type Confusion
    - 2.3	Type Confusion Case Study
        - 2.3.1	Triggering the Vulnerability
        - 2.3.2	Root Cause Analysis
    - 2.4	Exploiting Type Confusion
        - 2.4.1	Controlling the auxSlots Pointer
        - 2.4.2	Abuse AuxSlots Pointer
        - 2.4.3	Create Read and Write Primitive
    - 2.5	Going for RIP
        - 2.5.1	Vanilla Attack
        - 2.5.2	CFG Internals
    - 2.6	CFG Bypass
        - 2.6.1	Return Address Overwrite
        - 2.6.2	Intel CET
        - 2.6.3	Out of Context Calls
    - 2.7	Data Only Attack
        - 2.7.1	Parallel DLL Loading
        - 2.7.2	Injecting Fake Work
        - 2.7.3	Faking the Work
        - 2.7.4	Hot Patching DLLs
    - 2.8	Arbitrary Code Guard (ACG)
        - 2.8.1	ACG Theory
        - 2.8.2	ACG Bypasses
    - 2.9	Advanced Out of Context Calls
        - 2.9.1	Faking it to Make it
        - 2.9.2	Fixing the Crash
    - 2.10 Remote Procedure Calls
        - 2.10.1	RPC Theory
        - 2.10.2	Is That My Structure
        - 2.10.3	Analyzing the Buffers
        - 2.10.4	Calling an API
        - 2.10.5	Return of Mitigations
    - 2.11 Perfecting Out of Context Calls
        - 2.11.1	Come Back to JavaScript
        - 2.11.2	Return Value Alignment
        - 2.11.3	Call Me Again
    - 2.12 Combining the Work
        - 2.12.1	NOP'ing CFG
        - 2.12.2	Call Arbitrary API
    - 2.13 Browser Sandbox
        - 2.13.1	Sandbox Theory Introduction
        - 2.13.2	Sandbox Escape Theory
        - 2.13.3	The Glue That Binds
    - 2.14 Sandbox Escape Practice
        - 2.14.1	Insecure Access
        - 2.14.2	The Problem of Languages
    - 2.15 The Great Escape
        - 2.15.1	Activation Factory
        - 2.15.2	GetTemplateContent
        - 2.15.3	What Is As?
        - 2.15.4	Loading the XML
        - 2.15.5	Allowing Scripts
        - 2.15.6	Pop That Notepad
        - 2.15.7	Getting a Shell
    - 2.16 Upping The Game: Making the Exploit Version Independent
        - 2.16.1	Locating the Base
        - 2.16.2	Locating Internal Functions and Imports
        - 2.16.3	Locating Exported Functions
    - 2.17 Wrapping Up
- 3	Kernel Exploitation and Payloads
    - 3.1	The Windows Kernel
        - 3.1.1	Privilege Levels
        - 3.1.2	Interrupt Request Level (IRL)
        - 3.1.3	Windows Kernel Driver Signing
    - 3.2	Kernel Mode Debugging on Windows
        - 3.2.1	Remote Kernel Debugging Over TCP/IP
    - 3.3	Communicating with the Kernel
        - 3.3.1	Native System Calls
        - 3.3.2	Device Drivers
    - 3.4	Kernel Vulnerability Classes
    - 3.5	Kernel Mode Payloads
        - 3.5.1	Token Stealing
        - 3.5.2	ALC Editing
        - 3.5.3	Kernel Mode Rootkits
    - 3.6	Vulnerability Overview and Exploitation
        - 3.6.1	Triggering the Vulnerability
        - 3.6.2	Redirecting Execution to Usermode
    - 3.7	ROP Based Attack
        - 3.7.1	Stack Pivoting
        - 3.7.2	Kernel Read/Write Primitive
        - 3.7.3	Restoring the IO Ring Object
    - 3.8	Elevate Privileges
        - 3.8.1	Data Only Attack
    - 3.9	Developing a Rootkit
        - 3.9.1	Bypassing DSE
        - 3.9.2	Elevating Permissions
        - 3.9.3	Evading Detection
    - 3.10	Version Independence
        - 3.10.1	Dynamic Gadget Location
    - 3.11	Extra Mile Exercise
    - 3.12	Wrapping Up
- 4	Untrusted Pointer Dereference
    - 4.1	Vulnerability Overview and Exploit Types
        - 4.1.1	Identifying the Vulnerability through Patch Diffing
    - 4.2	Introduction to Memory Paging and Structures
        - 4.2.1	Memory Descriptor Lists (MDLs)
        - 4.2.2	The PML Self Reference Entry
        - 4.2.3	PML Self Reference Entry Randomization
    - 4.3	Virtualization Based Security
        - 4.3.1	Hyper-V: The Windows Hypervisor
        - 4.3.2	Windows Hypervisor Debugging
    - 4.4	Interacting With the Device Driver
    - 4.5	Extra Mile Exercise
    - 4.6	Reaching the Vulnerable Code Block
    - 4.7	Joy: From Happiness to Insight
        - 4.7.1	A Wild Blue Screen Appears
        - 4.7.2	Contentment: Unveiling Inner Peace
        - 4.7.3	Uncertainty: Navigating the Unknown
        - 4.7.4	Doubt: Understanding Self-Doubt
        - 4.7.5	Fear: Facing Our Deepest Anxieties
        - 4.7.6	Despair: The Path to Hope
    - 4.8	Mapping Physical Memory to User Mode
    - 4.9	Exploiting the Vulnerability
    - 4.10	Wrapping Up
- 5	Unsanitized Usermode Callback
    - 5.1	Windows Desktop Applications
        - 5.1.1	Windows Kernel Pool Memory
        - 5.1.2	Creating Windows Desktop Applications
        - 5.1.3	Reversing the TagWND Object
        - 5.1.4	Kernel Usermode Callbacks
        - 5.1.5	Leaking pWND User Mode Objects
    - 5.2	Triggering the Vulnerability
        - 5.2.1	Spraying the Desktop Heap
        - 5.2.2	Hooking the Callback
        - 5.2.3	Arbitrary WndExtra Overwrite
    - 5.3	TagWND Write Primitive
        - 5.3.1	Overwrite pWND[0].cbWndExtra
        - 5.3.2	Overwrite pWND[0].WndExtra
    - 5.4	TagWND Leak and Read Primitive
        - 5.4.1	Changing pWND[0].dwStyle
        - 5.4.2	Setting The TagWND[0].spmenu
        - 5.4.3	Creating a fake TagWND[0].spmenu
        - 5.4.4	GetMenuBarInfo Read Primitive
    - 5.5	Privilege Escalation
        - 5.5.1	Low integrity
        - 5.5.2	Data Only Attack
        - 5.5.3	Restoring The Execution Flow
    - 5.6	Executing Code in Kernel Mode
        - 5.6.1	Leaking Nt and Wink Base
        - 5.6.2	NOPing kCFG
        - 5.6.3	Hijacking a Kernel Mode Routine
        - 5.6.4	Wrapping Up



# Exam Guide
- 71 hours and 45 minutes
- 24 hours report
- 2 assignments - 1 user-mode and 1 kernel-mode exploit

## Report
```
Table of Contents

1.0 Offensive-Security OSEE Exam Documentation	    3
2.0 192.168.XX.11 (25 Points or 50 Points)	        4
    2.1 Proof.txt	                                4
    2.2 Initial Exploitation	                    4
    2.3 Read and Write Primitive	                4
    2.4 Code Execution	                            4
    2.5 Sandbox Escape	                            4
    2.6 Proof of Concept	                        4
    2.7 Screenshots	                                5
3.0 192.168.XX.63 (25 or 50 Points)	                6
    3.1 Proof.txt	                                6
    3.2 Race Condition	                            6
    3.3 Kernel Memory Leak	                        6
    3.4 Read and Write Primitive	                6
    3.5 Privilege Escalation	                    6
    3.6 PoC Code	                                6
    3.7 Screenshots	                                6
```

## Reference
- https://help.offsec.com/hc/en-us/articles/360046458732-EXP-401-Advanced-Windows-Exploitation-OSEE-Exam-Guide