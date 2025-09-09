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

```c
struct my_structure {
    int x[5];
    char y;
    double z;
};

struct my_structure *gms;

void test(struct my_structure *q)
    {
    int i;
    q->y = 'a';
    q->z = 15.6;
    for(i = 0; i<5; i++){
        q->x[i] = i;
    }
}

void main()
{
    gms = (struct my_structure *) malloc(
    sizeof(struct my_structure));
    test(gms);
}
```
```nasm
00401000 push ebp
00401001 mov ebp, esp
00401003 push ecx
00401004 mov eax,[ebp+arg_0]
00401007 mov byte ptr [eax+14h], 61h
0040100B mov ecx, [ebp+arg_0]
0040100E fld ds:dbl_40B120              ; Load Floating Point Value (to FPU register stack)
00401014 fstp qword ptr [ecx+18h]       ; Store Floating-Point Value (from FPU register stack)
00401017 mov [ebp+var_4], 0
0040101E jmp short loc_401029
00401020 loc_401020:
00401020 mov edx,[ebp+var_4]
00401023 add edx, 1
00401026 mov [ebp+var_4], edx
00401029 loc_401029:
00401029 cmp [ebp+var_4], 5
0040102D jge short loc_40103D
0040102F mov eax,[ebp+var_4]            ; i
00401032 mov ecx,[ebp+arg_0]            ; q
00401035 mov edx,[ebp+var_4]            ; i
00401038 mov [ecx+eax*4],edx            ; q->x[i] = i
0040103B jmp short loc_401020
0040103D loc_40103D:
0040103D mov esp, ebp
0040103F pop ebp
00401040 retn
```

- Analyzing Linked List Traversal
```c
struct node
{
    int x;
    struct node * next;
};

typedef struct node pnode;

void main()
{
    pnode * curr, * head;
    int i;
    head = NULL;

    for(i=1;i<=10;i++)
    {
        curr = (pnode *)malloc(sizeof(pnode));
        curr->x = i;
        curr->next = head;
        head = curr;
    }

    curr = head;

    while(curr)
    {
        printf("%d\n", curr->x);
        curr = curr->next ;
    }
}
```
```nasm
0040106A mov [ebp+var_8], 0                 ; var_8 = head
00401071 mov [ebp+var_C], 1                 ; i
00401078
00401078 loc_401078:
00401078 cmp [ebp+var_C], 0Ah
0040107C jg short loc_4010AB                ; i > 10
0040107E mov [esp+18h+var_18], 8            ; uses move instead of push (GCC version)
00401085 call malloc                        
0040108A mov [ebp+var_4], eax               ; var_4 = curr
0040108D mov edx, [ebp+var_4]
00401090 mov eax, [ebp+var_C]
00401093 mov [edx], eax                     ; curr->x = i;
00401095 mov edx, [ebp+var_4]
00401098 mov eax, [ebp+var_8]
0040109B mov [edx+4], eax                   ; curr->next = head;
0040109E mov eax, [ebp+var_4]
004010A1 mov [ebp+var_8], eax               ; head = curr;
004010A4 lea eax, [ebp+var_C]
004010A7 inc dword ptr [eax]                ; i++
004010A9 jmp short loc_401078
004010AB loc_4010AB:
004010AB mov eax, [ebp+var_8]
004010AE mov [ebp+var_4], eax               ; curr = head
004010B1
004010B1 loc_4010B1:
004010B1 cmp [ebp+var_4], 0                 ; while(curr)
004010B5 jz short locret_4010D7
004010B7 mov eax, [ebp+var_4]
004010BA mov eax, [eax]
004010BC mov [esp+18h+var_14], eax
004010C0 mov [esp+18h+var_18], offset aD    ; "%d\n"
004010C7 call printf                        ; printf("%d\n", curr->x)
004010CC mov eax, [ebp+var_4]
004010CF mov eax, [eax+4]
004010D2 mov [ebp+var_4], eax               ; curr = curr->next;
004010D5 jmp short loc_4010B1
```


