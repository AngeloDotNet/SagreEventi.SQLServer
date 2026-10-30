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
  selector: 'app-amministrazione',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, MultiSelectModule, PasswordModule, TableModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './amministrazione.component.html',
  styleUrl: './amministrazione.component.css',
})
export class AmministrazioneComponent implements OnInit {
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
