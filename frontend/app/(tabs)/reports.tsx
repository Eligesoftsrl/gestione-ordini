import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAppStore } from '../../src/store/appStore';
import { reportsApi, missedSalesApi, setupApi, ordersApi } from '../../src/services/api';
import { DailySummary, MissedSale, Order } from '../../src/types';

// Configure Italian locale for react-native-calendars
LocaleConfig.locales['it'] = {
  monthNames: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
  monthNamesShort: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
  dayNames: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'],
  dayNamesShort: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
  today: 'Oggi'
};
LocaleConfig.defaultLocale = 'it';

const CHANNEL_LABELS: Record<string, string> = {
  persona: 'Di Persona',
  telefono: 'Telefono',
  whatsapp: 'WhatsApp',
  richiesta: 'Richiesta',
};

const ADMIN_PASSWORD = 'eligesoft';

type ReportMode = 'daily' | 'range';

interface SetupStatus {
  database: string;
  collections: Record<string, number>;
  issues: { missing_initialPortions: number };
  status: string;
}

export default function ReportsScreen() {
  const { selectedDate, setSelectedDate } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [missedSales, setMissedSales] = useState<MissedSale[]>([]);
  const [topDishes, setTopDishes] = useState<any[]>([]);
  
  // Setup/Admin state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [password, setPassword] = useState('');
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  
  // Report mode and date range
  const [reportMode, setReportMode] = useState<ReportMode>('daily');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Range statistics
  const [rangeStats, setRangeStats] = useState<{
    totalOrders: number;
    totalRevenue: number;
    missedSalesTotal: number;
    missedSalesQuantity: number;
  } | null>(null);

  // Unpaid orders
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [isLoadingUnpaid, setIsLoadingUnpaid] = useState(false);
  
  // Calendar picker for range mode
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarStart, setCalendarStart] = useState<string | null>(null);
  const [calendarEnd, setCalendarEnd] = useState<string | null>(null);

  const loadUnpaidOrders = async () => {
    try {
      setIsLoadingUnpaid(true);
      const data = reportMode === 'daily'
        ? await ordersApi.getUnpaidByRange(undefined, undefined, selectedDate)
        : await ordersApi.getUnpaidByRange(startDate, endDate);
      setUnpaidOrders(data);
    } catch (error) {
      console.error('Error loading unpaid orders:', error);
    } finally {
      setIsLoadingUnpaid(false);
    }
  };

  const handleMarkAsPaid = async (order: Order) => {
    try {
      await ordersApi.updatePayment(order.id, true);
      setUnpaidOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (error) {
      console.error('Error marking as paid:', error);
      Alert.alert('Errore', 'Impossibile aggiornare il pagamento');
    }
  };

  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const loadDailyData = async () => {
    try {
      setIsLoading(true);
      
      // Load daily summary
      const summaryData = await reportsApi.getDailySummary(selectedDate);
      setSummary(summaryData);
      
      // Load missed sales for the day
      const missedData = await missedSalesApi.getAll(selectedDate);
      setMissedSales(missedData);
      
      // Load top dishes
      const topData = await reportsApi.getTopDishes();
      setTopDishes(topData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRangeData = async () => {
    try {
      setIsLoading(true);
      
      // Load top dishes for range
      const topData = await reportsApi.getTopDishes(startDate, endDate, 10);
      setTopDishes(topData);
      
      // Load missed sales summary for range
      const missedSummary = await reportsApi.getMissedSalesSummary(startDate, endDate);
      
      // Calculate total orders and revenue from daily summaries
      // For now we use the missed sales summary data
      setRangeStats({
        totalOrders: missedSummary.totalMissedSales || 0,
        totalRevenue: 0, // Would need a separate endpoint
        missedSalesTotal: missedSummary.totalMissedSales || 0,
        missedSalesQuantity: missedSummary.byDish?.reduce((acc: number, d: any) => acc + (d.totalQuantity || d.count || 0), 0) || 0,
      });
      
      // Convert missed sales by dish to array format
      if (missedSummary.byDish) {
        const missedArray = missedSummary.byDish.map((d: any, index: number) => ({
          id: `missed-${index}`,
          dishName: d.dishName,
          quantity: d.totalQuantity || d.count || 1,
          date: '',
          timeSlot: '',
          channel: '',
          reason: 'esaurito',
        }));
        setMissedSales(missedArray);
      }
    } catch (error) {
      console.error('Error loading range reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reportMode === 'daily') {
      loadDailyData();
    } else {
      loadRangeData();
    }
    loadUnpaidOrders();
  }, [selectedDate, reportMode, startDate, endDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (reportMode === 'daily') {
      await loadDailyData();
    } else {
      await loadRangeData();
    }
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(format(currentDate, 'yyyy-MM-dd'));
  };

  const changeDateRange = (which: 'start' | 'end', days: number) => {
    if (which === 'start') {
      const newDate = addDays(new Date(startDate), days);
      if (newDate <= new Date(endDate)) {
        setStartDate(format(newDate, 'yyyy-MM-dd'));
      }
    } else {
      const newDate = addDays(new Date(endDate), days);
      if (newDate >= new Date(startDate)) {
        setEndDate(format(newDate, 'yyyy-MM-dd'));
      }
    }
  };

  // Setup/Admin functions
  const handlePasswordSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      setShowPasswordModal(false);
      setPassword('');
      setShowSetupModal(true);
      checkSetupStatus();
    } else {
      Alert.alert('Errore', 'Password non corretta');
      setPassword('');
    }
  };

  const checkSetupStatus = async () => {
    try {
      const status = await setupApi.getStatus();
      setSetupStatus(status);
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const runSetup = async () => {
    setIsSetupLoading(true);
    try {
      const result = await setupApi.runSetup();
      Alert.alert(
        'Setup Completato!',
        `Categorie aggiunte: ${result.categories_added}\nMenu aggiornati: ${result.menus_updated}`,
        [{ text: 'OK', onPress: checkSetupStatus }]
      );
    } catch (error) {
      console.error('Error running setup:', error);
      Alert.alert('Errore', 'Impossibile eseguire il setup del database');
    } finally {
      setIsSetupLoading(false);
    }
  };

  const closeSetupModal = () => {
    setShowSetupModal(false);
    setSetupStatus(null);
  };

  // Calculate total missed quantity
  const totalMissedQuantity = missedSales.reduce((acc, ms) => acc + (ms.quantity || 1), 0);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={40} color="#e94560" />
              <Text style={styles.modalTitle}>Area Riservata</Text>
              <Text style={styles.modalSubtitle}>
                Inserisci la password per accedere alle impostazioni
              </Text>
            </View>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handlePasswordSubmit}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handlePasswordSubmit}
              >
                <Text style={styles.loginButtonText}>Accedi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Setup Modal */}
      <Modal
        visible={showSetupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeSetupModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.setupModalContent}>
            <View style={styles.setupModalHeader}>
              <Text style={styles.setupModalTitle}>Impostazioni Admin</Text>
              <TouchableOpacity onPress={closeSetupModal}>
                <Ionicons name="close" size={28} color="#1a202c" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.setupModalBody}>
              {/* Status Section */}
              <View style={styles.setupSection}>
                <View style={styles.setupSectionHeader}>
                  <Text style={styles.setupSectionTitle}>Stato Database</Text>
                  <TouchableOpacity onPress={checkSetupStatus}>
                    <Ionicons name="refresh" size={20} color="#e94560" />
                  </TouchableOpacity>
                </View>

                {setupStatus ? (
                  <View style={styles.statusContainer}>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Database:</Text>
                      <Text style={styles.statusValue}>{setupStatus.database}</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Stato:</Text>
                      <View style={[
                        styles.statusBadge,
                        setupStatus.status === 'ok' ? styles.statusOk : styles.statusWarning
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {setupStatus.status === 'ok' ? 'OK' : 'Setup Necessario'}
                        </Text>
                      </View>
                    </View>
                    {setupStatus.issues.missing_initialPortions > 0 && (
                      <View style={styles.warningBox}>
                        <Ionicons name="warning" size={18} color="#f39c12" />
                        <Text style={styles.warningText}>
                          {setupStatus.issues.missing_initialPortions} piatti senza porzioni iniziali
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <ActivityIndicator size="small" color="#e94560" />
                )}
              </View>

              {/* Setup Action */}
              <View style={styles.setupSection}>
                <Text style={styles.setupSectionTitle}>Azioni</Text>
                <TouchableOpacity
                  style={[styles.setupButton, isSetupLoading && styles.setupButtonDisabled]}
                  onPress={runSetup}
                  disabled={isSetupLoading}
                >
                  {isSetupLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="build" size={20} color="#1a202c" />
                      <Text style={styles.setupButtonText}>Esegui Setup Database</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.setupHint}>
                  Sincronizza categorie e campi mancanti nel database.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Report e Statistiche</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowPasswordModal(true)}
          >
            <Ionicons name="settings-outline" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
        
        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, reportMode === 'daily' && styles.modeButtonActive]}
            onPress={() => setReportMode('daily')}
          >
            <Text style={[styles.modeButtonText, reportMode === 'daily' && styles.modeButtonTextActive]}>
              Giornaliero
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, reportMode === 'range' && styles.modeButtonActive]}
            onPress={() => setReportMode('range')}
          >
            <Text style={[styles.modeButtonText, reportMode === 'range' && styles.modeButtonTextActive]}>
              Periodo
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Date Selector */}
        {reportMode === 'daily' ? (
          <View style={styles.dateSelector}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
              <Ionicons name="chevron-back" size={24} color="#1a202c" />
            </TouchableOpacity>
            <Text style={styles.dateText}>
              {format(new Date(selectedDate), 'EEEE d MMMM yyyy', { locale: it })}
            </Text>
            <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
              <Ionicons name="chevron-forward" size={24} color="#1a202c" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rangeDateSelector}>
            {/* Preset shortcuts */}
            <View style={styles.presetRow}>
              <TouchableOpacity 
                style={styles.presetChip}
                onPress={() => {
                  setStartDate(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                }}
                testID="preset-7days"
              >
                <Text style={styles.presetChipText}>7 giorni</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setStartDate(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                }}
                testID="preset-30days"
              >
                <Text style={styles.presetChipText}>30 giorni</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const now = new Date();
                  setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
                  setEndDate(format(now, 'yyyy-MM-dd'));
                }}
                testID="preset-this-month"
              >
                <Text style={styles.presetChipText}>Questo mese</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const prev = subMonths(new Date(), 1);
                  setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
                }}
                testID="preset-prev-month"
              >
                <Text style={styles.presetChipText}>Mese scorso</Text>
              </TouchableOpacity>
            </View>

            {/* Clickable date range that opens the calendar */}
            <TouchableOpacity
              style={styles.dateRangeButton}
              onPress={() => {
                setCalendarStart(startDate);
                setCalendarEnd(endDate);
                setShowCalendar(true);
              }}
              testID="open-calendar-button"
            >
              <Ionicons name="calendar-outline" size={20} color="#e94560" />
              <Text style={styles.dateRangeButtonText}>
                {format(new Date(startDate), 'd MMM yyyy', { locale: it })}
                {'  →  '}
                {format(new Date(endDate), 'd MMM yyyy', { locale: it })}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.ordersCard]}>
            <Ionicons name="receipt-outline" size={32} color="#3498db" />
            <Text style={styles.summaryValue}>
              {reportMode === 'daily' ? (summary?.totalOrders || 0) : (rangeStats?.totalOrders || 0)}
            </Text>
            <Text style={styles.summaryLabel}>
              {reportMode === 'daily' ? 'Ordini Totali' : 'Ordini Periodo'}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, styles.revenueCard]}>
            <Ionicons name="cash-outline" size={32} color="#27ae60" />
            <Text style={[styles.summaryValue, { color: '#27ae60' }]}>
              {reportMode === 'daily' 
                ? (summary?.totalRevenue || 0).toFixed(2) 
                : (rangeStats?.totalRevenue || 0).toFixed(2)} €
            </Text>
            <Text style={styles.summaryLabel}>
              {reportMode === 'daily' ? 'Incasso Giorno' : 'Incasso Periodo'}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, styles.missedCard]}>
            <Ionicons name="alert-circle-outline" size={32} color="#e74c3c" />
            <Text style={[styles.summaryValue, { color: '#e74c3c' }]}>
              {totalMissedQuantity}
            </Text>
            <Text style={styles.summaryLabel}>Mancate Vendite</Text>
          </View>
        </View>

        {/* Daily-only sections */}
        {reportMode === 'daily' && (
          <>
            {/* Channel Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vendite per Canale</Text>
              <View style={styles.channelGrid}>
                {Object.entries(summary?.channelBreakdown || {}).map(([channel, count]) => (
                  <View key={channel} style={styles.channelCard}>
                    <Ionicons
                      name={
                        channel === 'whatsapp' ? 'logo-whatsapp' :
                        channel === 'telefono' ? 'call' : 'person'
                      }
                      size={24}
                      color="#e94560"
                    />
                    <Text style={styles.channelCount}>{count as number}</Text>
                    <Text style={styles.channelLabel}>{CHANNEL_LABELS[channel] || channel}</Text>
                  </View>
                ))}
                {Object.keys(summary?.channelBreakdown || {}).length === 0 && (
                  <Text style={styles.noDataText}>Nessun dato disponibile</Text>
                )}
              </View>
            </View>

            {/* Dish Sales */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vendite Piatti del Giorno</Text>
              {summary?.dishSales && summary.dishSales.length > 0 ? (
                summary.dishSales.map((dish, index) => (
                  <View key={`dish-sale-${dish.dishName}-${index}`} style={styles.dishSaleRow}>
                    <View style={styles.dishSaleInfo}>
                      <Text style={styles.dishSaleName}>{dish.dishName}</Text>
                      <Text style={styles.dishSaleQty}>{dish.quantity} porzioni vendute</Text>
                    </View>
                    <Text style={styles.dishSaleRevenue}>{dish.revenue.toFixed(2)} €</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Nessuna vendita oggi</Text>
              )}
            </View>

            {/* Menu Availability */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Disponibilità Menu</Text>
              {summary?.menuItems && summary.menuItems.length > 0 ? (
                summary.menuItems.map((item, index) => (
                  <View key={`menu-avail-${item.dishId || item.dishName}-${index}`} style={styles.menuAvailRow}>
                    <Text style={styles.menuAvailName}>{item.dishName}</Text>
                    <View style={[
                      styles.availBadge,
                      item.portions === 0 && styles.availBadgeEmpty,
                      item.portions > 0 && item.portions <= 3 && styles.availBadgeLow,
                    ]}>
                      <Text style={styles.availBadgeText}>
                        {item.portions === 0 ? 'Esaurito' : `${item.portions} disp.`}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Nessun menu per oggi</Text>
              )}
            </View>
          </>
        )}

        {/* Unpaid Orders Section */}
        <View style={styles.section} testID="unpaid-orders-section">
          <View style={styles.unpaidHeader}>
            <View style={styles.unpaidHeaderLeft}>
              <Ionicons name="card-outline" size={22} color="#e74c3c" />
              <Text style={styles.sectionTitle}>
                {reportMode === 'daily' ? 'Ordini Non Pagati del Giorno' : 'Ordini Non Pagati nel Periodo'}
              </Text>
            </View>
            {unpaidOrders.length > 0 && (
              <View style={styles.unpaidBadge}>
                <Text style={styles.unpaidBadgeText}>{unpaidOrders.length}</Text>
              </View>
            )}
          </View>
          
          {isLoadingUnpaid ? (
            <ActivityIndicator size="small" color="#e74c3c" style={{ marginVertical: 16 }} />
          ) : unpaidOrders.length === 0 ? (
            <Text style={styles.noDataText}>
              {reportMode === 'daily' ? 'Nessun ordine non pagato oggi' : 'Nessun ordine non pagato nel periodo'}
            </Text>
          ) : (
            <>
              {unpaidOrders.map((order) => (
                <View key={order.id} style={styles.unpaidOrderRow} testID={`unpaid-order-${order.id}`}>
                  <View style={styles.unpaidOrderInfo}>
                    <Text style={styles.unpaidOrderCustomer}>
                      {order.customerName || 'Anonimo'}
                    </Text>
                    <Text style={styles.unpaidOrderMeta}>
                      #{order.orderNumber} • {order.menuDate} • {(order.total || 0).toFixed(2)} €
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.markPaidBtn}
                    onPress={() => handleMarkAsPaid(order)}
                    testID={`mark-paid-${order.id}`}
                  >
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.markPaidBtnText}>Paga ora</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.unpaidTotalRow}>
                <Text style={styles.unpaidTotalLabel}>Totale da incassare:</Text>
                <Text style={styles.unpaidTotalValue}>{unpaidTotal.toFixed(2)} €</Text>
              </View>
            </>
          )}
        </View>

        {/* Top Dishes - Show in both modes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {reportMode === 'daily' ? 'Piatti Più Venduti (Storico)' : 'Piatti Più Venduti nel Periodo'}
          </Text>
          {topDishes.length > 0 ? (
            topDishes.slice(0, 10).map((dish, index) => (
              <View key={`top-dish-${dish.dishId || dish.dishName}-${index}`} style={styles.topDishRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.topDishInfo}>
                  <Text style={styles.topDishName}>{dish.dishName}</Text>
                  <Text style={styles.topDishStats}>
                    {dish.totalQuantity} porzioni • {dish.totalRevenue.toFixed(2)} €
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Nessun dato disponibile</Text>
          )}
        </View>

        {/* Missed Sales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {reportMode === 'daily' ? 'Mancate Vendite del Giorno' : 'Mancate Vendite nel Periodo'}
          </Text>
          {missedSales.length > 0 ? (
            missedSales.map((ms, index) => (
              <View key={ms.id || `missed-${index}`} style={styles.missedSaleRow}>
                <View style={styles.missedSaleInfo}>
                  <Text style={styles.missedSaleName}>{ms.dishName}</Text>
                  {reportMode === 'daily' && ms.timeSlot && (
                    <Text style={styles.missedSaleDetails}>
                      {ms.timeSlot} • {CHANNEL_LABELS[ms.channel] || ms.channel}
                    </Text>
                  )}
                </View>
                <View style={styles.missedQuantityBadge}>
                  <Text style={styles.missedQuantityText}>
                    {ms.quantity || 1} {(ms.quantity || 1) === 1 ? 'richiesta' : 'richieste'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>
              {reportMode === 'daily' ? 'Nessuna mancata vendita oggi' : 'Nessuna mancata vendita nel periodo'}
            </Text>
          )}
          
          {missedSales.length > 0 && (
            <View style={styles.missedTotalRow}>
              <Text style={styles.missedTotalLabel}>Totale Richieste Non Soddisfatte:</Text>
              <Text style={styles.missedTotalValue}>{totalMissedQuantity}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Modal for selecting date range */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
          testID="calendar-overlay"
        >
          <TouchableOpacity
            style={styles.calendarModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.calendarTitle}>
              {!calendarStart || (calendarStart && calendarEnd)
                ? 'Seleziona data iniziale'
                : 'Seleziona data finale'}
            </Text>
            <Text style={styles.calendarSubtitle}>
              {calendarStart && !calendarEnd
                ? `Dal: ${format(new Date(calendarStart), 'd MMM yyyy', { locale: it })}`
                : calendarStart && calendarEnd
                ? `${format(new Date(calendarStart), 'd MMM yyyy', { locale: it })}  →  ${format(new Date(calendarEnd), 'd MMM yyyy', { locale: it })}`
                : 'Tocca una data per iniziare'}
            </Text>
            
            <Calendar
              current={endDate}
              maxDate={format(new Date(), 'yyyy-MM-dd')}
              markingType="period"
              markedDates={(() => {
                if (!calendarStart) return {};
                if (calendarStart && !calendarEnd) {
                  return {
                    [calendarStart]: { startingDay: true, endingDay: true, color: '#e94560', textColor: '#fff' }
                  };
                }
                // Build the range
                const marked: any = {};
                const start = new Date(calendarStart!);
                const end = new Date(calendarEnd!);
                let cur = start;
                while (cur <= end) {
                  const d = format(cur, 'yyyy-MM-dd');
                  marked[d] = {
                    color: '#e94560',
                    textColor: '#fff',
                    ...(d === calendarStart ? { startingDay: true } : {}),
                    ...(d === calendarEnd ? { endingDay: true } : {}),
                  };
                  cur = addDays(cur, 1);
                }
                return marked;
              })()}
              onDayPress={(day) => {
                const picked = day.dateString;
                if (!calendarStart || (calendarStart && calendarEnd)) {
                  // Start a new selection
                  setCalendarStart(picked);
                  setCalendarEnd(null);
                } else {
                  // Second click: set end (or swap if before start)
                  if (picked < calendarStart) {
                    setCalendarEnd(calendarStart);
                    setCalendarStart(picked);
                  } else {
                    setCalendarEnd(picked);
                  }
                }
              }}
              theme={{
                calendarBackground: '#ffffff',
                backgroundColor: '#ffffff',
                textSectionTitleColor: '#64748b',
                dayTextColor: '#fff',
                monthTextColor: '#fff',
                arrowColor: '#e94560',
                todayTextColor: '#e94560',
                selectedDayBackgroundColor: '#e94560',
                selectedDayTextColor: '#fff',
                textDisabledColor: '#e2e8f0',
              }}
              firstDay={1}
            />
            
            <View style={styles.calendarActionsRow}>
              <TouchableOpacity
                style={styles.calendarCancelBtn}
                onPress={() => setShowCalendar(false)}
                testID="calendar-cancel"
              >
                <Text style={styles.calendarCancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarApplyBtn, (!calendarStart || !calendarEnd) && styles.disabledButton]}
                disabled={!calendarStart || !calendarEnd}
                onPress={() => {
                  if (calendarStart && calendarEnd) {
                    setStartDate(calendarStart);
                    setEndDate(calendarEnd);
                    setShowCalendar(false);
                  }
                }}
                testID="calendar-apply"
              >
                <Text style={styles.calendarApplyBtnText}>Applica</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#1a202c',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  dateButton: {
    padding: 8,
  },
  dateText: {
    fontSize: 18,
    color: '#e94560',
    fontWeight: '600',
    marginHorizontal: 16,
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  ordersCard: {},
  revenueCard: {},
  missedCard: {},
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a202c',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  channelGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  channelCard: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  channelCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginTop: 8,
  },
  channelLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  noDataText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  dishSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  dishSaleInfo: {
    flex: 1,
  },
  dishSaleName: {
    fontSize: 15,
    color: '#1a202c',
    fontWeight: '500',
  },
  dishSaleQty: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  dishSaleRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  menuAvailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  menuAvailName: {
    fontSize: 15,
    color: '#1a202c',
  },
  availBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availBadgeEmpty: {
    backgroundColor: '#e74c3c',
  },
  availBadgeLow: {
    backgroundColor: '#f39c12',
  },
  availBadgeText: {
    color: '#1a202c',
    fontSize: 12,
    fontWeight: '600',
  },
  topDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rankText: {
    color: '#1a202c',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topDishInfo: {
    flex: 1,
  },
  topDishName: {
    fontSize: 15,
    color: '#1a202c',
    fontWeight: '500',
  },
  topDishStats: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  missedSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  missedSaleInfo: {
    flex: 1,
  },
  missedSaleName: {
    fontSize: 15,
    color: '#1a202c',
    fontWeight: '500',
  },
  missedSaleDetails: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  reasonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonExhausted: {
    backgroundColor: '#e74c3c',
  },
  reasonNotInMenu: {
    backgroundColor: '#f39c12',
  },
  reasonText: {
    color: '#1a202c',
    fontSize: 11,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#e94560',
  },
  modeButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#1a202c',
  },
  rangeDateSelector: {
    marginTop: 12,
    gap: 8,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangeLabel: {
    color: '#64748b',
    fontSize: 14,
    width: 35,
  },
  dateRangeText: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 100,
    textAlign: 'center',
  },
  missedQuantityBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  missedQuantityText: {
    color: '#1a202c',
    fontSize: 13,
    fontWeight: '600',
  },
  missedTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e74c3c',
  },
  missedTotalLabel: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '600',
  },
  missedTotalValue: {
    color: '#e74c3c',
    fontSize: 24,
    fontWeight: 'bold',
  },
  // Unpaid orders section
  unpaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  unpaidHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  unpaidBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  unpaidBadgeText: {
    color: '#1a202c',
    fontWeight: '700',
    fontSize: 13,
  },
  unpaidOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7fa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  unpaidOrderInfo: {
    flex: 1,
    marginRight: 12,
  },
  unpaidOrderCustomer: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  unpaidOrderMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#27ae60',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markPaidBtnText: {
    color: '#1a202c',
    fontSize: 13,
    fontWeight: '700',
  },
  unpaidTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e74c3c',
  },
  unpaidTotalLabel: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '600',
  },
  unpaidTotalValue: {
    color: '#e74c3c',
    fontSize: 22,
    fontWeight: 'bold',
  },
  // Header row with settings button
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  // Range mode - preset shortcuts + clickable calendar trigger
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'center',
  },
  presetChip: {
    backgroundColor: '#dde4ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c5d0e0',
  },
  presetChipText: {
    color: '#1a202c',
    fontSize: 12,
    fontWeight: '600',
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dde4ee',
  },
  dateRangeButtonText: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '600',
  },
  // Calendar modal
  calendarModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 380,
  },
  calendarTitle: {
    color: '#1a202c',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  calendarSubtitle: {
    color: '#e94560',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  calendarActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  calendarCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dde4ee',
    alignItems: 'center',
  },
  calendarCancelBtnText: {
    color: '#1a202c',
    fontWeight: '600',
    fontSize: 14,
  },
  calendarApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#e94560',
    alignItems: 'center',
  },
  calendarApplyBtnText: {
    color: '#1a202c',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a202c',
    marginTop: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  passwordInput: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 14,
    color: '#1a202c',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    flex: 1,
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '600',
  },
  // Setup Modal styles
  setupModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  setupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  setupModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  setupModalBody: {
    padding: 16,
  },
  setupSection: {
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  setupSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setupSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  statusContainer: {
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  statusValue: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOk: {
    backgroundColor: '#27ae60',
  },
  statusWarning: {
    backgroundColor: '#f39c12',
  },
  statusBadgeText: {
    color: '#1a202c',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  warningText: {
    color: '#f39c12',
    fontSize: 13,
    flex: 1,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  setupButtonDisabled: {
    opacity: 0.6,
  },
  setupButtonText: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '600',
  },
  setupHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
