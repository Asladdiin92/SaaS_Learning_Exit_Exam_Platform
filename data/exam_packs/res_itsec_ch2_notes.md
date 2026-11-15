# Classical Encryption Techniques & Symmetric Ciphers
**Course Code:** IT-SEC-401 (ITec4133) | **Learning Outcome:** `OUTCOME-ITSEC-CH2`

## Chapter Learning Focus & Cheat Sheet Notes

<a id="NOTE-CH2-021"></a>
### NOTE-CH2-021 (Question 21)
Kerckhoffs' Principle: System security must depend solely on key secrecy.

<a id="NOTE-CH2-022"></a>
### NOTE-CH2-022 (Question 22)
Caesar Key Space: 25 non-trivial shift keys ($C = (p + k) \pmod{26}$).

<a id="NOTE-CH2-023"></a>
### NOTE-CH2-023 (Question 23)
Additive Cipher Calculation: $C = (p + k) \pmod{26}$.

<a id="NOTE-CH2-024"></a>
### NOTE-CH2-024 (Question 24)
Multiplicative Keys: Require $\gcd(k, 26) = 1$; total valid keys = $\phi(26) = 12$.

<a id="NOTE-CH2-025"></a>
### NOTE-CH2-025 (Question 25)
Affine Key Space: $|K| = \phi(26) \times 26 = 12 \times 26 = 312$.
|---|

<a id="NOTE-CH2-026"></a>
### NOTE-CH2-026 (Question 26)
Playfair Rule 1: Split duplicate letters in digram pairs with filler 'x'.

<a id="NOTE-CH2-027"></a>
### NOTE-CH2-027 (Question 27)
Playfair Column Rule: Replace each character with the element directly below it.

<a id="NOTE-CH2-028"></a>
### NOTE-CH2-028 (Question 28)
Hill Cipher Key Invertibility: Requires $\gcd(\det(K), 26) = 1$.

<a id="NOTE-CH2-029"></a>
### NOTE-CH2-029 (Question 29)
Vigenère Encryption: $C_i = (p_i + k_{i \bmod m}) \pmod{26}$.

<a id="NOTE-CH2-030"></a>
### NOTE-CH2-030 (Question 30)
Kasiski Test: Finds keyword length by analyzing distances between repeated ciphertext patterns.

<a id="NOTE-CH2-031"></a>
### NOTE-CH2-031 (Question 31)
One-Time Pad: Truly random key of message length, used once, providing perfect secrecy.

<a id="NOTE-CH2-032"></a>
### NOTE-CH2-032 (Question 32)
OTP Limitations: Enormous random key generation requirements and difficult key distribution.

<a id="NOTE-CH2-033"></a>
### NOTE-CH2-033 (Question 33)
Rail Fence Cipher: Write plaintext diagonally across $N$ depth rows, read row-by-row.

<a id="NOTE-CH2-034"></a>
### NOTE-CH2-034 (Question 34)
Transposition vs. Substitution: Transposition permutes character positions; substitution changes character values.

<a id="NOTE-CH2-035"></a>
### NOTE-CH2-035 (Question 35)
Hill Cipher Cryptanalysis: Solve for key matrix using $K = P^{-1} \cdot C \pmod{26}$.

<a id="NOTE-CH2-036"></a>
### NOTE-CH2-036 (Question 36)
Steganography: Hiding message presence within secondary digital media.

<a id="NOTE-CH2-037"></a>
### NOTE-CH2-037 (Question 37)
Known-Plaintext Attack: Attacker possesses matching pairs of plaintexts and ciphertexts.

<a id="NOTE-CH2-038"></a>
### NOTE-CH2-038 (Question 38)
Monoalphabetic Weakness: Single-letter frequency patterns survive substitution intact.

<a id="NOTE-CH2-039"></a>
### NOTE-CH2-039 (Question 39)
Computationally Secure: Practical security defined by computational time/cost constraints.

<a id="NOTE-CH2-040"></a>
### NOTE-CH2-040 (Question 40)
Caesar Decryption: $p = (C - k) \pmod{26}$.
