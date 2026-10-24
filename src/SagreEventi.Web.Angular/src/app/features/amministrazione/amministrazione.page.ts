import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AdminUtentiService, UtenteAdmin, messaggioErroreApi } from '../../core/admin-utenti.service';
import { AuthService } from '../../core/auth.service';

/** Gestione di utenti e ruoli (solo Admin). I ruoli sono fissi: qui si assegnano o revocano, non si creano. */
@Component({
  selector: 'app-amministrazione-page',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, MultiSelectModule, PasswordModule, TableModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <h1>Amministrazione</h1>
      <p class="pagina-intro larga">
        Utenti che possono accedere. <strong>Editor</strong> modifica e rivede gli eventi, <strong>Admin</strong> fa lo stesso e gestisce anche gli utenti.
        Non puoi cancellarti né toglierti il ruolo Admin.
      </p>

      @if (errore()) {
        <p-message severity="error" styleClass="mt">{{ errore() }}</p-message>
      }

      <div class="azioni">
        <p-button label="Nuovo utente" icon="pi pi-user-plus" (onClick)="apriNuovo()" />
        <p-button icon="pi pi-refresh" severity="secondary" [text]="true" ariaLabel="Ricarica" [disabled]="caricamento()" (onClick)="carica()" />
      </div>

      <p-table [value]="utenti()" dataKey="id" [loading]="caricamento()" [scrollable]="true" [tableStyle]="{ 'min-width': '36rem' }">
        <ng-template #header>
          <tr>
            <th>Email</th>
            <th>Ruoli</th>
            <th style="width: 8rem"></th>
          </tr>
        </ng-template>
        <ng-template #body let-u>
          <tr>
            <td>{{ u.email }} @if (eIo(u)) { <p-tag value="Tu" severity="info" [rounded]="true" /> }</td>
            <td>
              @for (r of u.ruoli; track r) {
                <p-tag [value]="r" [severity]="r === 'Admin' ? 'danger' : 'secondary'" [rounded]="true" />
              } @empty {
                <span class="nessuno">Nessun ruolo</span>
              }
            </td>
            <td class="azioni-riga">
              <p-button icon="pi pi-pencil" [text]="true" severity="secondary" [ariaLabel]="'Modifica ' + u.email" (onClick)="apriModifica(u)" />
              <p-button icon="pi pi-trash" [text]="true" severity="danger" [ariaLabel]="'Elimina ' + u.email" [disabled]="eIo(u)" (onClick)="chiediEliminazione(u)" />
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [header]="inModifica() ? 'Modifica utente' : 'Nuovo utente'" [modal]="true" [(visible)]="dialogoAperto" [style]="{ width: 'min(30rem, 94vw)' }" [draggable]="false">
      <div class="form">
        <div class="campo">
          <label for="u-email">Email</label>
          <input pInputText id="u-email" type="email" autocomplete="off" maxlength="256" [ngModel]="email()" (ngModelChange)="email.set($event)" />
        </div>
        <div class="campo">
          <label for="u-password">{{ inModifica() ? 'Nuova password (lascia vuoto per non cambiarla)' : 'Password' }}</label>
          <p-password inputId="u-password" [feedback]="false" [toggleMask]="true" autocomplete="new-password" [ngModel]="password()" (ngModelChange)="password.set($event ?? '')" />
        </div>
        <div class="campo">
          <label for="u-ruoli">Ruoli</label>
          <p-multiselect inputId="u-ruoli" [options]="ruoliDisponibili()" [ngModel]="ruoliScelti()" (ngModelChange)="ruoliScelti.set($event ?? [])" placeholder="Nessun ruolo" [showToggleAll]="false" appendTo="body" />
        </div>
        @if (erroreDialogo()) {
          <p-message severity="error" variant="simple" size="small">{{ erroreDialogo() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Annulla" severity="secondary" [text]="true" (onClick)="dialogoAperto.set(false)" />
        <p-button label="Salva" icon="pi pi-check" [loading]="occupato()" [disabled]="!email().trim() || (!inModifica() && !password())" (onClick)="salva()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .azioni { display: flex; gap: 0.5rem; margin: 1rem 0; }
    .azioni-riga { text-align: right; white-space: nowrap; }
    .nessuno { opacity: 0.6; }
    .form { display: grid; gap: 1rem; }
    .campo { display: grid; gap: 0.35rem; }
  `,
})
export class AmministrazionePage implements OnInit {
  private readonly servizio = inject(AdminUtentiService);
  private readonly auth = inject(AuthService);
  private readonly conferme = inject(ConfirmationService);
  private readonly messaggi = inject(MessageService);

  protected readonly utenti = signal<UtenteAdmin[]>([]);
  protected readonly ruoliDisponibili = signal<string[]>([]);
  protected readonly caricamento = signal(false);
  protected readonly errore = signal<string | null>(null);

  protected readonly dialogoAperto = signal(false);
  protected readonly occupato = signal(false);
  protected readonly erroreDialogo = signal<string | null>(null);
  protected readonly inModifica = signal<UtenteAdmin | null>(null);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly ruoliScelti = signal<string[]>([]);

  ngOnInit(): void {
    void this.carica();
  }

  protected eIo(u: UtenteAdmin): boolean {
    return u.email.toLowerCase() === (this.auth.email() ?? '').toLowerCase();
  }

  protected async carica(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set(null);
    try {
      const [utenti, ruoli] = await Promise.all([this.servizio.utenti(), this.servizio.ruoli()]);
      this.utenti.set(utenti);
      this.ruoliDisponibili.set(ruoli);
    } catch (err) {
      this.errore.set(messaggioErroreApi(err, 'Impossibile leggere gli utenti.'));
    } finally {
      this.caricamento.set(false);
    }
  }

  protected apriNuovo(): void {
    this.apri(null, '', []);
  }

  protected apriModifica(u: UtenteAdmin): void {
    this.apri(u, u.email, u.ruoli);
  }

  private apri(utente: UtenteAdmin | null, email: string, ruoli: string[]): void {
    this.inModifica.set(utente);
    this.email.set(email);
    this.password.set('');
    this.ruoliScelti.set([...ruoli]);
    this.erroreDialogo.set(null);
    this.dialogoAperto.set(true);
  }

  protected async salva(): Promise<void> {
    const dati = { email: this.email().trim(), password: this.password(), ruoli: this.ruoliScelti() };
    const esistente = this.inModifica();
    this.occupato.set(true);
    this.erroreDialogo.set(null);
    try {
      if (esistente) {
        await this.servizio.modifica(esistente.id, dati);
        // Se ho modificato me stesso (email) riallineo la sessione
        if (this.eIo(esistente)) await this.auth.aggiornaUtente();
      } else {
        await this.servizio.crea(dati);
      }
      this.dialogoAperto.set(false);
      this.messaggi.add({ severity: 'success', summary: esistente ? 'Utente aggiornato' : 'Utente creato', life: 4000 });
      await this.carica();
    } catch (err) {
      this.erroreDialogo.set(messaggioErroreApi(err, 'Salvataggio non riuscito.'));
    } finally {
      this.occupato.set(false);
    }
  }

  protected chiediEliminazione(u: UtenteAdmin): void {
    this.conferme.confirm({
      header: 'Eliminare l\'utente?',
      message: `«${u.email}» non potrà più accedere. L'operazione non si può annullare.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => void this.elimina(u),
    });
  }

  private async elimina(u: UtenteAdmin): Promise<void> {
    try {
      await this.servizio.elimina(u.id);
      this.messaggi.add({ severity: 'success', summary: 'Utente eliminato', life: 4000 });
      await this.carica();
    } catch (err) {
      this.messaggi.add({ severity: 'error', summary: 'Eliminazione non riuscita', detail: messaggioErroreApi(err, 'Riprova tra poco.'), life: 7000 });
    }
  }
}
