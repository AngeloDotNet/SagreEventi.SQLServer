import { AltchaChallenge, risolviChallenge } from './altcha-solver';

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

/** Builds a challenge whose secret number is `numero`, as the server would. */
async function challengeCon(numero: number, parziale: Partial<AltchaChallenge> = {}): Promise<AltchaChallenge> {
  const salt = '0123456789abcdef01234567?expires=4102444800&';
  const hash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + numero)));
  return { algorithm: 'SHA-256', challenge: hash, salt, signature: 'firma', maxnumber: 50, ...parziale };
}

describe('risolviChallenge', () => {
  it('finds the secret number and returns the base64 JSON payload', async () => {
    const challenge = await challengeCon(37);

    const payload = await risolviChallenge(challenge);

    expect(JSON.parse(atob(payload))).toEqual({
      algorithm: 'SHA-256',
      challenge: challenge.challenge,
      number: 37,
      salt: challenge.salt,
      signature: 'firma',
    });
  });

  it('solves a challenge whose number is zero or exactly maxnumber', async () => {
    expect(JSON.parse(atob(await risolviChallenge(await challengeCon(0)))).number).toBe(0);
    expect(JSON.parse(atob(await risolviChallenge(await challengeCon(50)))).number).toBe(50);
  });

  it('rejects when the number is outside the declared range', async () => {
    await expect(risolviChallenge(await challengeCon(51))).rejects.toThrow('senza soluzione');
  });

  it('rejects an algorithm other than SHA-256', async () => {
    await expect(risolviChallenge(await challengeCon(1, { algorithm: 'SHA-1' }))).rejects.toThrow('non supportato');
  });
});
