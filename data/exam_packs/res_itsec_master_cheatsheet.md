# IT-SEC-401 Information Assurance and Security — Master Cheat Sheet
Comprehensive 80-Note Key Knowledge Synthesis across Chapters 1 through 4.

## Chapter 1: Introduction to Information Security & Security Architecture

<a id="NOTE-CH1-001"></a>
**NOTE-CH1-001**: Integrity: Preserving data correctness and guarding against unauthorized modification or destruction.

<a id="NOTE-CH1-002"></a>
**NOTE-CH1-002**: Passive Attacks: Interception/snooping that compromises confidentiality without altering data or system states.

<a id="NOTE-CH1-003"></a>
**NOTE-CH1-003**: Traffic Analysis: Inferring intelligence by examining connection timing, volume, and message headers.

<a id="NOTE-CH1-004"></a>
**NOTE-CH1-004**: Replay Attack: Passive capture followed by active retransmission of legitimate data blocks.

<a id="NOTE-CH1-005"></a>
**NOTE-CH1-005**: Nonrepudiation: Mathematical or cryptographic proof of message origin/delivery that cannot be denied.

<a id="NOTE-CH1-006"></a>
**NOTE-CH1-006**: Threat vs. Attack: Threat is potential harm; attack is the realization/exploitation of a threat.

<a id="NOTE-CH1-007"></a>
**NOTE-CH1-007**: Economy of Mechanism: Keep security mechanisms simple to minimize bugs and vulnerabilities.

<a id="NOTE-CH1-008"></a>
**NOTE-CH1-008**: Security Mechanisms: Algorithms and tools (encipherment, signatures) implementing security services.

<a id="NOTE-CH1-009"></a>
**NOTE-CH1-009**: RBAC: Access rights tied to organizational functions and user roles.

<a id="NOTE-CH1-010"></a>
**NOTE-CH1-010**: Defense in Depth: Layered security mechanisms providing redundant asset protection.

<a id="NOTE-CH1-011"></a>
**NOTE-CH1-011**: Authentication: Verification of identity and message origin authenticity.

<a id="NOTE-CH1-012"></a>
**NOTE-CH1-012**: Availability Loss: Resource exhaustion resulting in service denial to authorized users.

<a id="NOTE-CH1-013"></a>
**NOTE-CH1-013**: MAC Control: Centralized access enforcement based on system-wide security clearances.

<a id="NOTE-CH1-014"></a>
**NOTE-CH1-014**: Data Integrity: Cryptographic checks detecting transit data alteration.

<a id="NOTE-CH1-015"></a>
**NOTE-CH1-015**: Fail-safe Defaults: Explicit permission requirement (default deny state).

<a id="NOTE-CH1-016"></a>
**NOTE-CH1-016**: ACL vs. Capability: ACLs store rights by column (with object); Capability lists store rights by row (with subject).

<a id="NOTE-CH1-017"></a>
**NOTE-CH1-017**: Trusted Third Party: Key distribution and trust management authority.

<a id="NOTE-CH1-018"></a>
**NOTE-CH1-018**: Active Data Modification: Unauthorized tampering of payload data during transit.

<a id="NOTE-CH1-019"></a>
**NOTE-CH1-019**: Audit Trail: Logging system transactions to maintain accountability and trace breaches.

<a id="NOTE-CH1-020"></a>
**NOTE-CH1-020**: Accountability: Traceability of all system events to responsible entities.

## Chapter 2: Classical Encryption Techniques & Symmetric Ciphers

<a id="NOTE-CH2-021"></a>
**NOTE-CH2-021**: Kerckhoffs' Principle: System security must depend solely on key secrecy.

<a id="NOTE-CH2-022"></a>
**NOTE-CH2-022**: Caesar Key Space: 25 non-trivial shift keys ($C = (p + k) \pmod{26}$).

<a id="NOTE-CH2-023"></a>
**NOTE-CH2-023**: Additive Cipher Calculation: $C = (p + k) \pmod{26}$.

<a id="NOTE-CH2-024"></a>
**NOTE-CH2-024**: Multiplicative Keys: Require $\gcd(k, 26) = 1$; total valid keys = $\phi(26) = 12$.

<a id="NOTE-CH2-025"></a>
**NOTE-CH2-025**: Affine Key Space: $|K| = \phi(26) \times 26 = 12 \times 26 = 312$.
|---|

<a id="NOTE-CH2-026"></a>
**NOTE-CH2-026**: Playfair Rule 1: Split duplicate letters in digram pairs with filler 'x'.

<a id="NOTE-CH2-027"></a>
**NOTE-CH2-027**: Playfair Column Rule: Replace each character with the element directly below it.

<a id="NOTE-CH2-028"></a>
**NOTE-CH2-028**: Hill Cipher Key Invertibility: Requires $\gcd(\det(K), 26) = 1$.

