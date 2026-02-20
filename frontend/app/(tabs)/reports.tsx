import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { reportsApi, missedSalesApi } from '../../src/services/api';
import { DailySummary, MissedSale } from '../../src/types';

const CHANNEL_LABELS: Record<string, string> = {
  persona: 'Di Persona',
  telefono: 'Telefono',
  whatsapp: 'WhatsApp',
};

export default function ReportsScreen() {
  const { selectedDate, setSelectedDate } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [missedSales, setMissedSales] = useState<MissedSale[]>([]);
  const [topDishes, setTopDishes] = useState<any[]>([]);

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(format(currentDate, 'yyyy-MM-dd'));
  };

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report e Statistiche</Text>
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
            <Text style={styles.summaryValue}>{summary?.totalOrders || 0}</Text>
            <Text style={styles.summaryLabel}>Ordini Totali</Text>
          </View>
          
          <View style={[styles.summaryCard, styles.revenueCard]}>
            <Ionicons name="cash-outline" size={32} color="#27ae60" />
            <Text style={[styles.summaryValue, { color: '#27ae60' }]}>
              {(summary?.totalRevenue || 0).toFixed(2)} €
            </Text>
            <Text style={styles.summaryLabel}>Incasso Giornaliero</Text>
          </View>
          
          <View style={[styles.summaryCard, styles.missedCard]}>
            <Ionicons name="alert-circle-outline" size={32} color="#e74c3c" />
            <Text style={[styles.summaryValue, { color: '#e74c3c' }]}>
              {missedSales.length}
            </Text>
            <Text style={styles.summaryLabel}>Mancate Vendite</Text>
          </View>
        </View>

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

        {/* Top Dishes Overall */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Piatti Più Venduti (Storico)</Text>
          {topDishes.length > 0 ? (
            topDishes.slice(0, 5).map((dish, index) => (
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
            <Text style={styles.noDataText}>Nessun dato storico</Text>
          )}
        </View>

        {/* Missed Sales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mancate Vendite del Giorno</Text>
          {missedSales.length > 0 ? (
            missedSales.map((ms) => (
              <View key={ms.id} style={styles.missedSaleRow}>
                <View style={styles.missedSaleInfo}>
                  <Text style={styles.missedSaleName}>{ms.dishName}</Text>
                  <Text style={styles.missedSaleDetails}>
                    {ms.timeSlot} • {CHANNEL_LABELS[ms.channel] || ms.channel}
                  </Text>
                </View>
                <View style={[
                  styles.reasonBadge,
                  ms.reason === 'esaurito' ? styles.reasonExhausted : styles.reasonNotInMenu
                ]}>
                  <Text style={styles.reasonText}>
                    {ms.reason === 'esaurito' ? 'Esaurito' : 'Non nel menu'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Nessuna mancata vendita oggi</Text>
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
});
