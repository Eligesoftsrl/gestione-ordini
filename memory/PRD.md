# Bancó - Sistema Gestione Ordini Ristorante

## Problema Originale
Sistema completo di gestione ordini per ristorante/catering chiamato "Bancó", progettato per tablet e mobile.

## Entità Core
- **Ordini**: Gestione completa con stati automatici
- **Piatti**: CRUD con categorie e preferiti
- **Clienti**: Persona fisica e Società (con Partita IVA obbligatoria)
- **Menu giornaliero**: Selezione piatti e porzioni

## Funzionalità Implementate

### Gestione Piatti
- [x] CRUD piatti con categorie
- [x] Status "preferito" (cuore)
- [x] Piatti preferiti aggiunti automaticamente al menu

### Gestione Menu
- [x] Creazione "Menu del Giorno"
- [x] Selezione piatti e porzioni
- [x] **Filtro per categoria** (chip filtro: Tutte, Primi, Secondi, etc.)
- [x] Tracciamento "Mancate Vendite"

### Gestione Clienti
- [x] Differenziazione Persona Fisica / Società
- [x] Partita IVA obbligatoria per società
- [x] Ricerca per nome e ragione sociale

### Gestione Ordini
- [x] Creazione ordini con cliente
- [x] Aggiunta piatti dal menu (limite porzioni disponibili)
- [x] 5 Stati ordine: ATTESA, PREPARAZIONE, PRONTO, SOSPESO, **CHIUSO**
- [x] **Cambio stato automatico** basato su stati piatti singoli (escluso CHIUSO)
- [x] **Stato CHIUSO**: solo manuale, escluso da lista "Tutti"
- [x] Stati piatto: pending, ready (✓), problem (⚠)
- [x] **Flag pagamento** (isPaid) con toggle Da pagare/Pagato
- [x] Avviso clienti con ordini non pagati
- [x] **Allegato scontrino** (foto con fotocamera)
- [x] **Preview e eliminazione scontrino**
- [x] Stampa PDF ordine

### UI/UX Home Screen
- [x] Titolo app "Bancó"
- [x] Contatori filtranti per stato ordine
- [x] Icona ordini non pagati

### Report
- [x] Visualizzazione giornaliera o range date
- [x] Totale ordini, incasso, mancate vendite

### PWA (Progressive Web App) ✅ NEW
- [x] Configurazione PWA completa
- [x] Icona app personalizzata (B stilizzata coral/navy)
- [x] Manifest.json per Android/Chrome
- [x] Meta tag per iOS (apple-mobile-web-app-capable)
- [x] Fullscreen standalone mode
- [x] Theme color #e94560 (coral)
- [x] Background #1a1a2e (navy)

## Stack Tecnologico
- **Frontend**: Expo (React Native), TypeScript, Expo Router
- **Backend**: Python, FastAPI, Pydantic
- **Database**: MongoDB
- **Deployment**: PWA (installabile su tablet/mobile via browser)

## File Principali
- `frontend/app/(tabs)/index.tsx` - Schermata Ordini
- `frontend/app/(tabs)/menu.tsx` - Menu del Giorno con filtro categorie
- `frontend/app/(tabs)/dishes.tsx` - Gestione Piatti
- `frontend/app/(tabs)/customers.tsx` - Gestione Clienti
- `frontend/app/(tabs)/reports.tsx` - Report
- `frontend/app/+html.tsx` - Template HTML con meta PWA
- `frontend/public/manifest.json` - Manifest PWA
- `backend/server.py` - API FastAPI

## Come Installare su Tablet/Mobile

### iPad/iPhone (iOS)
1. Apri Safari e vai all'URL dell'app
2. Tocca l'icona "Condividi" (quadrato con freccia)
3. Seleziona "Aggiungi alla schermata Home"
4. L'app apparirà con l'icona Bancó

### Android
1. Apri Chrome e vai all'URL dell'app
2. Tocca i tre puntini in alto a destra
3. Seleziona "Aggiungi a schermata Home" o "Installa app"
4. L'app apparirà nel drawer delle app

## Ultima Sessione (17/03/2026)

### Completato
1. **OP04 + OP09**: Ordini non pagati - click per vedere dettaglio + pulsante "Paga" separato
2. **OP05**: Stato "Chiuso" → "Consegnato" ✅
3. **OP06**: Dashboard porzioni (pulsante compatto icona posate)
4. **OP07**: Ricerca testuale nell'anagrafica piatti
5. **OP03**: Fix refresh lista menu
6. **OP10**: Stampa PDF Menu del Giorno ✅
   - Pulsante "Condividi" nella sezione menu
   - PDF elegante con gradiente scuro e font elegante
   - Piatti raggruppati per categoria
   - Condivisibile via WhatsApp su mobile
7. **UI Compatta**: Pulsanti "Nuovo Ordine" e "Porzioni" solo icone per mobile

### Da Verificare con Dati Reali
- **OP01**: Ordinamento piatti per categoria
- **OP02**: Piatti disattivati esclusi da selezione menu
- **OP08**: Storico ordini cliente

## Backlog / Task Futuri

### P1 - Refactoring
- [ ] Estrarre modal ordine in componente separato (`OrderModal.tsx`)
- [ ] Estrarre modal selezione cliente
- [ ] Migliorare gestione stato con Context/Zustand
- [ ] Risolvere warning deprecation React Native (shadow*, pointerEvents)

### P2 - Miglioramenti UX
- [ ] Animazioni transizioni pagine
- [ ] Feedback visivo più ricco
- [ ] Ottimizzazione performance lista ordini

## Deploy
Per deployare l'app in produzione:
1. Usa il pulsante **"Deploy"** nella sidebar di Emergent
2. L'app sarà disponibile su un URL pubblico
3. Configura un dominio custom se necessario (es: banco.tuaazienda.com)
