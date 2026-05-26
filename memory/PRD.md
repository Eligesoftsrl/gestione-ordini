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

### 26 Maggio 2026 - Palette McDonald's (Monza red + Selective Yellow)
- Sostituiti tutti gli accenti rosso/arancione con i colori brand McDonald's:
  - Rosso primary `#e94560` → **`#DB0007`** (Monza red)
  - Rosso danger `#e74c3c` → **`#DB0007`** (uniformato)
  - Arancio `#f39c12` → **`#FFBC0D`** (Selective Yellow)
  - Arancio scuro `#e67e22` → **`#FFBC0D`**
- Applicato in modo bulk su tutti i `.tsx/.ts` (157 occorrenze totali sostituite)
- Resultato: data header, X chiusura modali, bottoni primary in rosso McDonald's; badge "Attesa", "Ora consegna", box note in giallo McDonald's

### 26 Maggio 2026 - Fix icone bianche su sfondo chiaro
- Le icone Ionicons con `color="#fff"` come prop (non come style) erano ancora bianche su sfondo bianco dopo il theme switch (es. frecce navigazione date, X chiusura modali in alcuni contesti)
- Creato script Python intelligente (`fix_icons.py`) che converte le icone bianche → scure SOLO quando il TouchableOpacity/View padre NON ha un background accent (rosso/verde/arancione/blu)
- 46 icone convertite in totale: frecce data ‹›, chevron compatti, icone di chiusura/cancellazione, ecc.
- Preservato il bianco sui pulsanti accent (es. X di chiusura sul cerchio rosso del modal header)

### 26 Maggio 2026 - Polish tema chiaro: search bar inset + reset edit mode
- **Search bar ordini home**: sfondo bianco con shadow leggero, margine 16px dai bordi (prima toccava i bordi visivamente), bordo arrotondato 12px coerente con le card
- **Reset edit mode su cambio ordine**: aggiunto `useEffect` su `selectedOrder?.id` che resetta `editOrderHeader`, `editShowCustomerPicker`, `editCustomerSearchQuery`, `showEditOrderTimePicker` quando si apre un altro ordine — non rimane più in modalità modifica tra ordini diversi

### 26 Maggio 2026 - Tema CHIARO (light theme)
- Sostituita la palette dark con una coordinata light su tutta l'app:
  - Sfondo principale: `#1a1a2e` → `#f5f7fa`
  - Card/modali: `#16213e` → `#ffffff`
  - Bordi: `#0f3460` → `#dde4ee`
  - Testo principale (era light): `#cdd6f4` / `#fff` → `#1a202c` / `#2d3748`
  - Testo muted: `#8892b0` → `#64748b`
- Card con shadow leggero per dare profondità
- Accenti preservati: rosso primary `#e94560`, arancione `#f39c12`, verde `#27ae60`, rosso error `#e74c3c`, blu info `#3498db` — testo bianco su questi accent rimane bianco
- Script Python intelligente: converte `color: '#fff'` in dark text solo quando lo style NON ha un accent backgroundColor (187 conversioni automatiche)

### 26 Maggio 2026 - Setup utility aggiornata
- `POST /api/setup` ora migra anche il campo `deliveryTime` per ordini legacy
- Messaggio: "✅ DELIVERYTIME (ora consegna) aggiunto a N ordini"

### 26 Maggio 2026 - Time Picker nativo iOS/Android cross-platform
- Installato `react-native-paper` + `react-native-paper-dates` (Material Design 3, cross-platform Web/iOS/Android)
- Aggiunto `PaperProvider` con tema dark in `_layout.tsx` + locale italiano registrato
- `TimePickerInline.tsx` riscritto: trigger pulito → al tocco si apre il **clock-face Material** con quadrante orologio interattivo 24h, label/bottoni in italiano (Annulla/Conferma)
- Componente self-contained: nessuna gestione di stato esterna (no più `showXxxTimePicker`)
- UX uniforme tra "Nuovo Ordine" e "Modifica" Info Ordine

### 26 Maggio 2026 - Time Picker minimale + Note piatto inline su card
**Time Picker minimale (refactor di `TimePickerInline.tsx`):**
- Sostituita la griglia di bottoni ore/minuti con un singolo `<input type="time">` nativo del browser
- Su iPad Safari/iOS apre automaticamente il wheel/spinner nativo del sistema operativo
- Aggiunti 2 chip preset rapidi: **Pranzo 13:00** e **Cena 20:00** sotto l'input
- Layout super compatto (~110px h vs ~400px h della versione precedente)

