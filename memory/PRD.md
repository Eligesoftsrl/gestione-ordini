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

### 11 Maggio 2026 - Ricerca libera per nome nei Piatti Disponibili
- ✅ Aggiunta barra di ricerca testuale sotto "Piatti Disponibili" nel tab Menu
- ✅ Filtra per `name` e `description`, combinandosi con il filtro categoria già presente
- ✅ Non influenza la sezione "Piatti nel Menu" (come richiesto)
- ✅ Messaggio dinamico nel vuoto: "Nessun piatto trovato" vs "Tutti i piatti sono già nel menu"

### 11 Maggio 2026 - Filtro categoria su Piatti Disponibili + Fix serviceType
- ✅ **Filtro categoria condiviso** nel tab Menu: ora applica anche a "Piatti Disponibili" (oltre che a "Piatti nel Menu")
- ✅ **Stato `allDishes` locale** in `menu.tsx`: tab Menu non più affetto dal filtro del tab Piatti (Zustand store condiviso)
- ✅ **useFocusEffect**: ricarica i dati ogni volta che il tab Menu riceve il focus
- ✅ **Fix bug serviceType backend**: `POST /api/orders` ora salva correttamente `serviceType` (era ignorato)

### 11 Maggio 2026 - Ricerca ordini, items su card e supporto virgola decimali
- ✅ **Barra di ricerca ordini** in home: filtra dinamicamente per nome cliente (testID: `orders-search-input`)
- ✅ **Lista piatti su card ordine**: ogni ordine in home ora mostra elenco `• Qx NomePiatto` (SENZA prezzo)
- ✅ **Supporto virgola decimali**: `parseFloat(value.replace(',', '.'))` applicato a tutti i prezzi
  - `index.tsx`: customItemPrice, itemCustomPrice
  - `dishes.tsx`: basePrice
  - `menu.tsx`: dailyPrice (add + edit)
- ✅ Risolto duplicato `filteredOrders` in `index.tsx` (merged status filter + search filter in `useMemo`)

### 23 Marzo 2026 - Fix Modali iPad
- ✅ **Fix touch su iPad/Safari**: Migrati pulsanti critici da `TouchableOpacity` a `Pressable`
  - Selettore cliente nella modale Nuovo Ordine
  - Pulsante "Piatto Libero"
  - Tutti i pulsanti dentro le modali Customer Picker e Custom Item
  - Aggiunto `cursor: 'pointer'` per web
  - Aggiunto `stopPropagation()` per evitare chiusura accidentale

### 21 Marzo 2026 - Fix Bug Piatti Liberi & PDF
- ✅ **P0 FIX**: Azioni su Piatti Liberi ora funzionano (elimina, pronto, problema)
  - Nuovi endpoint backend: `DELETE /api/orders/{id}/items/by-index/{idx}` e `PUT /api/orders/{id}/items/by-index/{idx}/status`
  - Nuove funzioni frontend: `removeItemByIndex()` e `updateItemStatusByIndex()`
- ✅ **P1 FIX**: PDF Menu non taglia più i menu lunghi
  - Aggiunte regole CSS `@media print` e `@page` per supporto multi-pagina
  - Font ridotti per ottimizzare spazio su A4

### 21 Marzo 2026 - Miglioramenti Backlog
- ✅ **Ordinamento piatti per categoria**: I "Piatti Disponibili" nel tab Menu sono ora ordinati e raggruppati per categoria (Primi → Secondi → Contorni ecc.)
- ✅ **Esclusione piatti disattivati**: Il backend già esclude automaticamente i piatti con `active=false` dalla lista

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
│   └── server.py                    # FastAPI + SCHEMA_REFERENCE + endpoint by-index
├── frontend/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx            # Home ordini (~2900 righe)
│   │   │   ├── menu.tsx             # PDF con @media print
│   │   │   ├── dishes.tsx
│   │   │   ├── customers.tsx
│   │   │   └── reports.tsx          # Report + Setup Admin (⚙️)
│   │   ├── unpaid-orders.tsx
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── components/
│   │   │   └── orders/              # Componenti estratti
│   │   │       ├── OrderCard.tsx
│   │   │       ├── NewOrderModal.tsx
│   │   │       ├── CustomItemModal.tsx
│   │   │       └── index.ts
│   │   ├── services/api.ts          # API con funzioni by-index
│   │   └── types/index.ts
```

---

## Issue Pendenti

### P2 - Media Priorità
- **Paga Tutto**: pulsante per saldare tutti i debiti di un cliente
- **Refactoring index.tsx**: ancora ~2900 righe, componenti estratti ma non integrati

### P3 - Bassa Priorità
- Fix TypeScript `isFavorite` in dishes.tsx

---

## API Endpoints Chiave
- `POST /api/orders/{id}/items` - Aggiunge piatto (supporta `customPrice` e piatti liberi)
- `DELETE /api/orders/{id}/items/by-index/{idx}` - Rimuove piatto per indice (per Piatti Liberi)
- `PUT /api/orders/{id}/items/by-index/{idx}/status` - Cambia stato piatto per indice
- `PUT /api/orders/{id}/payment` - Toggle stato pagamento
- `POST /api/setup` - Allinea database allo SCHEMA_REFERENCE
- `GET /api/setup/status` - Verifica stato database
