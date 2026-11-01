import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AltchaChallenge, risolviChallenge } from './altcha-solver';
import { EventiApiService } from './eventi-api.service';

/** Obtains the anti-bot proof of work the server requires on `UpdateEventi` (one proof per request, never reusable). */
@Injectable({ providedIn: 'root' })
export class AltchaService {
  private readonly api = inject(EventiApiService);

  /** Asks the server for a challenge, solves it and returns the value for the `X-Altcha` header. */
  async ottieniProva(): Promise<string> {
    const challenge = await firstValueFrom(this.api.getChallenge());
    return this.risolvi(challenge);
  }

  private risolvi(challenge: AltchaChallenge): Promise<string> {
    if (typeof Worker === 'undefined') return risolviChallenge(challenge);

    return new Promise<string>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./altcha.worker', import.meta.url), { type: 'module' });
      } catch {
        // Worker blocked or unsupported: solve on the main thread.
        risolviChallenge(challenge).then(resolve, reject);
        return;
      }
      worker.onmessage = ({ data }: MessageEvent<{ payload?: string; error?: string }>) => {
        worker.terminate();
        if (data.payload) resolve(data.payload);
        else reject(new Error(data.error ?? 'Errore anti-bot.'));
      };
      worker.onerror = () => {
        worker.terminate();
        risolviChallenge(challenge).then(resolve, reject);
      };
      worker.postMessage(challenge);
    });
  }
}