**Note del singolo piatto sulla card home:**
- Se un item ha note, vengono mostrate accanto al nome tra parentesi in corsivo blu: `• 1x Pasta e Zucchine (Ben cotto)`
- `numberOfLines` cambiato da 1 a 2 per ospitare la nota se serve wrappare

### 26 Maggio 2026 - Time Picker visivo per Ora di Consegna
- Creato componente riusabile `src/components/TimePickerInline.tsx`: griglia ore (00-23) + griglia minuti (a step 5: 00, 05, 10, ..., 55) con cella selezionata evidenziata in arancione
- Usato sia in modale "Nuovo Ordine" che nella sezione "Modifica" Info Ordine
- Pattern **inline** (non nested modal) — rispetta la regola anti-iPad-touch-bugs
- Trigger button con icona orologio + chevron e ora corrente, pulsante × per clear
- Formato sempre HH:MM consistente, parsing automatico del valore esistente

### 26 Maggio 2026 - Fix: modale "Nuovo Ordine" ora scrollabile
- Wrappata la sezione contenuto + pulsante "Crea Ordine" della modale Nuovo Ordine in una `ScrollView` per evitare che il pulsante "Crea Ordine" finisca fuori schermo su display più piccoli (iPad portrait, dopo aggiunta del campo "Ora di consegna")

### 26 Maggio 2026 - Modifica intestatario + Note visibili + Ora consegna
**Backend (`/app/backend/server.py`):**
- Aggiunto `deliveryTime: Optional[str]` al modello `Order` + a `OrderCreate`
- Nuovo modello `OrderUpdateInfo` per patch ordine: customerId, customerName, notes, deliveryTime, serviceType
- Nuovo endpoint `PATCH /api/orders/{order_id}` per aggiornare i campi header
- `create_order`: ora salva `deliveryTime`
- `SCHEMA_REFERENCE`: aggiunto `deliveryTime=""` come default per record legacy

**Frontend (`/app/frontend/app/(tabs)/index.tsx`):**
- Modal nuovo ordine: input "Ora di consegna (opzionale)" (es. 13:30)
- Card ordine in home: mostra ora consegna (badge arancione) e note (box blu) se presenti
- Modal dettaglio ordine: nuova sezione "Info Ordine" con pulsante "Modifica"
- Edit inline di: intestatario (con picker clienti), tipologia, ora consegna, note
- Stampa ordine: include ora di consegna e box note evidenziato (CSS giallo)

### 12 Maggio 2026 - Fix: aggiunta piatto in ordine "pronto"/"consegnato" → in_preparazione
- ✅ `POST /api/orders/{id}/items`: se l'ordine ha status `pronto` o `consegnato` e viene aggiunto un nuovo piatto, lo status viene automaticamente riportato a `in_preparazione` (ha senso: c'è ancora lavoro da fare)
- ✅ Applicato sia per i piatti dal menu che per quelli "liberi" (custom items)
- ✅ Nessun effetto collaterale su status `in_attesa`, `in_preparazione`, `sospeso` (restano invariati)

### 12 Maggio 2026 - "Paga ora" invece di "Pagato"
- ✅ Cambiato il testo del pulsante action sugli ordini non pagati in tab Report da "Pagato" a "Paga ora" (più chiaro come call-to-action)

### 12 Maggio 2026 - Calendar Picker + Preset rapidi nel tab Report
- ✅ Sostituite le frecce giorno-per-giorno per `startDate`/`endDate` con un **selettore calendario completo**
- ✅ Aggiunti 4 preset rapidi: `7 giorni`, `30 giorni`, `Questo mese`, `Mese scorso`
- ✅ Modale calendario con `react-native-calendars` (localizzazione italiana)
- ✅ Selezione range con markingType="period" (due click: inizio → fine)
- ✅ Verificato che la sezione "Mancate Vendite del Giorno" / "Mancate Vendite nel Periodo" esiste già ed è funzionante in entrambe le modalità

### 11 Maggio 2026 - Ordini Non Pagati nel tab Report
- ✅ Nuova sezione "Ordini Non Pagati" in `reports.tsx`, visibile sia in modalità Giornaliero che Periodo
- ✅ Modalità Giornaliero: mostra non pagati della data selezionata
- ✅ Modalità Periodo: mostra non pagati nell'intervallo `Dal` → `Al` impostato
- ✅ Ogni ordine ha pulsante verde "Pagato" che lo segna come pagato (`PUT /api/orders/{id}/payment`)
- ✅ Totale da incassare mostrato sotto la lista
- ✅ Badge col contatore degli ordini non pagati nell'header della sezione
- ✅ Backend: `GET /api/orders` ora accetta `date_from`, `date_to`, `unpaid_only` per query flessibili

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
