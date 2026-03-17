import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ordersApi, customersApi } from '../src/services/api';
import { Order, Customer } from '../src/types';

const STATUS_COLORS: Record<string, string> = {
  in_attesa: '#f39c12',
  in_preparazione: '#3498db',
  pronto: '#27ae60',
  sospeso: '#e74c3c',
  consegnato: '#7f8c8d',
};

const STATUS_LABELS: Record<string, string> = {
  in_attesa: 'Attesa',
  in_preparazione: 'Preparazione',
  pronto: 'Pronto',
  sospeso: 'Sospeso',
  consegnato: 'Consegnato',
};

// Toast component
const Toast = ({ visible, message, type, onHide }: { visible: boolean; message: string; type: 'success' | 'error'; onHide: () => void }) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[toastStyles.toast, type === 'success' ? toastStyles.toastSuccess : toastStyles.toastError, { opacity: fadeAnim }]}>
      <Ionicons name={type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={24} color="#fff" />
      <Text style={toastStyles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    zIndex: 1000,
  },
  toastSuccess: {
    backgroundColor: '#27ae60',
  },
  toastError: {
    backgroundColor: '#e74c3c',
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
});

export default function UnpaidOrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const customerId = params.customerId as string;
  const customerName = params.customerName as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const loadUnpaidOrders = useCallback(async () => {
    if (!customerId) {
      router.back();
      return;
    }
    
    try {
      setIsLoading(true);
      const orders = await customersApi.getUnpaidOrders(customerId);
      setUnpaidOrders(orders);
    } catch (error) {
      console.error('Error loading unpaid orders:', error);
      showToast('Errore nel caricamento ordini', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadUnpaidOrders();
  }, [loadUnpaidOrders]);

  const handlePayOrder = async (order: Order) => {
    try {
      await ordersApi.updatePayment(order.id, true);
      const updatedUnpaid = unpaidOrders.filter(o => o.id !== order.id);
      setUnpaidOrders(updatedUnpaid);
      showToast(`Ordine #${order.orderNumber} pagato`);
      
      // If detail modal was open, close it
      if (selectedOrder?.id === order.id) {
        setShowDetailModal(false);
        setSelectedOrder(null);
      }
      
      // If no more unpaid orders, go back
      if (updatedUnpaid.length === 0) {
        setTimeout(() => router.back(), 500);
      }
    } catch (error) {
      console.error('Error paying order:', error);
      showToast('Errore nel pagamento', 'error');
    }
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedOrder(null);
    // We stay on this page - the UX fix!
  };

  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.total, 0);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Caricamento ordini...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} data-testid="unpaid-orders-screen">
      {/* Toast */}
      <Toast 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type} 
        onHide={() => setToast({ ...toast, visible: false })} 
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          data-testid="back-button"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Ordini Non Pagati</Text>
          <Text style={styles.headerSubtitle}>{customerName}</Text>
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Ordini</Text>
          <Text style={styles.summaryValue}>{unpaidOrders.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Totale Debito</Text>
          <Text style={styles.summaryValueBig}>{totalDebt.toFixed(2)} EUR</Text>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView style={styles.ordersList} data-testid="unpaid-orders-list">
        {unpaidOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#27ae60" />
            <Text style={styles.emptyStateText}>Nessun ordine non pagato</Text>
            <Text style={styles.emptyStateSubtext}>Tutti gli ordini sono stati saldati</Text>
          </View>
        ) : (
          unpaidOrders.map((order) => (
            <TouchableOpacity 
              key={order.id}
              style={styles.orderCard}
              onPress={() => openOrderDetail(order)}
              data-testid={`order-card-${order.orderNumber}`}
            >
              <View style={styles.orderCardHeader}>
                <View style={styles.orderCardHeaderLeft}>
                  <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] }]}>
                    <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
                  </View>
                </View>
                <Text style={styles.orderTotal}>{order.total.toFixed(2)} EUR</Text>
              </View>
              
              <View style={styles.orderCardBody}>
                <View style={styles.orderInfoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#8892b0" />
                  <Text style={styles.orderInfoText}>
                    {new Date(order.menuDate).toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </Text>
                </View>
                <View style={styles.orderInfoRow}>
                  <Ionicons name="restaurant-outline" size={16} color="#8892b0" />
                  <Text style={styles.orderInfoText}>
                    {order.items.length} piatt{order.items.length === 1 ? 'o' : 'i'}
                  </Text>
                </View>
              </View>

              <View style={styles.orderCardActions}>
                <TouchableOpacity 
                  style={styles.viewButton}
                  onPress={() => openOrderDetail(order)}
                >
                  <Ionicons name="eye-outline" size={18} color="#3498db" />
                  <Text style={styles.viewButtonText}>Dettagli</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.payButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePayOrder(order);
                  }}
                  data-testid={`pay-button-${order.orderNumber}`}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.payButtonText}>Paga</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal 
        visible={showDetailModal} 
        animationType="slide"
        onRequestClose={closeDetailModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={closeDetailModal}
              data-testid="close-detail-modal"
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Ordine #{selectedOrder?.orderNumber}</Text>
              {selectedOrder && (
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedOrder.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[selectedOrder.status]}</Text>
                </View>
              )}
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent}>
            {selectedOrder && (
              <>
                {/* Order Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Informazioni Ordine</Text>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#8892b0" />
                    <Text style={styles.detailText}>
                      {new Date(selectedOrder.menuDate).toLocaleDateString('it-IT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={18} color="#8892b0" />
                    <Text style={styles.detailText}>
                      {new Date(selectedOrder.createdAt).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  {selectedOrder.channel && (
                    <View style={styles.detailRow}>
                      <Ionicons 
                        name={selectedOrder.channel === 'whatsapp' ? 'logo-whatsapp' : selectedOrder.channel === 'telefono' ? 'call' : 'person'} 
                        size={18} 
                        color="#8892b0" 
                      />
                      <Text style={styles.detailText}>
                        {selectedOrder.channel === 'whatsapp' ? 'WhatsApp' : selectedOrder.channel === 'telefono' ? 'Telefono' : 'Di Persona'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Order Items */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Piatti Ordinati</Text>
                  {selectedOrder.items.map((item, index) => (
                    <View key={`item-${index}`} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.dishName}</Text>
                        <Text style={styles.itemQty}>x{item.quantity}</Text>
                      </View>
                      <Text style={styles.itemPrice}>{item.subtotal.toFixed(2)} EUR</Text>
                    </View>
                  ))}
                </View>

                {/* Total */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>TOTALE</Text>
                  <Text style={styles.totalValue}>{selectedOrder.total.toFixed(2)} EUR</Text>
                </View>

                {/* Notes */}
                {selectedOrder.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Note</Text>
                    <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                  </View>
                )}

                {/* Pay Button */}
                <TouchableOpacity 
                  style={styles.payFullButton}
                  onPress={() => handlePayOrder(selectedOrder)}
                  data-testid="pay-order-detail-button"
                >
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.payFullButtonText}>Segna come Pagato</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e94560',
    marginTop: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#8892b0',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryValueBig: {
    color: '#e94560',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#0f3460',
    marginHorizontal: 16,
  },
  ordersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#8892b0',
    fontSize: 14,
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e94560',
  },
  orderCardBody: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderInfoText: {
    color: '#8892b0',
    fontSize: 13,
  },
  orderCardActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    paddingTop: 12,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
  },
  viewButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#27ae60',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8892b0',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  detailText: {
    color: '#fff',
    fontSize: 15,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  itemName: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  itemQty: {
    color: '#8892b0',
    fontSize: 14,
  },
  itemPrice: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560',
  },
  notesText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  payFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  payFullButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
