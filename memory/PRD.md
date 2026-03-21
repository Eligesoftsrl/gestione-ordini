# Bancó - Sistema di Gestione Ordini per Ristorante/Catering

## Descrizione Progetto
Sistema completo di gestione ordini per ristorante/catering, ottimizzato per tablet e mobile.

## Entità Core
- **Ordini**: gestione completa con stati, pagamenti, scontrini
- **Piatti**: CRUD, categorie, stato preferito, attivo/disattivo
- **Clienti**: Persona Fisica e Società
- **Menu del Giorno**: porzioni disponibili, generazione PDF

## Stack Tecnologico
- **Frontend**: Expo (React Native), TypeScript, Expo Router
- **Backend**: Python, FastAPI
- **Database**: MongoDB
- **Deployment**: Expo Go via Emergent Platform

---

## Funzionalità Implementate

### Marzo 2026 - Nuove Funzionalità Ordini
- ✅ **Modifica Prezzo nell'Ordine**: campo prezzo modificabile quando si aggiunge un piatto
- ✅ **Piatto Libero**: pulsante viola per inserire piatti personalizzati non in menu
- ✅ **Ordini Pagati di Default**: `isPaid: true` automaticamente, cliente segna se non pagato
- ✅ **Toggle Pagamento**: icona cliccabile nella card ordine per cambiare stato pagato/non pagato
- ✅ **Layout Mobile Migliorato**: footer su due righe per aggiunta piatto

### Marzo 2026 - Area Admin Setup Protetta da Password
- ✅ **Icona Setup (⚙️)** nell'angolo in alto a destra della schermata Report
- ✅ **Modale Password**: inserire `eligesoft` per accedere alle impostazioni admin
- ✅ **Setup Database Completo**: allinea schema tra preview e produzione
- ✅ **SCHEMA_REFERENCE**: definizione schema ideale nel backend

### Marzo 2026 - Fix Database Deploy
- ✅ **`load_dotenv(override=False)`**: non sovrascrive più le variabili di produzione
- ✅ **DB_NAME automatico**: preview usa `catering-dashboard-3`, produzione usa variabile Emergent

---

## Architettura File

```
/app
├── backend/
│   └── server.py                    # FastAPI + SCHEMA_REFERENCE
├── frontend/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx            # Home ordini (~2900 righe)
│   │   │   ├── menu.tsx
│   │   │   ├── dishes.tsx
│   │   │   ├── customers.tsx
│   │   │   └── reports.tsx          # Report + Setup Admin (⚙️)
│   │   ├── unpaid-orders.tsx
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── components/
│   │   │   └── orders/              # NUOVO: componenti estratti
│   │   │       ├── OrderCard.tsx
│   │   │       ├── NewOrderModal.tsx
│   │   │       ├── CustomItemModal.tsx
│   │   │       └── index.ts
│   │   ├── services/api.ts
│   │   └── types/index.ts
```

---

## Issue Pendenti

### P2 - Media Priorità
- **Paga Tutto**: pulsante per saldare tutti i debiti di un cliente
- **Refactoring index.tsx**: ancora ~2900 righe, componenti estratti ma non integrati

### P3 - Bassa Priorità
- Ordinare piatti nel menu per categoria
- Escludere piatti disattivati dalla creazione menu
- Fix TypeScript `isFavorite` in dishes.tsx

---

## API Endpoints Chiave
- `POST /api/orders/{id}/items` - Aggiunge piatto (supporta `customPrice` e piatti liberi)
- `PUT /api/orders/{id}/payment` - Toggle stato pagamento
- `POST /api/setup` - Allinea database allo SCHEMA_REFERENCE
- `GET /api/setup/status` - Verifica stato database
