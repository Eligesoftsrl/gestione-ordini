import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { ordersApi, menusApi, customersApi } from '../../src/services/api';
import { Order, MenuItem, Customer } from '../../src/types';

const CHANNELS = [
  { id: 'persona', label: 'Di Persona', icon: 'person' },
  { id: 'telefono', label: 'Telefono', icon: 'call' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
];

const STATUS_COLORS: Record<string, string> = {
  in_attesa: '#f39c12',
  completato: '#27ae60',
  annullato: '#e74c3c',
};

const STATUS_LABELS: Record<string, string> = {
  in_attesa: 'In Attesa',
  completato: 'Completato',
  annullato: 'Annullato',
};

export default function OrdersScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  
  const { selectedDate, setSelectedDate, currentMenu, setCurrentMenu, orders, setOrders, customers, setCustomers } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderChannel, setNewOrderChannel] = useState('persona');
  const [newOrderCustomer, setNewOrderCustomer] = useState<Customer | null>(null);
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState('1');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load menu for selected date
      try {
        const menu = await menusApi.getByDate(selectedDate);
        setCurrentMenu(menu);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setCurrentMenu(null);
        } else {
          throw error;
        }
      }
      
      // Load orders for selected date
      const ordersData = await ordersApi.getAll(selectedDate);
      setOrders(ordersData);
      
      // Load customers
      const customersData = await customersApi.getAll();
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateOrder = async () => {
    if (!currentMenu) {
      Alert.alert('Errore', 'Nessun menu disponibile per questa data');
      return;
    }

    try {
      const order = await ordersApi.create(selectedDate, {
        channel: newOrderChannel,
        customerId: newOrderCustomer?.id,
        customerName: newOrderCustomer?.name,
        notes: newOrderNotes,
      });
      
      setOrders([order, ...orders]);
      setSelectedOrder(order);
      setShowNewOrderModal(false);
      setNewOrderChannel('persona');
      setNewOrderCustomer(null);
      setNewOrderNotes('');
      setShowAddItemModal(true);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile creare l\'ordine');
    }
  };

  const handleAddItem = async () => {
    if (!selectedOrder || !selectedMenuItem) return;
    
    const qty = parseInt(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Errore', 'Quantità non valida');
      return;
    }

    try {
      const updatedOrder = await ordersApi.addItem(selectedOrder.id, {
        dishId: selectedMenuItem.dishId,
        quantity: qty,
      });
      
      // Update orders list
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      
      // Refresh menu to get updated portions
      const menu = await menusApi.getByDate(selectedDate);
      setCurrentMenu(menu);
      
      setSelectedMenuItem(null);
      setItemQuantity('1');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile aggiungere il piatto');
    }
  };

  const handleRemoveItem = async (dishId: string) => {
    if (!selectedOrder) return;

    try {
      const updatedOrder = await ordersApi.removeItem(selectedOrder.id, dishId);
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      
      // Refresh menu
      const menu = await menusApi.getByDate(selectedDate);
      setCurrentMenu(menu);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile rimuovere il piatto');
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const updatedOrder = await ordersApi.updateStatus(orderId, status);
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updatedOrder);
      }
      
      // Refresh menu if order was cancelled
      if (status === 'annullato') {
        const menu = await menusApi.getByDate(selectedDate);
        setCurrentMenu(menu);
      }
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile aggiornare lo stato');
    }
  };

  const changeDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(format(currentDate, 'yyyy-MM-dd'));
  };

  const getTotalRevenue = () => {
    return orders
      .filter(o => o.status !== 'annullato')
      .reduce((sum, o) => sum + o.total, 0);
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
        <Text style={styles.headerTitle}>Gestione Ordini</Text>
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

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>Ordini</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {orders.filter(o => o.status === 'in_attesa').length}
          </Text>
          <Text style={styles.statLabel}>In Attesa</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#27ae60' }]}>
            {getTotalRevenue().toFixed(2)} €
          </Text>
          <Text style={styles.statLabel}>Incasso</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Orders List */}
        <View style={styles.ordersPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Ordini del Giorno</Text>
            <TouchableOpacity
              style={[styles.newOrderButton, !currentMenu && styles.disabledButton]}
              onPress={() => setShowNewOrderModal(true)}
              disabled={!currentMenu}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newOrderButtonText}>Nuovo Ordine</Text>
            </TouchableOpacity>
          </View>

          {!currentMenu ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#8892b0" />
              <Text style={styles.emptyStateText}>Nessun menu per questa data</Text>
              <Text style={styles.emptyStateSubtext}>Crea prima un menu giornaliero</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.ordersList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
              }
            >
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color="#8892b0" />
                  <Text style={styles.emptyStateText}>Nessun ordine</Text>
                </View>
              ) : (
                orders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    style={[
                      styles.orderCard,
                      selectedOrder?.id === order.id && styles.orderCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedOrder(order);
                      setShowAddItemModal(true);
                    }}
                  >
                    <View style={styles.orderCardHeader}>
                      <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] }]}>
                        <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
                      </View>
                    </View>
                    <View style={styles.orderCardBody}>
                      <View style={styles.orderInfo}>
                        <Ionicons
                          name={CHANNELS.find(c => c.id === order.channel)?.icon as any || 'person'}
                          size={16}
                          color="#8892b0"
                        />
                        <Text style={styles.orderInfoText}>
                          {CHANNELS.find(c => c.id === order.channel)?.label}
                        </Text>
                      </View>
                      {order.customerName && (
                        <Text style={styles.customerName}>{order.customerName}</Text>
                      )}
                      <Text style={styles.orderItems}>
                        {order.items.length} piatt{order.items.length === 1 ? 'o' : 'i'}
                      </Text>
                    </View>
                    <View style={styles.orderCardFooter}>
                      <Text style={styles.orderTotal}>{order.total.toFixed(2)} €</Text>
                      <Text style={styles.orderTime}>
                        {format(new Date(order.createdAt), 'HH:mm')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* New Order Modal */}
      <Modal visible={showNewOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Ordine</Text>
              <TouchableOpacity onPress={() => setShowNewOrderModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Canale</Text>
            <View style={styles.channelSelector}>
              {CHANNELS.map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={[
                    styles.channelButton,
                    newOrderChannel === channel.id && styles.channelButtonActive,
                  ]}
                  onPress={() => setNewOrderChannel(channel.id)}
                >
                  <Ionicons
                    name={channel.icon as any}
                    size={24}
                    color={newOrderChannel === channel.id ? '#fff' : '#8892b0'}
                  />
                  <Text
                    style={[
                      styles.channelButtonText,
                      newOrderChannel === channel.id && styles.channelButtonTextActive,
                    ]}
                  >
                    {channel.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Cliente (opzionale)</Text>
            <TouchableOpacity
              style={styles.customerSelector}
              onPress={() => setShowCustomerPicker(true)}
            >
              <Text style={styles.customerSelectorText}>
                {newOrderCustomer ? newOrderCustomer.name : 'Seleziona cliente...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8892b0" />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.textInput}
              value={newOrderNotes}
              onChangeText={setNewOrderNotes}
              placeholder="Note ordine..."
              placeholderTextColor="#8892b0"
              multiline
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateOrder}>
              <Text style={styles.primaryButtonText}>Crea Ordine</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona Cliente</Text>
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.customerList}>
              <TouchableOpacity
                style={styles.customerItem}
                onPress={() => {
                  setNewOrderCustomer(null);
                  setShowCustomerPicker(false);
                }}
              >
                <Text style={styles.customerItemText}>Nessun cliente</Text>
              </TouchableOpacity>
              {customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={styles.customerItem}
                  onPress={() => {
                    setNewOrderCustomer(customer);
                    setShowCustomerPicker(false);
                  }}
                >
                  <Text style={styles.customerItemText}>{customer.name}</Text>
                  {customer.phone && (
                    <Text style={styles.customerItemSubtext}>{customer.phone}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={showAddItemModal} animationType="slide" transparent={!isSmallScreen}>
        <SafeAreaView style={[styles.modalOverlay, isSmallScreen && styles.mobileModalOverlay]}>
          <View style={[styles.modalContent, isSmallScreen ? styles.mobileModal : styles.largeModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Ordine #{selectedOrder?.orderNumber}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowAddItemModal(false);
                  setSelectedOrder(null);
                  setSelectedMenuItem(null);
                }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollContent} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.modalScrollContentContainer}
            >
              {/* Menu Items Section */}
              <View style={styles.mobileSectionCard}>
                <Text style={styles.sectionTitle}>Menu del Giorno</Text>
                {currentMenu?.items.map((item, index) => (
                  <TouchableOpacity
                    key={`menu-${item.dishId}-${index}`}
                    style={[
                      styles.menuItemCard,
                      selectedMenuItem?.dishId === item.dishId && styles.menuItemCardSelected,
                      item.portions === 0 && styles.menuItemCardDisabled,
                    ]}
                    onPress={() => item.portions > 0 && setSelectedMenuItem(item)}
                    disabled={item.portions === 0}
                  >
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName}>{item.dishName}</Text>
                      <Text style={styles.menuItemPrice}>{item.dailyPrice.toFixed(2)} €</Text>
                    </View>
                    <View style={[
                      styles.portionsBadge,
                      item.portions === 0 && styles.portionsBadgeEmpty,
                      item.portions > 0 && item.portions <= 3 && styles.portionsBadgeLow,
                    ]}>
                      <Text style={styles.portionsText}>
                        {item.portions === 0 ? 'Esaurito' : `${item.portions} porz.`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {selectedMenuItem && (
                  <View style={styles.addItemForm}>
                    <Text style={styles.selectedItemText}>
                      {selectedMenuItem.dishName} - {selectedMenuItem.dailyPrice.toFixed(2)} €
                    </Text>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setItemQuantity(Math.max(1, parseInt(itemQuantity) - 1).toString())}
                      >
                        <Ionicons name="remove" size={24} color="#fff" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.quantityInput}
                        value={itemQuantity}
                        onChangeText={setItemQuantity}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setItemQuantity((parseInt(itemQuantity) + 1).toString())}
                      >
                        <Ionicons name="add" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
                      <Ionicons name="add-circle" size={20} color="#fff" />
                      <Text style={styles.addItemButtonText}>Aggiungi all'ordine</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Order Summary Section */}
              <View style={styles.mobileSectionCard}>
                <Text style={styles.sectionTitle}>Riepilogo Ordine</Text>
                {selectedOrder?.items.length === 0 ? (
                  <Text style={styles.emptyOrderText}>Nessun piatto nell'ordine</Text>
                ) : (
                  selectedOrder?.items.map((item, index) => (
                    <View key={`order-${item.dishId}-${index}`} style={styles.orderItemRow}>
                      <View style={styles.orderItemInfo}>
                        <Text style={styles.orderItemName}>{item.dishName}</Text>
                        <Text style={styles.orderItemDetails}>
                          {item.quantity} x {item.unitPrice.toFixed(2)} €
                        </Text>
                      </View>
                      <Text style={styles.orderItemSubtotal}>{item.subtotal.toFixed(2)} €</Text>
                      <TouchableOpacity
                        style={styles.removeItemButton}
                        onPress={() => handleRemoveItem(item.dishId)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>TOTALE</Text>
                  <Text style={styles.orderTotalValue}>
                    {selectedOrder?.total.toFixed(2)} €
                  </Text>
                </View>

                {selectedOrder?.status === 'in_attesa' && selectedOrder?.items.length > 0 && (
                  <View style={styles.statusButtonsVertical}>
                    <TouchableOpacity
                      style={[styles.statusButtonFull, { backgroundColor: '#27ae60' }]}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'completato')}
                    >
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                      <Text style={styles.statusButtonText}>Completa Ordine</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusButtonFull, { backgroundColor: '#e74c3c' }]}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'annullato')}
                    >
                      <Ionicons name="close-circle" size={22} color="#fff" />
                      <Text style={styles.statusButtonText}>Annulla Ordine</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
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
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  ordersPanel: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  newOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#4a4a5a',
  },
  newOrderButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  ordersList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#8892b0',
    fontSize: 16,
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#5a6078',
    fontSize: 14,
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  orderCardSelected: {
    borderColor: '#e94560',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderCardBody: {
    marginBottom: 10,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderInfoText: {
    color: '#8892b0',
    marginLeft: 8,
    fontSize: 14,
  },
  customerName: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  orderItems: {
    color: '#8892b0',
    fontSize: 13,
    marginTop: 4,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    paddingTop: 10,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  orderTime: {
    color: '#8892b0',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  largeModal: {
    maxWidth: 900,
    width: '95%',
    maxHeight: '90%',
  },
  mobileModal: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '95%',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: 'auto',
  },
  modalScrollContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputLabel: {
    color: '#8892b0',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  channelSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  channelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  channelButtonActive: {
    borderColor: '#e94560',
    backgroundColor: '#e9456020',
  },
  channelButtonText: {
    color: '#8892b0',
    marginTop: 8,
    fontSize: 12,
  },
  channelButtonTextActive: {
    color: '#fff',
  },
  customerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
  },
  customerSelectorText: {
    color: '#fff',
    fontSize: 15,
  },
  textInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    minHeight: 60,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  customerList: {
    maxHeight: 400,
  },
  customerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  customerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  customerItemSubtext: {
    color: '#8892b0',
    fontSize: 13,
    marginTop: 4,
  },
  orderDetailContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  orderDetailContainerMobile: {
    flexDirection: 'column',
    gap: 16,
  },
  menuItemsSection: {
    flex: 1,
  },
  menuItemsSectionMobile: {
    flex: 0,
    minHeight: 200,
  },
  orderSummarySection: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  orderSummarySectionMobile: {
    flex: 0,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  menuItemsList: {
    flex: 1,
  },
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menuItemCardSelected: {
    borderColor: '#e94560',
  },
  menuItemCardDisabled: {
    opacity: 0.5,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemPrice: {
    color: '#27ae60',
    fontSize: 14,
    marginTop: 4,
  },
  portionsBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  portionsBadgeEmpty: {
    backgroundColor: '#e74c3c',
  },
  portionsBadgeLow: {
    backgroundColor: '#f39c12',
  },
  portionsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addItemForm: {
    backgroundColor: '#0f3460',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
  },
  selectedItemText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  quantityButton: {
    backgroundColor: '#e94560',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 60,
    height: 44,
    borderRadius: 10,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  addItemButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  orderItemsList: {
    flex: 1,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    color: '#fff',
    fontSize: 14,
  },
  orderItemDetails: {
    color: '#8892b0',
    fontSize: 12,
    marginTop: 2,
  },
  orderItemSubtotal: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  removeItemButton: {
    padding: 8,
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#0f3460',
  },
  orderTotalLabel: {
    color: '#8892b0',
    fontSize: 16,
    fontWeight: '600',
  },
  orderTotalValue: {
    color: '#27ae60',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statusButtonsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
  },
  statusButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