<a id="NOTE-CH2-029"></a>
**NOTE-CH2-029**: Vigenère Encryption: $C_i = (p_i + k_{i \bmod m}) \pmod{26}$.

<a id="NOTE-CH2-030"></a>
**NOTE-CH2-030**: Kasiski Test: Finds keyword length by analyzing distances between repeated ciphertext patterns.

<a id="NOTE-CH2-031"></a>
**NOTE-CH2-031**: One-Time Pad: Truly random key of message length, used once, providing perfect secrecy.

<a id="NOTE-CH2-032"></a>
**NOTE-CH2-032**: OTP Limitations: Enormous random key generation requirements and difficult key distribution.

<a id="NOTE-CH2-033"></a>
**NOTE-CH2-033**: Rail Fence Cipher: Write plaintext diagonally across $N$ depth rows, read row-by-row.

<a id="NOTE-CH2-034"></a>
**NOTE-CH2-034**: Transposition vs. Substitution: Transposition permutes character positions; substitution changes character values.

<a id="NOTE-CH2-035"></a>
**NOTE-CH2-035**: Hill Cipher Cryptanalysis: Solve for key matrix using $K = P^{-1} \cdot C \pmod{26}$.

<a id="NOTE-CH2-036"></a>
**NOTE-CH2-036**: Steganography: Hiding message presence within secondary digital media.

<a id="NOTE-CH2-037"></a>
**NOTE-CH2-037**: Known-Plaintext Attack: Attacker possesses matching pairs of plaintexts and ciphertexts.

<a id="NOTE-CH2-038"></a>
**NOTE-CH2-038**: Monoalphabetic Weakness: Single-letter frequency patterns survive substitution intact.

<a id="NOTE-CH2-039"></a>
**NOTE-CH2-039**: Computationally Secure: Practical security defined by computational time/cost constraints.

<a id="NOTE-CH2-040"></a>
**NOTE-CH2-040**: Caesar Decryption: $p = (C - k) \pmod{26}$.

## Chapter 3: Modern Block Ciphers & Data Encryption Standard (DES)

<a id="NOTE-CH3-041"></a>
**NOTE-CH3-041**: Block vs. Stream Cipher: Block processes fixed-size data blocks; stream processes bit/byte streams continuously.

<a id="NOTE-CH3-042"></a>
**NOTE-CH3-042**: Diffusion: Spreading plaintext statistics throughout ciphertext to obscure patterns.

<a id="NOTE-CH3-043"></a>
**NOTE-CH3-043**: Confusion: Obscuring the relationship between secret key and ciphertext.

<a id="NOTE-CH3-044"></a>
**NOTE-CH3-044**: Feistel Cipher: Iterative architecture partitioning data blocks into $L$ and $R$ halves.

<a id="NOTE-CH3-045"></a>
**NOTE-CH3-045**: Feistel Decryption: Exact same encryption operations executed with reversed subkey schedule.

<a id="NOTE-CH3-046"></a>
**NOTE-CH3-046**: DES Parameters: 64-bit block size; 56-bit effective key length (8 parity bits discarded).

<a id="NOTE-CH3-047"></a>
**NOTE-CH3-047**: Initial Permutation (IP): Pre-round 64-bit input transposition.

<a id="NOTE-CH3-048"></a>
**NOTE-CH3-048**: DES Expansion Permutation (E): Converts 32-bit data block to 48-bit vector for subkey XORing.

<a id="NOTE-CH3-049"></a>
**NOTE-CH3-049**: DES S-Boxes: Non-linear substitution tables mapping 6 bits to 4 bits.

<a id="NOTE-CH3-050"></a>
**NOTE-CH3-050**: S-Box Indexing: Row = outer bits 1 & 6; Column = inner bits 2-5.

<a id="NOTE-CH3-051"></a>
**NOTE-CH3-051**: DES Key Schedule: Generates sixteen 48-bit round subkeys from 56-bit key.

<a id="NOTE-CH3-052"></a>
**NOTE-CH3-052**: Avalanche Effect: Small input change produces large, unpredictable output bit changes (~50%).

<a id="NOTE-CH3-053"></a>
**NOTE-CH3-053**: DES Vulnerability: 56-bit key space is susceptible to brute-force key search attacks.

<a id="NOTE-CH3-054"></a>
**NOTE-CH3-054**: Differential Cryptanalysis: Statistical attack examining input/output differences of plaintext pairs.

<a id="NOTE-CH3-055"></a>
**NOTE-CH3-055**: Linear Cryptanalysis: Finding linear approximations of S-box behavior to recover keys.

<a id="NOTE-CH3-056"></a>
**NOTE-CH3-056**: Triple DES (3DES): Uses Encrypt-Decrypt-Encrypt (EDE) for backward compatibility.

