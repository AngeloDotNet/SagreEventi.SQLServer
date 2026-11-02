# PLAN — CI e supply chain (a fasi)

## Obiettivo
Avvicinare la CI a `core.md` §5 («CI/CD»): build, test, lint, scansione vulnerabilità e formattazione a ogni PR; SAST (CodeQL), secret scanning (gitleaks), scansione delle immagini (Trivy) e SBOM a ogni release; aggiornamenti automatici (Dependabot). Oggi c'è solo `.github/workflows/build-push.yml` (build e push delle immagini, con i test del frontend).

## Assunzioni
- Decisione dell'utente: piano a fasi; dopo ogni fase ci si può fermare e ciò che resta diventa una deroga annotata in `CLAUDE.md`.
- Il repository è **pubblico** (confermato dall'utente il 2026-11-01): CodeQL è gratuito (verificare comunque i termini attuali al primo uso, `core.md` §3).
- Claude scrive e committa (su conferma) i file di pipeline; **esecuzione, push, gestione dei segreti della CI e merge restano all'utente** (`core.md` §5, `git.md`).
- Ogni action usa una versione fissata (tag di versione, non `@main`); le versioni si leggono dai repository ufficiali al momento dell'uso, non dalla memoria. Dependabot aggiornerà anche le action.
- Commit di Dependabot con prefisso `build(deps)` per la produzione e `chore(deps-dev)` per lo sviluppo (`git.md`).
- Git flow: le PR verso `develop` fanno il controllo dei commit; il branch di lavoro si concorda prima di iniziare (`feature/ci-...`).
- Il workflow `build-push.yml` ha già modifiche in sospeso (commit 20 e 39 di `piano-commit.md`): coordinare l'ordine per non creare conflitti.

## Fasi e passi
**Fase 1 — aggiornamenti e verifica su PR**
- [ ] 1. `.github/dependabot.yml`: ecosistemi `npm` (`src/SagreEventi.Web`), `nuget` (`/`), `docker` (i due Dockerfile) e `github-actions`; cadenza settimanale, limite di PR aperte, prefissi di commit come sopra; versioni maggiori di Angular/PrimeNG/TypeScript raggruppate o escluse (aggiornamenti di versione maggiore sono compiti a sé, `frontend.md` §2).
- [ ] 2. Workflow di verifica su PR verso `develop` e `main`: restore e build del backend con `TreatWarningsAsErrors`, test backend, `dotnet list package --vulnerable --include-transitive`, `npm ci`, lint, `format:check` (se non ancora imposto, solo come informazione), test del frontend e `npm audit` (soglia da concordare: oggi 16-33 vulnerabilità moderate solo in sviluppo), lint dei messaggi di commit Conventional Commits (solo PR verso `develop`, come da `git.md`).
- [ ] 3. Controllo licenze in CI (comandi già in `CLAUDE.md`): da decidere se lo si automatizza ora o resta a mano prima delle release (era «eventuale sviluppo futuro»).

**Fase 2 — SAST e secret scanning**
- [ ] 4. CodeQL per C# e JavaScript/TypeScript (workflow `codeql.yml`, su PR e settimanale); verifica preliminare dei termini d'uso gratuiti per repository pubblici.
- [ ] 5. gitleaks (workflow su PR e push; configurazione con eventuali falsi positivi noti, come i segnaposto di `appsettings.json` e `.env.example`). Controllo anche della cronologia già pubblicata, con segnalazione senza riscrivere nulla.

**Fase 3 — immagini e rilascio**
- [ ] 6. Trivy sulle due immagini buildate in `build-push.yml` (o in un workflow a parte): soglia di gravità e cosa fa fallire la pipeline da concordare; dipende da `PLAN-tag-docker.md` (tag fissi), da fare prima.
- [ ] 7. SBOM a ogni release (formato e strumento da verificare per licenza: es. Syft Apache-2.0 o `anchore/sbom-action`, da controllare al primo uso), allegato alla release a cura dell'utente (tag e rilasci sono suoi).
- [ ] 8. Documentazione: `README.md` (sezione CI), `CLAUDE.md` (eventuali deroghe per ciò che non si fa), `CHANGELOG.md`.

## File coinvolti
`.github/dependabot.yml`, `.github/workflows/` (nuovi: verifica su PR, `codeql.yml`, gitleaks, SBOM; modifica di `build-push.yml` per Trivy), `README.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Test previsti
Nessun test applicativo: i workflow non si eseguono in locale e le pipeline le lancia l'utente. Verifica sintattica dei file YAML e, dopo il push, controllo dei risultati della prima esecuzione, a cura dell'utente.

## Decisioni aperte
- Soglie di fallimento (audit npm, Trivy) e se il controllo licenze entra in CI (passo 3).
- Quali ecosistemi e versioni maggiori Dependabot deve ignorare.
- Ordine rispetto a `PLAN-tag-docker.md` e ai commit 20 e 39 di `piano-commit.md`, che toccano `build-push.yml`.
