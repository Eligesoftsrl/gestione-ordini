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

### Marzo 2026 - Fix Critico UX Ordini Non Pagati
- ✅ **RISOLTO BUG P0**: Creata pagina separata `/unpaid-orders.tsx` per la lista ordini non pagati
- ✅ Navigazione corretta: chiudendo dettaglio ordine si torna alla lista (non alla home)
- ✅ Rimossa logica complessa di modal sovrapposti da `index.tsx`
- ✅ Aggiunti stati `consegnato`, `annullato`, `completato` al tipo Order
- ✅ Cleanup codice: rimosso codice morto e variabili inutilizzate

### Sessione Precedente
- ✅ PDF Menu "GIORGIO IV" con design elegante
- ✅ Pulsanti compatti per mobile (Porzioni e Nuovo Ordine)
- ✅ Stato ordine "CONSEGNATO" (rinominato da "Chiuso")
- ✅ Ricerca piatti testuale
- ✅ Allegare foto scontrino agli ordini
- ✅ Dashboard porzioni rimanenti
- ✅ Configurazione PWA
- ✅ Filtri categoria nel menu

---

## Bug/Issue Risolti

### P0 - Critico (RISOLTO)
- ✅ **Flusso ordini non pagati**: ora funziona correttamente
  - Lista ordini non pagati su pagina dedicata
  - Dettagli ordine apribile e chiudibile senza perdere il contesto
  - Pulsante "Paga" funzionante dalla lista

---

## Issue Pendenti

### ✅ TUTTI I BUG RISOLTI!
Nessun bug pendente dalla lista originale (OP01-OP10)

### P2 - Media Priorità  
- **OP03**: Menu non si aggiorna dopo aggiunta secondo piatto
  - File: `frontend/app/(tabs)/menu.tsx`

### P3 - Bassa Priorità
- **OP01**: Ordinare piatti nel menu per categoria
- **OP02**: Escludere piatti disattivati dalla creazione menu

---

## Architettura File

```
/app
├── backend/
│   └── server.py            # FastAPI monolith
├── frontend/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx    # Home ordini (pulito)
│   │   │   ├── menu.tsx     # Menu del giorno
│   │   │   ├── dishes.tsx   # Gestione piatti
│   │   │   ├── customers.tsx # Gestione clienti
│   │   │   └── reports.tsx  # Report
│   │   ├── unpaid-orders.tsx # NUOVO: Pagina ordini non pagati
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── services/api.ts
│   │   └── types/index.ts
```

---

## Stati Ordine
- `in_attesa` - Ordine ricevuto
- `in_preparazione` - In cucina
- `pronto` - Pronto per consegna
- `sospeso` - In attesa (problema)
- `consegnato` - Consegnato al cliente (manuale)
- `annullato` - Ordine annullato
- `completato` - Ordine completato

---

## API Endpoints Chiave
- `GET /api/customers/{id}/unpaid-orders` - Ordini non pagati
- `POST /api/orders/{id}/payment` - Aggiorna stato pagamento
- `GET /api/menus/date/{date}` - Menu del giorno

---

## Note per Sviluppo Futuro
- Il file `index.tsx` è ancora grande (~2500 righe) - potrebbe beneficiare di ulteriore refactoring
- L'errore TypeScript in `dishes.tsx` (isFavorite) è da sistemare
- Considerare l'estrazione di componenti riutilizzabili (OrderCard, StatusBadge, etc.)
