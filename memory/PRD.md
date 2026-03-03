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
- [x] 4 Stati ordine: ATTESA, PREPARAZIONE, PRONTO, SOSPESO
- [x] **Cambio stato automatico** basato su stati piatti singoli
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

## Stack Tecnologico
- **Frontend**: Expo (React Native), TypeScript, Expo Router
- **Backend**: Python, FastAPI, Pydantic
- **Database**: MongoDB

## File Principali
- `frontend/app/(tabs)/index.tsx` - Schermata Ordini (molto grande, da refactorare)
- `frontend/app/(tabs)/menu.tsx` - Menu del Giorno con filtro categorie
- `frontend/app/(tabs)/dishes.tsx` - Gestione Piatti
- `frontend/app/(tabs)/customers.tsx` - Gestione Clienti
- `frontend/app/(tabs)/reports.tsx` - Report
- `backend/server.py` - API FastAPI

## Ultima Sessione (03/03/2026)

### Completato
1. **Funzionalità Allega Scontrino**
   - Pulsante "Allega Scontrino" nel modal ordine
   - Cattura foto con `expo-image-picker`
   - Modal preview scontrino allegato
   - Eliminazione scontrino
   - Endpoint backend PUT/DELETE /api/orders/{id}/receipt

2. **Filtro Categoria nel Menu**
   - Chip filtro categorie (Tutte, Primi, Secondi, etc.)
   - Filtraggio piatti nel menu giornaliero
   - Badge categoria sui piatti

### Testing
- Backend: 100% ✅
- Frontend: 100% ✅

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

## API Endpoints
- `GET /api/categories` - Lista categorie
- `GET/POST /api/dishes` - CRUD piatti
- `GET/POST /api/menus` - CRUD menu
- `GET/POST /api/orders` - CRUD ordini
- `PUT /api/orders/{id}/receipt` - Upload scontrino
- `DELETE /api/orders/{id}/receipt` - Elimina scontrino
- `PUT /api/orders/{id}/payment` - Toggle pagamento
- `PUT /api/orders/{id}/items/{dishId}/status` - Stato piatto
- `GET /api/customers/{id}/unpaid-orders` - Ordini non pagati cliente
