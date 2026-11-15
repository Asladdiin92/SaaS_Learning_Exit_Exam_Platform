# Modern Block Ciphers & Data Encryption Standard (DES)
**Course Code:** IT-SEC-401 (ITec4133) | **Learning Outcome:** `OUTCOME-ITSEC-CH3`

## Chapter Learning Focus & Cheat Sheet Notes

<a id="NOTE-CH3-041"></a>
### NOTE-CH3-041 (Question 41)
Block vs. Stream Cipher: Block processes fixed-size data blocks; stream processes bit/byte streams continuously.

<a id="NOTE-CH3-042"></a>
### NOTE-CH3-042 (Question 42)
Diffusion: Spreading plaintext statistics throughout ciphertext to obscure patterns.

<a id="NOTE-CH3-043"></a>
### NOTE-CH3-043 (Question 43)
Confusion: Obscuring the relationship between secret key and ciphertext.

<a id="NOTE-CH3-044"></a>
### NOTE-CH3-044 (Question 44)
Feistel Cipher: Iterative architecture partitioning data blocks into $L$ and $R$ halves.

<a id="NOTE-CH3-045"></a>
### NOTE-CH3-045 (Question 45)
Feistel Decryption: Exact same encryption operations executed with reversed subkey schedule.

<a id="NOTE-CH3-046"></a>
### NOTE-CH3-046 (Question 46)
DES Parameters: 64-bit block size; 56-bit effective key length (8 parity bits discarded).

<a id="NOTE-CH3-047"></a>
### NOTE-CH3-047 (Question 47)
Initial Permutation (IP): Pre-round 64-bit input transposition.

<a id="NOTE-CH3-048"></a>
### NOTE-CH3-048 (Question 48)
DES Expansion Permutation (E): Converts 32-bit data block to 48-bit vector for subkey XORing.

<a id="NOTE-CH3-049"></a>
### NOTE-CH3-049 (Question 49)
DES S-Boxes: Non-linear substitution tables mapping 6 bits to 4 bits.

<a id="NOTE-CH3-050"></a>
### NOTE-CH3-050 (Question 50)
S-Box Indexing: Row = outer bits 1 & 6; Column = inner bits 2-5.

<a id="NOTE-CH3-051"></a>
### NOTE-CH3-051 (Question 51)
DES Key Schedule: Generates sixteen 48-bit round subkeys from 56-bit key.

<a id="NOTE-CH3-052"></a>
### NOTE-CH3-052 (Question 52)
Avalanche Effect: Small input change produces large, unpredictable output bit changes (~50%).

<a id="NOTE-CH3-053"></a>
### NOTE-CH3-053 (Question 53)
DES Vulnerability: 56-bit key space is susceptible to brute-force key search attacks.

<a id="NOTE-CH3-054"></a>
### NOTE-CH3-054 (Question 54)
Differential Cryptanalysis: Statistical attack examining input/output differences of plaintext pairs.

<a id="NOTE-CH3-055"></a>
### NOTE-CH3-055 (Question 55)
Linear Cryptanalysis: Finding linear approximations of S-box behavior to recover keys.

<a id="NOTE-CH3-056"></a>
### NOTE-CH3-056 (Question 56)
Triple DES (3DES): Uses Encrypt-Decrypt-Encrypt (EDE) for backward compatibility.

<a id="NOTE-CH3-057"></a>
### NOTE-CH3-057 (Question 57)
DES Key Rotation: 28-bit key halves are rotated left by 1 or 2 bits per round.

<a id="NOTE-CH3-058"></a>
### NOTE-CH3-058 (Question 58)
Subkey Reversal: Feistel decryption applies round keys in reverse sequence.

<a id="NOTE-CH3-059"></a>
### NOTE-CH3-059 (Question 59)
Inverse IP: Final 64-bit permutation step producing output ciphertext.

<a id="NOTE-CH3-060"></a>
### NOTE-CH3-060 (Question 60)
Feistel Equations: $L_i = R_{i-1}$; $R_i = L_{i-1} \oplus F(R_{i-1}, K_i)$.
