#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Sistema di gestione ordini per ristorazione - applicazione tablet con gestione piatti, menu giornaliero, ordini, clienti e report"

backend:
  - task: "API Gestione Piatti (CRUD)"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Testato con curl - creazione, lettura, modifica piatti funzionanti"

  - task: "API Menu Giornaliero"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Testato creazione menu, aggiunta piatti con porzioni e prezzi"

  - task: "API Gestione Ordini"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Testato creazione ordine, aggiunta piatti, scalamento automatico porzioni (da 20 a 18)"

  - task: "API Clienti"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implementato ma non ancora testato con curl"
        - working: true
          agent: "testing"
          comment: "✅ TESTATO COMPLETAMENTE - Tutti gli endpoint funzionanti: POST /customers (creazione), GET /customers (lista), GET /customers/{id} (singolo), PUT /customers/{id} (aggiornamento), GET /customers/{id}/orders (ordini cliente). Test con dati realistici: Giuseppe Verdi, telefono, email, indirizzo, fatturazione. Risposta corretta a tutti i test."

  - task: "API Mancate Vendite"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implementato ma non ancora testato"
        - working: true
          agent: "testing"
          comment: "✅ TESTATO COMPLETAMENTE - Tutti gli endpoint funzionanti: POST /missed-sales (creazione mancata vendita), GET /missed-sales (lista completa), GET /missed-sales?date=... (filtro per data). Test con dati realistici: piatto Carbonara Speciale, data 2026-02-20, canale telefono, motivo esaurito. Tutte le risposte corrette."

  - task: "API Report"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Verificato via UI - mostra correttamente statistiche e vendite"

frontend:
  - task: "Schermata Ordini"
    implemented: true
    working: true
    file: "app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Screenshot verificato - lista ordini, creazione ordine, statistiche"

  - task: "Schermata Menu Giornaliero"
    implemented: true
    working: true
    file: "app/(tabs)/menu.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Screenshot verificato - mostra piatti nel menu con porzioni disponibili"

  - task: "Schermata Anagrafica Piatti"
    implemented: true
    working: true
    file: "app/(tabs)/dishes.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Screenshot verificato - griglia piatti con modifica/disattiva"

  - task: "Schermata Clienti"
    implemented: true
    working: "NA"
    file: "app/(tabs)/customers.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implementato ma non verificato con screenshot"

  - task: "Schermata Report"
    implemented: true
    working: true
    file: "app/(tabs)/reports.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Screenshot verificato - statistiche, vendite per canale, piatti venduti"

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "MVP completato. API principali testate con curl. Frontend verificato con screenshot. Funzionalità core (piatti, menu, ordini) funzionanti. Da testare: API clienti e mancate vendite."
    - agent: "testing"
      message: "🎉 BACKEND TESTING COMPLETATO - Tutti i 7 moduli API testati con successo: ✅ Dishes API (CRUD completo), ✅ Daily Menu API (creazione/gestione menu), ✅ Orders API (creazione ordini + scaling porzioni), ✅ Portion Blocking VC-03 (blocco corretto quando porzioni=0), ✅ Customers API (CRUD clienti), ✅ Missed Sales API (gestione mancate vendite), ✅ Reports API (statistiche giornaliere). Tutte le validazioni business logic funzionanti: calcolo automatico totale ordini, scalamento porzioni, blocco ordini senza disponibilità. Backend robusto e pronto per produzione."