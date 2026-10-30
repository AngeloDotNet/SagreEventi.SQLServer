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
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
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
