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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { ordersApi, menusApi, customersApi, categoriesApi } from '../../src/services/api';
import { Order, MenuItem, Customer, Category } from '../../src/types';

const CHANNELS = [
  { id: 'persona', label: 'Di Persona', icon: 'person' },
  { id: 'telefono', label: 'Telefono', icon: 'call' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
];

const STATUS_COLORS: Record<string, string> = {
  in_attesa: '#f39c12',
  in_preparazione: '#3498db',
  pronto: '#27ae60',
  sospeso: '#e74c3c',
};

const STATUS_LABELS: Record<string, string> = {
  in_attesa: 'Attesa',
  in_preparazione: 'Preparazione',
  pronto: 'Pronto',
  sospeso: 'Sospeso',
};

const ORDER_STATUSES = ['in_attesa', 'in_preparazione', 'pronto', 'sospeso'];

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

export default function OrdersScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  
  const { selectedDate, setSelectedDate, currentMenu, setCurrentMenu, orders, setOrders, customers, setCustomers } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Categories for filter
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };
  const [newOrderChannel, setNewOrderChannel] = useState('persona');
  const [newOrderCustomer, setNewOrderCustomer] = useState<Customer | null>(null);
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState('1');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  
  // Status filter for orders
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Generate PDF for order
  const handlePrintOrder = (order: Order, e?: any) => {
    // Prevent event bubbling if called from card button
    if (e) {
      e.stopPropagation();
    }
    
    const customer = customers.find(c => c.id === order.customerId);
    
    const pdfContent = `
      <html>
        <head>
          <title>Ordine #${order.orderNumber}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            h1 { font-size: 24px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .customer-info { margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .customer-info p { margin: 8px 0; font-size: 14px; }
            .customer-info strong { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #333; color: white; font-size: 12px; text-transform: uppercase; }
            td { font-size: 14px; }
            .total { font-size: 22px; font-weight: bold; text-align: right; margin-top: 20px; padding-top: 15px; border-top: 3px solid #000; }
            .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; }
            .print-btn { display: block; width: 100%; padding: 15px; margin-top: 20px; background: #e94560; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
            .print-btn:hover { background: #d63850; }
            @media print { .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <h1>ORDINE #${order.orderNumber}</h1>
          
          <div class="customer-info">
            <p><strong>Cliente:</strong> ${order.customerName || 'Cliente Anonimo'}</p>
            ${customer?.address ? `<p><strong>Indirizzo:</strong> ${customer.address}</p>` : ''}
            ${customer?.phone ? `<p><strong>Telefono:</strong> ${customer.phone}</p>` : ''}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Piatto</th>
                <th style="text-align:center">Qtà</th>
                <th style="text-align:right">Prezzo</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.dishName}</td>
                  <td style="text-align:center">${item.quantity}</td>
                  <td style="text-align:right">${item.subtotal.toFixed(2)} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">TOTALE: ${order.total.toFixed(2)} €</div>
          
          <div class="footer">
            <p>Data: ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          
          <button class="print-btn" onclick="window.print()">Stampa / Salva PDF</button>
        </body>
      </html>
    `;
    
    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.document.write(pdfContent);
      pdfWindow.document.close();
    } else {
      showToast('Abilita i popup per scaricare il PDF', 'error');
    }
  };

  // Filter orders by status
  const filteredOrders = statusFilter 
    ? orders.filter(o => o.status === statusFilter)
    : orders;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load categories
      try {
        const categoriesData = await categoriesApi.getAll();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
      
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
      showToast('Impossibile caricare i dati', 'error');
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
      showToast('Nessun menu disponibile per questa data', 'error');
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
      showToast('Ordine creato');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile creare l\'ordine', 'error');
    }
  };

  const handleAddItem = async () => {
    if (!selectedOrder || !selectedMenuItem) return;
    
    const qty = parseInt(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Quantità non valida', 'error');
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
      showToast('Piatto aggiunto');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiungere il piatto', 'error');
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
      showToast('Piatto rimosso');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile rimuovere il piatto', 'error');
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const updatedOrder = await ordersApi.updateStatus(orderId, status);
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updatedOrder);
      }
      
      // Refresh menu if status changed to/from annullato
      if (status === 'annullato' || selectedOrder?.status === 'annullato') {
        const menu = await menusApi.getByDate(selectedDate);
        setCurrentMenu(menu);
      }
      showToast(`Stato: ${STATUS_LABELS[status]}`);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiornare lo stato', 'error');
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
      {/* Toast */}
      <Toast 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type} 
        onHide={() => setToast({ ...toast, visible: false })} 
      />

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

      {/* Stats Bar - Filterable Counters */}
      <View style={styles.statsBar}>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === null && styles.filterStatItemActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.statValue, statusFilter === null && styles.statValueActive]}>{orders.length}</Text>
          <Text style={[styles.statLabel, statusFilter === null && styles.statLabelActive]}>Tutti</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === 'in_attesa' && styles.filterStatItemActive, { borderLeftColor: STATUS_COLORS.in_attesa }]}
          onPress={() => setStatusFilter(statusFilter === 'in_attesa' ? null : 'in_attesa')}
        >
          <Text style={[styles.statValue, { color: STATUS_COLORS.in_attesa }]}>
            {orders.filter(o => o.status === 'in_attesa').length}
          </Text>
          <Text style={styles.statLabel}>Attesa</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === 'in_preparazione' && styles.filterStatItemActive, { borderLeftColor: STATUS_COLORS.in_preparazione }]}
          onPress={() => setStatusFilter(statusFilter === 'in_preparazione' ? null : 'in_preparazione')}
        >
          <Text style={[styles.statValue, { color: STATUS_COLORS.in_preparazione }]}>
            {orders.filter(o => o.status === 'in_preparazione').length}
          </Text>
          <Text style={styles.statLabel}>Preparaz.</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === 'pronto' && styles.filterStatItemActive, { borderLeftColor: STATUS_COLORS.pronto }]}
          onPress={() => setStatusFilter(statusFilter === 'pronto' ? null : 'pronto')}
        >
          <Text style={[styles.statValue, { color: STATUS_COLORS.pronto }]}>
            {orders.filter(o => o.status === 'pronto').length}
          </Text>
          <Text style={styles.statLabel}>Pronto</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === 'sospeso' && styles.filterStatItemActive, { borderLeftColor: STATUS_COLORS.sospeso }]}
          onPress={() => setStatusFilter(statusFilter === 'sospeso' ? null : 'sospeso')}
        >
          <Text style={[styles.statValue, { color: STATUS_COLORS.sospeso }]}>
            {orders.filter(o => o.status === 'sospeso').length}
          </Text>
          <Text style={styles.statLabel}>Sospeso</Text>
        </TouchableOpacity>
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
              {filteredOrders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color="#8892b0" />
                  <Text style={styles.emptyStateText}>
                    {statusFilter ? `Nessun ordine ${STATUS_LABELS[statusFilter]}` : 'Nessun ordine'}
                  </Text>
                </View>
              ) : (
                filteredOrders.map((order) => (
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
              <TouchableOpacity onPress={() => {
                setShowCustomerPicker(false);
                setCustomerSearchQuery('');
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#8892b0" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                placeholder="Cerca cliente per nome..."
                placeholderTextColor="#8892b0"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerSearchQuery('')} style={styles.clearSearchButton}>
                  <Ionicons name="close-circle" size={20} color="#8892b0" />
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.customerList}>
              <TouchableOpacity
                style={styles.customerItem}
                onPress={() => {
                  setNewOrderCustomer(null);
                  setShowCustomerPicker(false);
                  setCustomerSearchQuery('');
                }}
              >
                <Text style={styles.customerItemText}>Nessun cliente</Text>
              </TouchableOpacity>
              {customers
                .filter(customer => 
                  customerSearchQuery.trim() === '' || 
                  customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                  (customer.phone && customer.phone.includes(customerSearchQuery))
                )
                .map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={styles.customerItem}
                    onPress={() => {
                      setNewOrderCustomer(customer);
                      setShowCustomerPicker(false);
                      setCustomerSearchQuery('');
                    }}
                  >
                    <Text style={styles.customerItemText}>{customer.name}</Text>
                    {customer.phone && (
                      <Text style={styles.customerItemSubtext}>{customer.phone}</Text>
                    )}
                  </TouchableOpacity>
                ))
              }
              {customers.filter(customer => 
                customerSearchQuery.trim() === '' || 
                customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                (customer.phone && customer.phone.includes(customerSearchQuery))
              ).length === 0 && customerSearchQuery.trim() !== '' && (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="person-outline" size={40} color="#8892b0" />
                  <Text style={styles.noResultsText}>Nessun cliente trovato</Text>
                  <Text style={styles.noResultsSubtext}>Prova con un altro termine di ricerca</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={showAddItemModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.fullScreenModal}>
          <View style={styles.fullScreenModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalTitle}>
                  Ordine #{selectedOrder?.orderNumber}
                </Text>
                {selectedOrder?.customerName && (
                  <Text style={styles.modalCustomerName}>{selectedOrder.customerName}</Text>
                )}
              </View>
              <View style={styles.modalHeaderActions}>
                {selectedOrder && (
                  <TouchableOpacity 
                    style={styles.printButton}
                    onPress={() => handlePrintOrder(selectedOrder)}
                  >
                    <Ionicons name="print" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
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
            </View>

            <ScrollView 
              style={styles.modalScrollContent} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={[styles.modalScrollContentContainer, selectedMenuItem && styles.modalScrollWithFooter]}
            >
              {/* Order Summary Section - NOW FIRST */}
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
                      {selectedOrder?.status !== 'annullato' && (
                        <TouchableOpacity
                          style={styles.removeItemButton}
                          onPress={() => handleRemoveItem(item.dishId)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}

                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>TOTALE</Text>
                  <Text style={styles.orderTotalValue}>
                    {selectedOrder?.total.toFixed(2)} €
                  </Text>
                </View>

                {/* Status Section */}
                {selectedOrder && (
                  <View style={styles.statusSection}>
                    <Text style={styles.statusSectionTitle}>Stato Ordine</Text>
                    <View style={[styles.currentStatusBadge, { backgroundColor: STATUS_COLORS[selectedOrder.status] }]}>
                      <Text style={styles.currentStatusText}>{STATUS_LABELS[selectedOrder.status]}</Text>
                    </View>
                    
                    <Text style={styles.changeStatusLabel}>Cambia stato:</Text>
                    <View style={styles.statusButtonsGrid}>
                      {ORDER_STATUSES.filter(s => s !== selectedOrder.status).map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[styles.statusGridButton, { backgroundColor: STATUS_COLORS[status] }]}
                          onPress={() => handleUpdateStatus(selectedOrder.id, status)}
                        >
                          <Text style={styles.statusGridButtonText}>{STATUS_LABELS[status]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Menu Items Section - NOW SECOND */}
              {selectedOrder?.status !== 'annullato' && (
                <View style={styles.mobileSectionCard}>
                  <Text style={styles.sectionTitle}>Aggiungi dal Menu del Giorno</Text>
                  <Text style={styles.sectionSubtitle}>Tocca un piatto per selezionarlo</Text>
                  
                  {/* Category Filter */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.menuCategoryFilter}>
                    <TouchableOpacity
                      style={[styles.menuCategoryChip, !selectedCategoryFilter && styles.menuCategoryChipActive]}
                      onPress={() => setSelectedCategoryFilter(null)}
                    >
                      <Text style={[styles.menuCategoryChipText, !selectedCategoryFilter && styles.menuCategoryChipTextActive]}>
                        Tutte
                      </Text>
                    </TouchableOpacity>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[styles.menuCategoryChip, selectedCategoryFilter === category.id && styles.menuCategoryChipActive]}
                        onPress={() => setSelectedCategoryFilter(selectedCategoryFilter === category.id ? null : category.id)}
                      >
                        <Text style={[styles.menuCategoryChipText, selectedCategoryFilter === category.id && styles.menuCategoryChipTextActive]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {(() => {
                    // Filter menu items by selected category
                    const filteredItems = currentMenu?.items.filter(item => 
                      !selectedCategoryFilter || item.categoryId === selectedCategoryFilter
                    ) || [];
                    
                    // Group filtered items by category
                    const groupedItems = filteredItems.reduce((acc, item) => {
                      const catName = item.categoryName || 'Altro';
                      if (!acc[catName]) acc[catName] = [];
                      acc[catName].push(item);
                      return acc;
                    }, {} as Record<string, typeof filteredItems>);
                    
                    if (filteredItems.length === 0) {
                      return (
                        <Text style={styles.emptyMenuText}>Nessun piatto disponibile</Text>
                      );
                    }
                    
                    return Object.entries(groupedItems).map(([categoryName, items]) => (
                      <View key={categoryName}>
                        <Text style={styles.menuCategoryTitle}>{categoryName}</Text>
                        {items.map((item, index) => (
                          <TouchableOpacity
                            key={`menu-${item.dishId}-${index}`}
                            style={[
                              styles.menuItemCard,
                              selectedMenuItem?.dishId === item.dishId && styles.menuItemCardSelected,
                              item.portions === 0 && styles.menuItemCardDisabled,
                            ]}
                            onPress={() => item.portions > 0 && setSelectedMenuItem(
                              selectedMenuItem?.dishId === item.dishId ? null : item
                            )}
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
                            {selectedMenuItem?.dishId === item.dishId && (
                              <View style={styles.selectedCheckmark}>
                                <Ionicons name="checkmark-circle" size={24} color="#27ae60" />
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ));
                  })()}
                </View>
              )}
            </ScrollView>

            {/* FIXED FOOTER - Appears when item is selected */}
            {selectedMenuItem && selectedOrder?.status !== 'annullato' && (
              <View style={styles.fixedFooter}>
                <View style={styles.footerSelectedItem}>
                  <Text style={styles.footerItemName} numberOfLines={1}>
                    {selectedMenuItem.dishName}
                  </Text>
                  <Text style={styles.footerItemPrice}>
                    {selectedMenuItem.dailyPrice.toFixed(2)} €
                  </Text>
                </View>
                <View style={styles.footerControls}>
                  <View style={styles.footerQuantityRow}>
                    <TouchableOpacity
                      style={styles.footerQuantityButton}
                      onPress={() => setItemQuantity(Math.max(1, parseInt(itemQuantity) - 1).toString())}
                    >
                      <Ionicons name="remove" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.footerQuantityInput}
                      value={itemQuantity}
                      onChangeText={setItemQuantity}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={styles.footerQuantityButton}
                      onPress={() => setItemQuantity((parseInt(itemQuantity) + 1).toString())}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.footerAddButton} onPress={handleAddItem}>
                    <Ionicons name="add-circle" size={22} color="#fff" />
                    <Text style={styles.footerAddButtonText}>Aggiungi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  statValueActive: {
    color: '#e94560',
  },
  statLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  statLabelActive: {
    color: '#fff',
  },
  filterStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  filterStatItemActive: {
    backgroundColor: '#0f3460',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 8,
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
  mobileModalOverlay: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  fullScreenModalContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
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
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    padding: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#1a1a2e',
  },
  modalScrollContent: {
    flex: 1,
  },
  modalScrollContentContainer: {
    paddingBottom: 100,
  },
  closeButton: {
    padding: 10,
    backgroundColor: '#e94560',
    borderRadius: 25,
  },
  mobileSectionCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  emptyOrderText: {
    color: '#8892b0',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  statusButtonsVertical: {
    marginTop: 16,
    gap: 10,
  },
  statusButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCustomerName: {
    fontSize: 14,
    color: '#e94560',
    marginTop: 4,
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
  menuCategoryFilter: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  menuCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#0f3460',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  menuCategoryChipActive: {
    backgroundColor: '#e94560',
  },
  menuCategoryChipText: {
    color: '#8892b0',
    fontSize: 13,
    fontWeight: '500',
  },
  menuCategoryChipTextActive: {
    color: '#fff',
  },
  emptyMenuText: {
    color: '#8892b0',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  menuCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e94560',
    marginTop: 12,
    marginBottom: 8,
    paddingLeft: 4,
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
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  selectedItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  quantityButton: {
    backgroundColor: '#e94560',
    width: 48,
    height: 48,
    borderRadius: 24,
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
    padding: 14,
    borderRadius: 10,
    marginTop: 0,
  },
  addItemButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 15,
  },
  orderItemsList: {
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
  statusSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  statusSectionTitle: {
    color: '#8892b0',
    fontSize: 14,
    marginBottom: 10,
  },
  currentStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  currentStatusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeStatusLabel: {
    color: '#8892b0',
    fontSize: 13,
    marginBottom: 10,
  },
  statusButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusGridButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
  },
  statusGridButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
  sectionSubtitle: {
    color: '#8892b0',
    fontSize: 13,
    marginBottom: 12,
    marginTop: -8,
  },
  modalScrollWithFooter: {
    paddingBottom: 180,
  },
  selectedCheckmark: {
    marginLeft: 8,
  },
  fixedFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16213e',
    borderTopWidth: 2,
    borderTopColor: '#e94560',
    padding: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  footerSelectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  footerItemName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
  },
  footerItemPrice: {
    color: '#27ae60',
    fontSize: 18,
    fontWeight: '700',
  },
  footerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerQuantityButton: {
    backgroundColor: '#e94560',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerQuantityInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 56,
    height: 44,
    borderRadius: 10,
  },
  footerAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 48,
  },
  footerAddButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 14,
  },
  clearSearchButton: {
    padding: 4,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    color: '#8892b0',
    fontSize: 16,
    marginTop: 12,
  },
  noResultsSubtext: {
    color: '#5a6078',
    fontSize: 14,
    marginTop: 4,
  },
});
