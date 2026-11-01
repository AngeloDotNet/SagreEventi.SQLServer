/// <reference lib="webworker" />
import { AltchaChallenge, risolviChallenge } from './altcha-solver';

// Solves the proof of work off the main thread, so the UI stays responsive on slow phones.
addEventListener('message', ({ data }: MessageEvent<AltchaChallenge>) => {
  risolviChallenge(data).then(
    (payload) => postMessage({ payload }),
    (err: unknown) => postMessage({ error: err instanceof Error ? err.message : 'Errore anti-bot.' }),
  );
});
