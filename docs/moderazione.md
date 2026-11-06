# Moderazione

[← Torna al README](../README.md)

Gli eventi hanno tre stati: `InAttesa` (predefinito per le segnalazioni anonime), `Approvato` e `Rifiutato`. Nel database `Eventi.Stato` è un intero (0, 1, 2) collegato con chiave esterna alla tabella `StatiModerazione` (`Id`, `Nome`), che ne documenta il significato e impedisce valori non validi; la fonte di verità resta l'enum `StatoModerazione`, quindi un nuovo valore richiede anche una migrazione che aggiunga la riga. `GetEventi` restituisce solo gli eventi approvati e il server non si fida mai di uno stato inviato da un client. Un evento rifiutato viene conservato con una nota facoltativa, visibile solo ad `Admin` ed `Editor`: a chi l'ha segnalato non viene detto nulla e lo vede ancora come in attesa. Ritirare un evento approvato lo trasforma in un evento rifiutato e concluso, che i client usano per eliminare la copia locale alla sincronizzazione successiva.

## Avviso via email ai moderatori

Un job periodico (`ModerazioneHostedService`) manda un riepilogo agli utenti **Admin ed Editor** quando ci sono segnalazioni in attesa che nessun avviso ha ancora incluso. Una mail di testo per destinatario (gli indirizzi sono quelli degli utenti di Identity), con **solo i numeri** («3 nuove segnalazioni da moderare, 12 in attesa in totale») e il link alla pagina di revisione: il testo delle segnalazioni, che non è affidabile, non entra mai nella mail. Il link è costruito da `App:PublicBaseUrl`, mai dall'header `Host`. Una segnalazione viene marcata come notificata (colonna `Eventi.NotificataIl`) solo dopo che almeno una mail è stata consegnata: se l'invio fallisce, si riprova al giro successivo. Al primo avvio dopo l'aggiornamento vengono notificate tutte le segnalazioni già in attesa. L'invio usa MailKit (MIT) con la validazione del certificato TLS sempre attiva; l'API non parte fuori da Development senza un SMTP e un indirizzo pubblico reali. Un solo processo per volta: con più repliche ogni replica manderebbe la propria mail.

Le impostazioni (`Smtp:*`, `Moderazione:AvvisoIntervalloMinuti`, `App:PublicBaseUrl`) sono in [Configurazione](configurazione.md).
