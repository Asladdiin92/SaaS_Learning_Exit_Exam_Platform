# Basic Concepts in Number Theory, Finite Fields & Public-Key Cryptography (RSA, Diffie-Hellman)
**Course Code:** IT-SEC-401 (ITec4133) | **Learning Outcome:** `OUTCOME-ITSEC-CH4`

## Chapter Learning Focus & Cheat Sheet Notes

<a id="NOTE-CH4-061"></a>
### NOTE-CH4-061 (Question 61)
Consecutive Integers Coprimality: $\gcd(n, n+1) = 1$ because any common divisor must divide $(n+1)-n = 1$.

<a id="NOTE-CH4-062"></a>
### NOTE-CH4-062 (Question 62)
Euler's Totient $\phi(n)$: Count of positive integers $< n$ coprime to $n$.

<a id="NOTE-CH4-063"></a>
### NOTE-CH4-063 (Question 63)
Totient of Prime Product: $\phi(pq) = (p-1)(q-1)$.

<a id="NOTE-CH4-064"></a>
### NOTE-CH4-064 (Question 64)
Euler's Theorem: $a^{\phi(n)} \equiv 1 \pmod n$ when $\gcd(a, n) = 1$.

<a id="NOTE-CH4-065"></a>
### NOTE-CH4-065 (Question 65)
Asymmetric Confidentiality: Encrypt with recipient's Public Key; decrypt with recipient's Private Key.

<a id="NOTE-CH4-066"></a>
### NOTE-CH4-066 (Question 66)
Digital Signatures: Sign with sender's Private Key; verify with sender's Public Key.

<a id="NOTE-CH4-067"></a>
### NOTE-CH4-067 (Question 67)
RSA Private Key Calculation: $d = e^{-1} \pmod{\phi(n)}$ where $e \cdot d \equiv 1 \pmod{\phi(n)}$.

<a id="NOTE-CH4-068"></a>
### NOTE-CH4-068 (Question 68)
RSA Encryption: $C = M^e \pmod n$.

<a id="NOTE-CH4-069"></a>
### NOTE-CH4-069 (Question 69)
RSA Decryption: $M = C^d \pmod n$.

<a id="NOTE-CH4-070"></a>
### NOTE-CH4-070 (Question 70)
RSA Calculation: $C = M^e \pmod{pq}$.

<a id="NOTE-CH4-071"></a>
### NOTE-CH4-071 (Question 71)
RSA Cryptanalysis via Factoring: Factoring $n \rightarrow p, q \rightarrow \phi(n) \rightarrow d \rightarrow M = C^d \bmod n$.

<a id="NOTE-CH4-072"></a>
### NOTE-CH4-072 (Question 72)
Prime Generation Procedure: Pick random large odd integer $\rightarrow$ Run Miller-Rabin probabilistic primality test.

<a id="NOTE-CH4-073"></a>
### NOTE-CH4-073 (Question 73)
Diffie-Hellman Hard Problem: Computing Discrete Logarithms in finite fields.

<a id="NOTE-CH4-074"></a>
### NOTE-CH4-074 (Question 74)
Diffie-Hellman Public Key: $y_A = a^{x_A} \pmod q$.

<a id="NOTE-CH4-075"></a>
### NOTE-CH4-075 (Question 75)
Diffie-Hellman Shared Secret: $K = (y_B)^{x_A} \pmod q = (y_A)^{x_B} \pmod q$.

<a id="NOTE-CH4-076"></a>
### NOTE-CH4-076 (Question 76)
Diffie-Hellman Vulnerability: Susceptible to Man-in-the-Middle attacks unless authenticated with digital signatures/certificates.

<a id="NOTE-CH4-077"></a>
### NOTE-CH4-077 (Question 77)
Fermat vs. Euler: Fermat's Little Theorem ($a^{p-1} \equiv 1 \pmod p$) is a special case of Euler's Theorem ($a^{\phi(n)} \equiv 1 \pmod n$) for prime moduli.

<a id="NOTE-CH4-078"></a>
### NOTE-CH4-078 (Question 78)
Modular Reduction: Positive residue $r \in {0, \dots, n-1}$ such that $a = qn + r$.

<a id="NOTE-CH4-079"></a>
### NOTE-CH4-079 (Question 79)
Extended Euclidean Algorithm: Computes linear combination coefficients yielding modular inverse.

<a id="NOTE-CH4-080"></a>
### NOTE-CH4-080 (Question 80)
RSA Message Constraint: Plaintext numerical value $M$ must be smaller than system modulus $n$ ($M < n$).
