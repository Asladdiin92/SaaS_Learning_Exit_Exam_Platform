/**
 * Official B.Sc. IT National Exit Exam Course Study Materials & Digital Library
 * Comprehensive, structured course manuscripts across all 5 Themes & 15 Courses.
 */

export interface CourseMaterialItem {
  id: string;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  themeNumber: number;
  themeTitle: string;
  title: string;
  subtitle: string;
  readTimeMin: number;
  chapters: { title: string; anchor: string }[];
  markdown: string;
}

export const CANONICAL_STUDY_MATERIALS: CourseMaterialItem[] = [
  // ── THEME 1: Computer Systems & Hardware ──────────────────────────────────
  {
    id: 'mat_cmts_101',
    courseId: 101,
    courseCode: 'IT-CMTS-101',
    courseTitle: 'Computer Maintenance and Technical Support',
    themeNumber: 1,
    themeTitle: 'Computer System',
    title: 'PC Diagnostics, Firmware & Storage Fault Isolation',
    subtitle: 'Hardware diagnostics, BIOS/UEFI boot sequences, RAID levels & power troubleshooting',
    readTimeMin: 22,
    chapters: [
      { title: '1. Motherboard Architecture & Chipsets', anchor: 'ch1' },
      { title: '2. Firmware POST & UEFI vs MBR/GPT', anchor: 'ch2' },
      { title: '3. Power Supplies & Multimeter Diagnosis', anchor: 'ch3' },
      { title: '4. Storage Technologies & RAID Fault Tolerance', anchor: 'ch4' },
      { title: '5. Exit Exam Diagnostic Flowcharts', anchor: 'ch5' },
    ],
    markdown: `# IT-CMTS-101: Computer Maintenance and Technical Support

## Chapter 1: Motherboard Architecture & Chipsets
The modern PC motherboard serves as the central communication backplane.
- **Northbridge (Historical) vs Integrated Memory Controller (IMC)**: High-speed communication with CPU, RAM, and primary PCIe x16 graphics bus. In modern architectures (Intel Core, AMD Zen), memory controllers and PCIe lanes are integrated directly on the CPU die.
- **Southbridge / Platform Controller Hub (PCH)**: Manages lower-speed I/O buses: SATA ports, USB controllers, PCIe general-purpose lanes, Ethernet, and Legacy LPC/eSPI buses.
- **Expansion Bus Speeds**:
  - PCIe 3.0: ~1 GB/s per lane (x16 = 15.75 GB/s bidirectional)
  - PCIe 4.0: ~2 GB/s per lane (x16 = 31.5 GB/s)
  - PCIe 5.0: ~4 GB/s per lane (x16 = 63.0 GB/s)

## Chapter 2: Firmware POST & UEFI vs MBR/GPT
- **Power-On Self-Test (POST)**: Hardware routine executed by firmware to test CPU registers, DRAM refresh cycles, video adapters, and keyboard controllers.
- **Beep Codes & Debug LEDs**:
  - Continuous beep / repeating short beeps: DRAM detection failure or improper seating.
  - 1 long, 2 or 3 short beeps: Video display adapter failure.
- **UEFI vs Legacy BIOS Comparison**:
  - Legacy BIOS: 16-bit real mode execution, 1MB address space, MBR partition scheme (max 2.2 TB drive capacity, max 4 primary partitions).
  - UEFI: 32-bit or 64-bit protected mode execution, Secure Boot digital signature verification, GUID Partition Table (GPT) support up to 9.4 ZB and 128 primary partitions.

## Chapter 3: Power Supplies & Multimeter Diagnosis
- **ATX12V Power Rails**:
  - **+12V (Yellow)**: Supplies CPU Voltage Regulator Modules (VRMs), GPU PCIe supplemental power, spindle motors.
  - **+5V (Red)**: Supplies logic circuits, SATA drives, legacy USB ports.
  - **+3.3V (Orange)**: Supplies chipset, motherboard logic, PCIe cards.
  - **-12V (Blue)**: Legacy serial communication interfaces.
  - **+5VSB (Purple)**: Standby power active whenever PSU is connected to AC mains (powers Wake-on-LAN, power switch sensing).
- **Tolerance Limits**: All DC voltage rails must remain within **±5%** under load (e.g., +12V rail valid range: 11.40V to 12.60V).

## Chapter 4: Storage Technologies & RAID Fault Tolerance
| RAID Level | Min Disks | Capacity Formula | Fault Tolerance | Read/Write Performance |
| :--- | :--- | :--- | :--- | :--- |
| **RAID 0 (Striping)** | 2 | $N \\times \\text{Size}$ | 0 disks (No redundancy) | Very High / Very High |
| **RAID 1 (Mirroring)** | 2 | $1 \\times \\text{Size}$ | 1 disk loss survived | High read / Normal write |
| **RAID 5 (Distributed Parity)**| 3 | $(N - 1) \\times \\text{Size}$ | 1 disk loss survived | High read / Parity calculation overhead |
| **RAID 6 (Dual Parity)** | 4 | $(N - 2) \\times \\text{Size}$ | 2 disk losses survived | High read / Slower write |
| **RAID 10 (1+0 Striped Mirrors)**| 4 | $(N / 2) \\times \\text{Size}$ | Up to 1 disk per mirror pair | Very High / High |

## Chapter 5: Exit Exam Diagnostic Flowcharts
- **Scenario**: System powers on, fans spin, but No Signal on monitor and no beep code.
  - Step 1: Reseat RAM modules into alternate channels (Channel A2/B2).
  - Step 2: Clear CMOS by bridging CLRTC jumpers or removing CR2032 battery for 5 minutes.
  - Step 3: Disconnect all non-essential peripheral cards and secondary SATA/NVMe drives (minimal POST testing).
`,
  },

  // ── THEME 2: System / Software Development ───────────────────────────────
  {
    id: 'mat_oopr_202',
    courseId: 201,
    courseCode: 'IT-OOPR-202',
    courseTitle: 'Object Oriented Programming in Java',
    themeNumber: 2,
    themeTitle: 'System/Software Development',
    title: 'Core OOP Principles, Memory Lifecycle & Polymorphism',
    subtitle: 'Inheritance, dynamic dispatch, JVM heap/stack, interfaces & exception handling',
    readTimeMin: 25,
    chapters: [
      { title: '1. The Four Pillars of OOP', anchor: 'ch1' },
      { title: '2. Polymorphism & Dynamic Method Dispatch', anchor: 'ch2' },
      { title: '3. JVM Architecture: Heap vs Stack', anchor: 'ch3' },
      { title: '4. Interfaces vs Abstract Classes', anchor: 'ch4' },
      { title: '5. Collections & Exception Hierarchy', anchor: 'ch5' },
    ],
    markdown: `# IT-OOPR-202: Object Oriented Programming (Java)

## Chapter 1: The Four Pillars of OOP
1. **Encapsulation**: Bundling state (fields) and behavior (methods) together while restricting direct access via access modifiers (\`private\`, \`protected\`, \`public\`).
2. **Abstraction**: Hiding internal implementation complexity and exposing only necessary operations via abstract classes and interfaces.
3. **Inheritance**: \`extends\` mechanism where child subclasses acquire fields and methods of a parent superclass, fostering code reuse.
4. **Polymorphism**: The ability of an object reference to take on multiple forms at runtime through method overriding.

## Chapter 2: Polymorphism & Dynamic Method Dispatch
- **Static Polymorphism (Compile-time)**: Method Overloading — methods in the same class sharing the same name but possessing distinct parameter type signatures.
- **Dynamic Polymorphism (Runtime)**: Method Overriding — a subclass provides a specific implementation of a method declared in its superclass using the \`@Override\` annotation.
\`\`\`java
class Animal {
    void makeSound() { System.out.println("Generic sound"); }
}
class Dog extends Animal {
    @Override
    void makeSound() { System.out.println("Bark"); }
}

Animal a = new Dog(); // Upcasting
a.makeSound();        // Prints "Bark" via Dynamic Method Dispatch (vtable lookup)
\`\`\`

## Chapter 3: JVM Architecture: Heap vs Stack
- **Call Stack**:
  - Thread-isolated memory holding primitive local variables and object reference pointers.
  - Automatically allocated and deallocated as stack frames enter and exit method scope.
- **Garbage-Collected Heap**:
  - Shared memory pool where all object instances (\`new Object()\`) and class arrays reside.
  - Managed by generational garbage collectors (Eden, Survivor Spaces S0/S1, Tenured/Old Gen).
  - Unreferenced objects eligible for GC when no active root reference points to them.

## Chapter 4: Interfaces vs Abstract Classes
| Dimension | Interface (Java 8+) | Abstract Class |
| :--- | :--- | :--- |
| **Multiple Inheritance** | Yes (class implements multiple interfaces) | No (single \`extends\` inheritance) |
| **State Fields** | Only \`public static final\` constants | Instance variables and mutable state permitted |
| **Constructors** | Cannot possess constructors | Can declare constructors invoked by subclasses |
| **Method Types** | Abstract, \`default\`, and \`static\` methods | Abstract and fully implemented concrete methods |

## Chapter 5: Collections & Exception Hierarchy
- **Throwable**:
  - **Error**: Irrecoverable system conditions (\`OutOfMemoryError\`, \`StackOverflowError\`). Applications should not catch.
  - **Exception**:
    - **Checked Exceptions**: Subclasses of \`Exception\` (excluding \`RuntimeException\`). Must be declared in \`throws\` clause or caught (\`IOException\`, \`SQLException\`).
    - **Unchecked Exceptions**: Subclasses of \`RuntimeException\` (\`NullPointerException\`, \`ArrayIndexOutOfBoundsException\`). Signify logical programming errors.
`,
  },

  {
    id: 'mat_dstr_204',
    courseId: 203,
    courseCode: 'IT-DSTR-204',
    courseTitle: 'Data Structures and Algorithms',
    themeNumber: 2,
    themeTitle: 'System/Software Development',
    title: 'Asymptotic Analysis, Trees, Graphs & Sorting Master Notes',
    subtitle: 'Big-O complexity, BST, traversal algorithms, hash collisions & sorting efficiencies',
    readTimeMin: 28,
    chapters: [
      { title: '1. Asymptotic Complexity (Big-O, Omega, Theta)', anchor: 'ch1' },
      { title: '2. Linear Structures: Linked Lists, Stacks, Queues', anchor: 'ch2' },
      { title: '3. Trees: Binary Search Trees & AVL Balancing', anchor: 'ch3' },
      { title: '4. Graphs: BFS, DFS & Shortest Path', anchor: 'ch4' },
      { title: '5. Sorting & Hash Table Collision Strategies', anchor: 'ch5' },
    ],
    markdown: `# IT-DSTR-204: Data Structures and Algorithms

## Chapter 1: Asymptotic Complexity (Big-O, Omega, Theta)
- **Big-O ($O$)**: Represents the asymptotic **upper bound** (worst-case execution scenario).
- **Big-Omega ($\\Omega$)**: Represents the asymptotic **lower bound** (best-case execution scenario).
- **Big-Theta ($\\Theta$)**: Represents the **tight bound** when upper and lower bounds coincide.

### Complexity Hierarchy
$$O(1) < O(\\log n) < O(n) < O(n \\log n) < O(n^2) < O(2^n) < O(n!)$$

## Chapter 2: Linear Structures
- **Linked List Operations**:
  - Head insertion: $O(1)$
  - Tail insertion (with tail pointer): $O(1)$
  - Middle insertion / search: $O(n)$
- **Stack (LIFO)**: Implements \`push()\`, \`pop()\`, \`peek()\` in $O(1)$ time. Used in call stack management, undo buffers, and arithmetic expression parsing (Infix to Postfix).
- **Queue (FIFO)**: Implements \`enqueue()\`, \`dequeue()\` in $O(1)$ time. Used in CPU scheduling queues and breadth-first search.

## Chapter 3: Trees: Binary Search Trees & AVL Balancing
- **Binary Search Tree (BST) Property**: For every node $N$, all keys in the left subtree $< \\text{key}(N)$, and all keys in the right subtree $> \\text{key}(N)$.
- **Tree Traversals**:
  - **In-order (Left, Root, Right)**: Yields elements in strictly sorted ascending order.
  - **Pre-order (Root, Left, Right)**: Useful for serializing / duplicating tree structures.
  - **Post-order (Left, Right, Root)**: Ideal for post-fix evaluation and bottom-up node deletion.
- **AVL Tree Balancing**: Self-balancing BST where the balance factor $\\text{height}(\\text{left}) - \\text{height}(\\text{right})$ must stay in $\\{-1, 0, +1\\}$. Rotations: LL, RR, LR, RL.

## Chapter 4: Sorting Algorithm Complexities
| Algorithm | Best Case | Average Case | Worst Case | Space | Stable? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bubble Sort** | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |
| **Insertion Sort** | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |
| **Merge Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n \\log n)$ | $O(n)$ | Yes |
| **Quick Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n^2)$ (sorted pivot) | $O(\\log n)$ | No |
| **Heap Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n \\log n)$ | $O(1)$ | No |
`,
  },

  // ── THEME 3: Database System & Information Management ────────────────────
  {
    id: 'mat_dbms_301',
    courseId: 301,
    courseCode: 'IT-DBMS-301',
    courseTitle: 'Database Systems & Design',
    themeNumber: 3,
    themeTitle: 'Database System & Information Management',
    title: 'Relational Model, Normalization (1NF–BCNF) & ACID Transactions',
    subtitle: 'Functional dependencies, normal forms, SQL joins, indexes & concurrency control',
    readTimeMin: 26,
    chapters: [
      { title: '1. Relational Model Fundamentals & Keys', anchor: 'ch1' },
      { title: '2. Normalization: 1NF, 2NF, 3NF & BCNF', anchor: 'ch2' },
      { title: '3. SQL DDL/DML, Complex Joins & Aggregations', anchor: 'ch3' },
      { title: '4. ACID Transaction Properties & Isolation Levels', anchor: 'ch4' },
      { title: '5. Query Optimization & Indexing Structures', anchor: 'ch5' },
    ],
    markdown: `# IT-DBMS-301: Database Systems & Design

## Chapter 1: Relational Model Fundamentals & Keys
- **Candidate Key**: A minimal superkey possessing uniqueness (no duplicate values) and irreducibility (no attribute can be discarded without losing uniqueness).
- **Primary Key (PK)**: Selected candidate key that uniquely identifies tuples in a table. Cannot accept \`NULL\` values (Entity Integrity Constraint).
- **Foreign Key (FK)**: Attribute set in one table that references candidate key values of another table (Referential Integrity Constraint).

## Chapter 2: Normalization: 1NF, 2NF, 3NF & BCNF
Normalization eliminates redundancy and prevents insertion, update, and deletion anomalies.
1. **First Normal Form (1NF)**:
   - All attribute domains contain only **atomic (indivisible)** values.
   - No repeating groups or multi-valued arrays.
2. **Second Normal Form (2NF)**:
   - Table must be in **1NF**.
   - No **partial functional dependency**: every non-prime attribute must depend on the whole candidate key, not a proper subset of a composite primary key.
3. **Third Normal Form (3NF)**:
   - Table must be in **2NF**.
   - No **transitive functional dependency**: non-prime attributes cannot functionally determine other non-prime attributes ($A \\rightarrow B \\rightarrow C$).
4. **Boyce-Codd Normal Form (BCNF)**:
   - Strict version of 3NF: for every non-trivial functional dependency $X \\rightarrow Y$, $X$ must be a **superkey**.

## Chapter 3: ACID Properties & Transaction Processing
- **Atomicity**: "All or nothing" — every operation in a transaction completes, or the database is rolled back to its pre-transaction state.
- **Consistency**: The database moves from one valid state conforming to all integrity rules to another valid state.
- **Isolation**: Concurrent transactions execute without mutual interference.
- **Durability**: Committed transactions persist permanently in non-volatile storage, surviving power failures or crashes.

## Chapter 4: SQL Isolation Levels & Concurrency Anomalies
| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
| :--- | :--- | :--- | :--- |
| **Read Uncommitted** | Possible | Possible | Possible |
| **Read Committed** | **Prevented** | Possible | Possible |
| **Repeatable Read** | **Prevented** | **Prevented** | Possible |
| **Serializable** | **Prevented** | **Prevented** | **Prevented** |
`,
  },

  // ── THEME 5: Networking & Information Security ───────────────────────────
  {
    id: 'mat_dcom_205',
    courseId: 501,
    courseCode: 'IT-DCOM-205',
    courseTitle: 'Data Communication and Computer Networks',
    themeNumber: 5,
    themeTitle: 'Networking & Information Security',
    title: 'OSI 7-Layer, Subnetting (VLSM) & Transport Protocols',
    subtitle: 'Protocol stacks, CIDR subnetting calculations, TCP 3-way handshake & routing mechanisms',
    readTimeMin: 27,
    chapters: [
      { title: '1. OSI 7-Layer vs TCP/IP Protocol Models', anchor: 'ch1' },
      { title: '2. IPv4 Addressing & VLSM Subnet Calculations', anchor: 'ch2' },
      { title: '3. Transport Layer: TCP vs UDP In-Depth', anchor: 'ch3' },
      { title: '4. Ethernet Switching & Collision Domains', anchor: 'ch4' },
      { title: '5. Routing Protocols: Distance Vector vs Link-State', anchor: 'ch5' },
    ],
    markdown: `# IT-DCOM-205: Data Communication and Computer Networks

## Chapter 1: OSI 7-Layer vs TCP/IP Protocol Models
| OSI Layer | PDU Name | Core Responsibilities | Protocols / Hardware |
| :--- | :--- | :--- | :--- |
| **7. Application** | Data | User interface, network services | HTTP, DNS, SMTP, FTP, SSH |
| **6. Presentation** | Data | Syntax translation, compression, encryption | TLS/SSL, JPEG, ASCII |
| **5. Session** | Data | Session establishment, maintenance, teardown | NetBIOS, RPC, Sockets |
| **4. Transport** | Segment | End-to-end reliability, multiplexing (ports) | TCP, UDP |
| **3. Network** | Packet | Logical addressing, path determination (routing) | IPv4, IPv6, ICMP, Routers |
| **2. Data Link** | Frame | Physical addressing (MAC), framing, error detection | Ethernet, ARP, Switches |
| **1. Physical** | Bit | Raw bit stream transmission over physical media | Cables, Hubs, Modems |

## Chapter 2: IPv4 Addressing & VLSM Subnet Calculations
- **IPv4 Address**: 32 bits divided into 4 octets.
- **CIDR & Subnet Mask Calculation**:
  - Subnetting borrows host bits to create subnets: $\\text{Number of Subnets} = 2^{\\text{borrowed bits}}$
  - Usable hosts per subnet: $\\text{Usable Hosts} = 2^{\\text{host bits}} - 2$ (subtract network and broadcast addresses).
- **Subnetting Example (/26)**:
  - Mask: \`255.255.255.192\` (Borrowed 2 bits from last octet).
  - Block size: $256 - 192 = 64$.
  - Subnets: \`.0\`, \`.64\`, \`.128\`, \`.192\`.
  - Subnet \`192.168.1.64/26\`:
    - Network: \`192.168.1.64\`
    - Usable Range: \`192.168.1.65\` to \`192.168.1.126\`
    - Broadcast: \`192.168.1.127\`

## Chapter 3: Transport Layer: TCP vs UDP
- **TCP (Transmission Control Protocol)**:
  - Connection-oriented: establishes connection via **3-Way Handshake** (\`SYN\` $\\rightarrow$ \`SYN-ACK\` $\\rightarrow$ \`ACK\`).
  - Guaranteed delivery via sequence numbers and ACKs.
  - Flow control via Sliding Window Protocol.
  - Congestion control algorithms (Slow Start, Congestion Avoidance).
- **UDP (User Datagram Protocol)**:
  - Connectionless, unreliable, low-overhead transport.
  - Preferred for real-time streaming, VoIP, DNS queries, and DHCP.
`,
  },

  {
    id: 'mat_iasc_401',
    courseId: 402,
    courseCode: 'IT-IASC-401',
    courseTitle: 'Information Assurance and Security',
    themeNumber: 5,
    themeTitle: 'Networking & Information Security',
    title: 'X.800 Architecture, Cryptographic Algorithms & RSA Key Exchange',
    subtitle: 'CIA triad, active/passive attacks, DES/AES, RSA modular mathematics & digital certificates',
    readTimeMin: 30,
    chapters: [
      { title: '1. CIA Triad & Threat Taxonomy (Active vs Passive)', anchor: 'ch1' },
      { title: '2. X.800 Security Architecture Services', anchor: 'ch2' },
      { title: '3. Symmetric Encryption: Classical to Modern Block Ciphers', anchor: 'ch3' },
      { title: '4. Asymmetric Cryptography: RSA & Diffie-Hellman', anchor: 'ch4' },
      { title: '5. Hash Functions, MACs & Digital Signatures', anchor: 'ch5' },
    ],
    markdown: `# IT-IASC-401: Information Assurance and Security

## Chapter 1: CIA Triad & Threat Taxonomy
- **Confidentiality**: Preserving authorized restrictions on information access and disclosure.
- **Integrity**: Guarding against improper information modification or destruction.
- **Availability**: Ensuring timely and reliable access to and use of information.
- **Attacks Classification**:
  - **Passive Attacks**: Unauthorized observation of transmissions without altering content (eavesdropping, traffic analysis). Countered via encryption. Difficult to detect, so prevention is primary.
  - **Active Attacks**: Unauthorized modification of data stream or creation of a false stream (Masquerade, Replay, Modification of messages, Denial of Service). Countered via integrity checks and authentication. Hard to prevent completely, so detection is primary.

## Chapter 2: X.800 Security Architecture Services
1. **Authentication**: Assurance that the communicating entity is the one that it claims to be.
2. **Access Control**: Prevention of unauthorized use of a resource.
3. **Data Confidentiality**: Protection of data from unauthorized disclosure.
4. **Data Integrity**: Assurance that data received are exactly as sent.
5. **Non-Repudiation**: Protection against false denial by one of the parties involved in a communication.

## Chapter 3: Symmetric Encryption & Block Ciphers
- **Symmetric Ciphers**: Same secret key used for encryption and decryption. High throughput ($10^6$ times faster than RSA).
- **Feistel Network Architecture**:
  - Divides plaintext into two halves $(L_i, R_i)$.
  - Performs round operations: $L_{i+1} = R_i$, $R_{i+1} = L_i \\oplus F(R_i, K_{i+1})$.
  - Encryption and decryption use identical hardware logic by reversing key schedule.
- **Data Encryption Standard (DES)**: 64-bit block size, 56-bit effective key length (8 parity bits), 16 Feistel rounds. Vulnerable to brute-force key search ($2^{56}$ states).
- **Advanced Encryption Standard (AES)**: Non-Feistel Substitution-Permutation Network (SPN). 128-bit block size with key lengths of 128 (10 rounds), 192 (12 rounds), or 256 bits (14 rounds).

## Chapter 4: Asymmetric Cryptography & RSA
- **RSA Algorithm Mechanics**:
  1. Select two large distinct primes $p$ and $q$.
  2. Compute modulus $n = p \\times q$.
  3. Compute Euler Totient: $\\phi(n) = (p - 1)(q - 1)$.
  4. Select public exponent $e$ such that $\\gcd(e, \\phi(n)) = 1$ and $1 < e < \\phi(n)$.
  5. Compute private key $d$ such that $d \\equiv e^{-1} \\pmod{\\phi(n)}$ (Extended Euclidean Algorithm).
  - **Encryption**: $C = M^e \\bmod n$
  - **Decryption**: $M = C^d \\bmod n$
`,
  },
];