<a id="NOTE-CH3-057"></a>
**NOTE-CH3-057**: DES Key Rotation: 28-bit key halves are rotated left by 1 or 2 bits per round.

<a id="NOTE-CH3-058"></a>
**NOTE-CH3-058**: Subkey Reversal: Feistel decryption applies round keys in reverse sequence.

<a id="NOTE-CH3-059"></a>
**NOTE-CH3-059**: Inverse IP: Final 64-bit permutation step producing output ciphertext.

<a id="NOTE-CH3-060"></a>
**NOTE-CH3-060**: Feistel Equations: $L_i = R_{i-1}$; $R_i = L_{i-1} \oplus F(R_{i-1}, K_i)$.

## Chapter 4: Basic Concepts in Number Theory, Finite Fields & Public-Key Cryptography (RSA, Diffie-Hellman)

<a id="NOTE-CH4-061"></a>
**NOTE-CH4-061**: Consecutive Integers Coprimality: $\gcd(n, n+1) = 1$ because any common divisor must divide $(n+1)-n = 1$.

<a id="NOTE-CH4-062"></a>
**NOTE-CH4-062**: Euler's Totient $\phi(n)$: Count of positive integers $< n$ coprime to $n$.

<a id="NOTE-CH4-063"></a>
**NOTE-CH4-063**: Totient of Prime Product: $\phi(pq) = (p-1)(q-1)$.

<a id="NOTE-CH4-064"></a>
**NOTE-CH4-064**: Euler's Theorem: $a^{\phi(n)} \equiv 1 \pmod n$ when $\gcd(a, n) = 1$.

<a id="NOTE-CH4-065"></a>
**NOTE-CH4-065**: Asymmetric Confidentiality: Encrypt with recipient's Public Key; decrypt with recipient's Private Key.

<a id="NOTE-CH4-066"></a>
**NOTE-CH4-066**: Digital Signatures: Sign with sender's Private Key; verify with sender's Public Key.

<a id="NOTE-CH4-067"></a>
**NOTE-CH4-067**: RSA Private Key Calculation: $d = e^{-1} \pmod{\phi(n)}$ where $e \cdot d \equiv 1 \pmod{\phi(n)}$.

<a id="NOTE-CH4-068"></a>
**NOTE-CH4-068**: RSA Encryption: $C = M^e \pmod n$.

<a id="NOTE-CH4-069"></a>
**NOTE-CH4-069**: RSA Decryption: $M = C^d \pmod n$.

<a id="NOTE-CH4-070"></a>
**NOTE-CH4-070**: RSA Calculation: $C = M^e \pmod{pq}$.

<a id="NOTE-CH4-071"></a>
**NOTE-CH4-071**: RSA Cryptanalysis via Factoring: Factoring $n \rightarrow p, q \rightarrow \phi(n) \rightarrow d \rightarrow M = C^d \bmod n$.

<a id="NOTE-CH4-072"></a>
**NOTE-CH4-072**: Prime Generation Procedure: Pick random large odd integer $\rightarrow$ Run Miller-Rabin probabilistic primality test.

<a id="NOTE-CH4-073"></a>
**NOTE-CH4-073**: Diffie-Hellman Hard Problem: Computing Discrete Logarithms in finite fields.

<a id="NOTE-CH4-074"></a>
**NOTE-CH4-074**: Diffie-Hellman Public Key: $y_A = a^{x_A} \pmod q$.

<a id="NOTE-CH4-075"></a>
**NOTE-CH4-075**: Diffie-Hellman Shared Secret: $K = (y_B)^{x_A} \pmod q = (y_A)^{x_B} \pmod q$.

<a id="NOTE-CH4-076"></a>
**NOTE-CH4-076**: Diffie-Hellman Vulnerability: Susceptible to Man-in-the-Middle attacks unless authenticated with digital signatures/certificates.

<a id="NOTE-CH4-077"></a>
**NOTE-CH4-077**: Fermat vs. Euler: Fermat's Little Theorem ($a^{p-1} \equiv 1 \pmod p$) is a special case of Euler's Theorem ($a^{\phi(n)} \equiv 1 \pmod n$) for prime moduli.

<a id="NOTE-CH4-078"></a>
**NOTE-CH4-078**: Modular Reduction: Positive residue $r \in {0, \dots, n-1}$ such that $a = qn + r$.

<a id="NOTE-CH4-079"></a>
**NOTE-CH4-079**: Extended Euclidean Algorithm: Computes linear combination coefficients yielding modular inverse.

<a id="NOTE-CH4-080"></a>
**NOTE-CH4-080**: RSA Message Constraint: Plaintext numerical value $M$ must be smaller than system modulus $n$ ($M < n$).
