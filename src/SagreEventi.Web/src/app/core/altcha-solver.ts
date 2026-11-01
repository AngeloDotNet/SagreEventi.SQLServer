/** Challenge returned by `GET api/Eventi/GetChallenge` (ALTCHA v1 protocol). */
export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
}

const ENCODER = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Finds the secret number whose SHA-256(salt + number) equals the challenge and returns the payload
 * for the `X-Altcha` header (base64 JSON, as the ALTCHA widget produces it).
 * Rejects when no number in 0..maxnumber matches or the algorithm is not SHA-256.
 */
export async function risolviChallenge(c: AltchaChallenge): Promise<string> {
  if (c.algorithm !== 'SHA-256') throw new Error('Algoritmo anti-bot non supportato.');

  for (let numero = 0; numero <= c.maxnumber; numero++) {
    const hash = toHex(await crypto.subtle.digest('SHA-256', ENCODER.encode(c.salt + numero)));
    if (hash === c.challenge) {
      const json = JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: numero, salt: c.salt, signature: c.signature });
      return btoa(String.fromCharCode(...ENCODER.encode(json)));
    }
  }
  throw new Error('Challenge anti-bot senza soluzione.');
}
