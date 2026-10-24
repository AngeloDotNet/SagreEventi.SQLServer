import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth.service';
import { EventiStore } from '../../core/eventi-store.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina pagina-stretta">
      <h1>Accedi</h1>
      <p class="pagina-intro">L'accesso serve a modificare o concludere gli eventi esistenti. Per segnalarne uno nuovo non serve.</p>

      <form class="form" [formGroup]="form" (ngSubmit)="accedi()" novalidate>
        <div class="campo">
          <label for="email">Email</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="username" />
        </div>
        <div class="campo">
          <label for="password">Password</label>
          <p-password inputId="password" formControlName="password" [feedback]="false" [toggleMask]="true" autocomplete="current-password" />
        </div>

        @if (errore(); as m) {
          <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
        }

        <div>
          <p-button type="submit" label="Accedi" icon="pi pi-sign-in" [loading]="inCorso()" [disabled]="form.invalid" />
        </div>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly store = inject(EventiStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly inCorso = signal(false);
  protected readonly errore = signal<string | null>(null);

  protected async accedi(): Promise<void> {
    if (this.form.invalid || this.inCorso()) return;
    this.inCorso.set(true);
    this.errore.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email.trim(), password);
      // Con il nuovo ruolo le modifiche in attesa possono partire.
      if (this.store.online()) void this.store.sincronizza();
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.errore.set(descriviErrore(err));
    } finally {
      this.inCorso.set(false);
    }
  }
}

function descriviErrore(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return "Il server non risponde. Controlla la connessione e l'indirizzo dell'API.";
    if (err.status === 401) return 'Email o password non corrette.';
    if (err.status === 429) return 'Troppi tentativi. Riprova tra un minuto.';
  }
  return 'Accesso non riuscito. Riprova.';
}
