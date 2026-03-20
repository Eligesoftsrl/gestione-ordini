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
import { format, addDays, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { reportsApi, missedSalesApi, setupApi } from '../../src/services/api';
import { DailySummary, MissedSale } from '../../src/types';

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
              placeholderTextColor="#8892b0"
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
                <Ionicons name="close" size={28} color="#fff" />
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
                      <Ionicons name="build" size={20} color="#fff" />
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
            <Ionicons name="settings-outline" size={24} color="#8892b0" />
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
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.dateText}>
              {format(new Date(selectedDate), 'EEEE d MMMM yyyy', { locale: it })}
            </Text>
            <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rangeDateSelector}>
            <View style={styles.dateRangeRow}>
              <Text style={styles.dateRangeLabel}>Dal:</Text>
              <TouchableOpacity onPress={() => changeDateRange('start', -1)} style={styles.dateButton}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.dateRangeText}>
                {format(new Date(startDate), 'd MMM yyyy', { locale: it })}
              </Text>
              <TouchableOpacity onPress={() => changeDateRange('start', 1)} style={styles.dateButton}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.dateRangeRow}>
              <Text style={styles.dateRangeLabel}>Al:</Text>
              <TouchableOpacity onPress={() => changeDateRange('end', -1)} style={styles.dateButton}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.dateRangeText}>
                {format(new Date(endDate), 'd MMM yyyy', { locale: it })}
              </Text>
              <TouchableOpacity onPress={() => changeDateRange('end', 1)} style={styles.dateButton}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    backgroundColor: '#16213e',
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
    color: '#fff',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  channelGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  channelCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  channelCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  channelLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  noDataText: {
    color: '#8892b0',
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
    borderBottomColor: '#0f3460',
  },
  dishSaleInfo: {
    flex: 1,
  },
  dishSaleName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  dishSaleQty: {
    fontSize: 13,
    color: '#8892b0',
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
    borderBottomColor: '#0f3460',
  },
  menuAvailName: {
    fontSize: 15,
    color: '#fff',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  topDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
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
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topDishInfo: {
    flex: 1,
  },
  topDishName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  topDishStats: {
    fontSize: 13,
    color: '#8892b0',
    marginTop: 2,
  },
  missedSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  missedSaleInfo: {
    flex: 1,
  },
  missedSaleName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  missedSaleDetails: {
    fontSize: 13,
    color: '#8892b0',
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
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#1a1a2e',
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
    color: '#8892b0',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#fff',
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
    color: '#8892b0',
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
    color: '#fff',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  missedTotalValue: {
    color: '#e74c3c',
    fontSize: 24,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#16213e',
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
    color: '#fff',
    marginTop: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    marginTop: 8,
  },
  passwordInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8892b0',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Setup Modal styles
  setupModalContent: {
    backgroundColor: '#16213e',
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
    borderBottomColor: '#0f3460',
  },
  setupModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  setupModalBody: {
    padding: 16,
  },
  setupSection: {
    backgroundColor: '#1a1a2e',
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
    color: '#fff',
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
    color: '#8892b0',
    fontSize: 14,
  },
  statusValue: {
    color: '#fff',
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
    color: '#fff',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  setupHint: {
    color: '#8892b0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
