---
permalink: /reversing/
title: "Reversing"
author_profile: true
---

{% include toc %}

# IDA Pro
- Options -> General
    - [x] Line prefies (graph)
    - [x] Auto comments
    - Number of opcode bytes: 6
    - Instruction indentation: 8

- Analyzing Functions
    - `Alt+P` - modify function options
    - **local variables**: negative offset relative to EBP
    - **arguments**: positive offset relative to EBP

- Using Named Constants
    - Right-click on a value -> Standard Symbolic Instance
    - To load a type library: View -> Open Subviews -> Type Libraries

- Redefining Code and Data
    - `U` - undefine functions, code, or data
    - `C` - define raw bytes as code
    - `D` - define raw bytes as data
    - `A` - define raw bytes as ASCII strings

- Recognizing C Code Constructs in Assembly
    - Global vs. Local Variables
        - Global - referenced by memory address
        - Local  - referenced by the stack addresses

- Function Call Conventions
    - x86
        - cdecl
            - parameters are pushed onto the stack from right to left
            - the caller cleans up the stack
        - stdcall
            - parameters are pushed onto the stack from right to left
            - the calle cleans up the stack
            - standard calling convention for the Windows API
        - fastcall
            - First two parameters are saved to ECX and EDX
            - additional arguments are pushed to the stack from right to left
            - the callee cleans up the stack
    - x64
        - fastcall
            - First four parameters are saved to ECX, EDX, R8, and R9
            - additional arguments are pushed to the stack from right to left
            - the caller cleans up the stack
            - the only function call convention in x64

- Push vs. Move
    - Visual Studio version
        - uses push
        ```
        00401746 mov [ebp+var_4], 1                 ; x = 1
        0040174D mov [ebp+var_8], 2                 ; y = 2
        00401754 mov eax, [ebp+var_8]
        00401757 push eax
        00401758 mov ecx, [ebp+var_4]
        0040175B push ecx
        0040175C call adder                         ; return a+b;
        00401761 add esp, 8
        00401764 push eax                           ; arg2 - the result of adder function
        00401765 push offset TheFunctionRet         ; arg1 - the string to print
        0040176A call ds:printf
        ```
    - GCC version
        - uses move
        ```
        00401085 mov [ebp+var_4], 1
        0040108C mov [ebp+var_8], 2
        00401093 mov eax, [ebp+var_8]
        00401096 mov [esp+4], eax
        0040109A mov eax, [ebp+var_4]
        0040109D mov [esp], eax
        004010A0 call adder
        004010A5 mov [esp+4], eax
        004010A9 mov [esp], offset TheFunctionRet
        004010B0 call printf
        ```

- Analyzing switch Statements
    - `if` style
        ```
        00401013 cmp [ebp+var_8], 1
        00401017 jz short loc_401027
        00401019 cmp [ebp+var_8], 2
        0040101D jz short loc_40103D
        0040101F cmp [ebp+var_8], 3
        00401023 jz short loc_401053
        00401025 jmp short loc_401067
        ```
    - `jmp` tables
        - commonly found with large, contiguous `switch` statements
        ```
        00401016 sub ecx, 1
        00401019 mov [ebp+var_8], ecx
        0040101C cmp [ebp+var_8], 3
        00401020 ja short loc_401082
        00401022 mov edx, [ebp+var_8]
        00401025 jmp ds:off_401088[edx*4]
        ...
        00401088 off_401088 dd offset loc_40102C
        0040108C dd offset loc_401042
        00401090 dd offset loc_401058
        00401094 dd offset loc_40106E
        ```

- Disassembling Arrays
    - the size of arrays are not always obvious, but it can be determined by seeing how the array is being indexed
    ```c
    int b[5] = {123,87,487,7,978};
    void main()
    {
        int i;
        int a[5];

        for(i = 0; i<5; i++)
        {
            a[i] = i;
            b[i] = i;
        }
    }
    ```
    ```nasm
    00401006 mov [ebp+var_18], 0                ; int i; i = 0;
    0040100D jmp short loc_401018
    0040100F loc_40100F:
    0040100F mov eax, [ebp+var_18]
    00401012 add eax, 1
    00401015 mov [ebp+var_18], eax
    00401018 loc_401018:
    00401018 cmp [ebp+var_18], 5                ; i < 5     - infer here how many items in array
    0040101C jge short loc_401037
    0040101E mov ecx, [ebp+var_18]
    00401021 mov edx, [ebp+var_18]
    00401024 mov [ebp+ecx*4+var_14], edx        ; Local     - a = var_14
    00401028 mov eax, [ebp+var_18]
    0040102B mov ecx, [ebp+var_18]
    0040102E mov dword_40A000[ecx*4], eax       ; Global    - b = dword_40A000
    00401035 jmp short loc_40100F
    ```

- Identifying Structs