# Bancó — Sistema Gestione Ordini Ristorazione

## Problem Statement (originale)
Sistema di gestione ordini completo per ristorante/catering ("Bancó"), pensato per tablet e mobile.
Funzionalità core: gestione piatti, menu giornaliero, profili cliente, stati ordini, ordini non pagati,
porzioni disponibili. Tema chiaro con colori brand (Rosso McDonald's `#DB0007`, Giallo `#FFBC0D`,
Verde Starbucks `#00754A`, ombra viola `#5423E7`). Native date/time picker, editing ordini,
e supporto stampa termica 62mm. iPad-compatibile, no nested modal bugs.

## Stack
- Frontend: Expo (React Native) + TypeScript + Expo Router
- Backend: FastAPI (Python)
- Database: MongoDB (Motor async)

## Funzionalità implementate
- Gestione categorie, piatti, menu giornaliero
- Gestione clienti con ricerca (limit 5000)
- Creazione/modifica/eliminazione ordini con stati
- Tipi servizio: `da_consegnare` / `da_ritirare` / `in_sede`
- Canali: persona / telefono / whatsapp
- Editing inline `customerName` e `deliveryTime` dal modale ordine
- Ricerca testuale ordini (cliente, piatto, numero ordine)
- Vista "Ordini non pagati" con range calendario nativo
- Vista "Piatti disponibili" filtrabili
- Tema chiaro con colori brand
- Time/date picker nativi (`@react-native-community/datetimepicker`)
- **Stampa termica 62mm ottimizzata** (vedi sezione dedicata)

## Stampa termica 62mm (`handlePrintOrder` in `app/(tabs)/index.tsx`)
Layout finale validato dall'utente per stampante a rotolo adesivo 62mm:
- `@page`: `60mm auto`, margini `1.5mm 2mm 1.5mm 2mm`
- Larghezza contenuto: `56mm`
- Font: Courier New monospace
- Titolo `ORDINE #N` a 9pt + subtitle "Canale · Servizio" a 6.5pt su una riga
- Box `ORA: HH:MM` 11pt con bordo solido
- Box `NOTE:` 7.5pt con bordo tratteggiato
- Items 8.5pt (quantità + nome + prezzo), note item 7pt corsivo
- Totale 11pt destra
- **No footer** (data/ora rimossi su richiesta utente)
- Altezza tipica ordine 5 piatti: ~86mm di carta

## Note tecniche importanti
- **Mai modali nidificati** (rompono touch su iPad Safari/Expo Go)
- **Mai `react-native-paper`** (problemi font loading Expo Go)
- Non sovrascrivere i colori brand
- Lingua interfaccia: Italiano

## Backlog / Future
- P2: Animazione fade-in del logo (effetto Apple/Stripe) al caricamento app
- P2: Refactoring `index.tsx` (>4000 righe) in componenti separati
- P3: Fix lint warnings pre-esistenti (apostrofi non escaped, chiave duplicata `orderItemsList` linee 2524/3164, import non usati)

## Credenziali test
- Reports Tab → Gear Icon Password: `eligesoft`
