import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { ordersApi, menusApi, customersApi, categoriesApi } from '../../src/services/api';
import { Order, MenuItem, Customer, Category } from '../../src/types';
import { sortCategoriesByFixedOrder, sortMenuItemsByCategory } from '../../src/utils/categoryOrder';
import { TimePickerInline } from '../../src/components/TimePickerInline';

const CHANNELS = [
  { id: 'persona', label: 'Di Persona', icon: 'person' },
  { id: 'telefono', label: 'Telefono', icon: 'call' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
];

const STATUS_COLORS: Record<string, string> = {
  in_attesa: '#FFBC0D',
  in_preparazione: '#3498db',
  pronto: '#00754A',
  sospeso: '#DB0007',
  consegnato: '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
  in_attesa: 'Attesa',
  in_preparazione: 'Preparazione',
  pronto: 'Pronto',
  sospeso: 'Sospeso',
  consegnato: 'Consegnato',
};

// Stati per cambio automatico (escluso "consegnato" che è solo manuale)
const ORDER_STATUSES = ['in_attesa', 'in_preparazione', 'pronto', 'sospeso'];
// Tutti gli stati incluso consegnato (per filtri)
const ALL_ORDER_STATUSES = ['in_attesa', 'in_preparazione', 'pronto', 'sospeso', 'consegnato'];

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
      <Ionicons name={type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={24} color="#1a202c" />
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
    backgroundColor: '#00754A',
  },
  toastError: {
    backgroundColor: '#DB0007',
  },
  toastText: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
});

export default function OrdersScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const router = useRouter();
  
  const { selectedDate, setSelectedDate, currentMenu, setCurrentMenu, orders, setOrders, customers, setCustomers } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Categories for filter
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Search orders by customer name
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  
  // Sort categories by fixed order
  const sortedCategories = useMemo(() => sortCategoriesByFixedOrder(categories), [categories]);
  
  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };
  const [newOrderChannel, setNewOrderChannel] = useState('persona');
  const [newOrderServiceType, setNewOrderServiceType] = useState<'in_sede' | 'da_ritirare' | 'da_consegnare'>('in_sede');
  const [newOrderCustomer, setNewOrderCustomer] = useState<Customer | null>(null);
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [newOrderDeliveryTime, setNewOrderDeliveryTime] = useState('');
  // Inline time picker visibility
  const [showNewOrderTimePicker, setShowNewOrderTimePicker] = useState(false);
  const [showEditOrderTimePicker, setShowEditOrderTimePicker] = useState(false);
  // Inline editing of order header (customer, notes, deliveryTime, serviceType)
  const [editOrderHeader, setEditOrderHeader] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editOrderNotes, setEditOrderNotes] = useState('');
  const [editOrderDeliveryTime, setEditOrderDeliveryTime] = useState('');
  const [editOrderServiceType, setEditOrderServiceType] = useState<'in_sede' | 'da_ritirare' | 'da_consegnare'>('in_sede');
  const [editShowCustomerPicker, setEditShowCustomerPicker] = useState(false);
  const [editCustomerSearchQuery, setEditCustomerSearchQuery] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemCustomPrice, setItemCustomPrice] = useState<string>(''); // Prezzo personalizzato
  const [itemNotes, setItemNotes] = useState(''); // Note per singola voce
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showInlineCustomerPicker, setShowInlineCustomerPicker] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  
  // Piatto libero - inline mode
  const [showInlineCustomItem, setShowInlineCustomItem] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQuantity, setCustomItemQuantity] = useState('1');
  
  // Status filter for orders
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // OP06: Portions dashboard modal
  const [showPortionsModal, setShowPortionsModal] = useState(false);

  // Unpaid orders warning
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);

  // Check for unpaid orders when customer is selected
  const checkUnpaidOrders = async (customerId: string) => {
    try {
      const unpaid = await customersApi.getUnpaidOrders(customerId);
      if (unpaid.length > 0) {
        setUnpaidOrders(unpaid);
      } else {
        setUnpaidOrders([]);
      }
    } catch (error) {
      console.error('Error checking unpaid orders:', error);
    }
  };

  // Handle payment toggle
  const handleTogglePayment = async (order: Order) => {
    try {
      const updated = await ordersApi.updatePayment(order.id, !order.isPaid);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      showToast(updated.isPaid ? 'Ordine segnato come pagato' : 'Ordine segnato come non pagato');
    } catch (error) {
      console.error('Error updating payment:', error);
      showToast('Errore nell\'aggiornare lo stato pagamento', 'error');
    }
  };

  // Handle item status change
  const handleItemStatusChange = async (orderId: string, itemIndex: number, newStatus: string) => {
    try {
      const updated = await ordersApi.updateItemStatusByIndex(orderId, itemIndex, newStatus);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      showToast('Errore nell\'aggiornare lo stato piatto', 'error');
    }
  };

  // Handle receipt photo capture
  const handleTakeReceiptPhoto = async () => {
    if (!selectedOrder) return;
    
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permesso fotocamera negato', 'error');
      return;
    }
    
    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0].base64) {
      try {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const updated = await ordersApi.uploadReceipt(selectedOrder.id, base64Image);
        setOrders(orders.map(o => o.id === updated.id ? updated : o));
        setSelectedOrder(updated);
        showToast('Scontrino allegato');
      } catch (error) {
        console.error('Error uploading receipt:', error);
        showToast('Errore nel caricare lo scontrino', 'error');
      }
    }
  };

  // Handle delete receipt
  const handleDeleteReceipt = async () => {
    if (!selectedOrder) return;
    
    try {
      const updated = await ordersApi.deleteReceipt(selectedOrder.id);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      setSelectedOrder(updated);
      showToast('Scontrino rimosso');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      showToast('Errore nel rimuovere lo scontrino', 'error');
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      await ordersApi.deleteOrder(selectedOrder.id);
      setOrders(orders.filter(o => o.id !== selectedOrder.id));
      setSelectedOrder(null);
      setShowAddItemModal(false);
      setShowDeleteConfirm(false);
      // Refresh menu to get updated portions
      const menu = await menusApi.getByDate(selectedDate);
      setCurrentMenu(menu);
      showToast('Ordine cancellato');
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('Errore nel cancellare l\'ordine', 'error');
    }
  };

  // State for receipt preview modal
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showInlineReceipt, setShowInlineReceipt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Generate PDF for order - works on both web and mobile
  const handlePrintOrder = async (order: Order, e?: any) => {
    // Prevent event bubbling if called from card button
    if (e) {
      e.stopPropagation();
    }
    
    const customer = customers.find(c => c.id === order.customerId);
    const itemCount = order.items.length;

    // Split: oltre 10 piatti → divide su più etichette (max 10 piatti per etichetta)
    const ITEMS_PER_LABEL = 10;
    const needsSplit = itemCount > ITEMS_PER_LABEL;
    const totalPages = needsSplit ? Math.ceil(itemCount / ITEMS_PER_LABEL) : 1;
    const itemPages: typeof order.items[] = [];
    for (let i = 0; i < totalPages; i++) {
      itemPages.push(order.items.slice(i * ITEMS_PER_LABEL, (i + 1) * ITEMS_PER_LABEL));
    }

    // Scala adattiva: riduce i font per stare in 100mm quando NON splittiamo
    // 1-5 piatti → 1.0, 6 → 0.92, 7-8 → 0.82, 9-10 → 0.72
    // Quando splittiamo, scale=1.0 perché ogni etichetta ha max 10 piatti
    const scale = needsSplit ? 1.0 :
      itemCount <= 5 ? 1.0 :
      itemCount === 6 ? 0.92 :
      itemCount <= 8 ? 0.82 :
      0.72;
    const fs = (pt: number) => (pt * scale).toFixed(2);
    const mm = (n: number) => (n * scale).toFixed(2);

    const channelLabel = CHANNELS.find(c => c.id === order.channel)?.label || 'Persona';
    const serviceLabel = order.serviceType === 'da_consegnare' ? 'DA CONSEGNARE' :
      order.serviceType === 'da_ritirare' ? 'DA RITIRARE' : 'IN SEDE';

    // Genera HTML di una singola etichetta
    const renderLabel = (items: typeof order.items, pageNum: number, isFirst: boolean, isLast: boolean) => `
      <div class="label" ${pageNum < totalPages ? 'style="page-break-after: always;"' : ''}>
        <h1>ORDINE #${order.orderNumber}${needsSplit ? ` (${pageNum}/${totalPages})` : ''}</h1>
        <p class="subtitle">${channelLabel} · ${serviceLabel}</p>
        <hr class="hr" />

        <div class="info">
          <p class="bold">${order.customerName || 'Cliente Anonimo'}</p>
          ${isFirst && customer?.address ? `<p>${customer.address}</p>` : ''}
          ${isFirst && customer?.phone ? `<p>Tel: ${customer.phone}</p>` : ''}
        </div>

        ${order.deliveryTime ? `<div class="delivery-time">ORA: ${order.deliveryTime}</div>` : ''}

        ${isFirst && order.notes ? `<div class="notes-box"><span class="bold">NOTE:</span> ${order.notes}</div>` : ''}

        <hr class="hr" />

        ${items.map(item => `
          <div class="item">
            <div class="item-row">
              <span class="item-name">${item.quantity}x ${item.dishName}</span>
              <span class="item-price">${item.subtotal.toFixed(2)}€</span>
            </div>
            ${item.notes ? `<div class="item-note">> ${item.notes}</div>` : ''}
          </div>
        `).join('')}

        ${isLast ? `
          <hr class="double" />
          <div class="total">TOT: ${order.total.toFixed(2)}€</div>
        ` : `
          <hr class="hr" />
          <p class="subtitle">— continua sull'etichetta ${pageNum + 1}/${totalPages} —</p>
        `}
      </div>
    `;

    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: 60mm auto;
              margin: 1.5mm 2mm 1.5mm 2mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            html, body {
              width: 56mm;
              margin: 0;
              padding: 0;
              page-break-inside: avoid;
              break-inside: avoid-page;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: ${fs(9)}pt;
              line-height: 1.2;
              color: #000;
              padding: 0;
            }
            * {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .label { page-break-inside: avoid; }
            .center { text-align: center; }
            .right  { text-align: right; }
            .bold   { font-weight: 700; }
            .hr     { border: 0; border-top: 1px dashed #000; margin: ${mm(1.5)}mm 0; }
            .double { border: 0; border-top: 1.5px solid #000; margin: ${mm(1.5)}mm 0; }
            h1 {
              font-size: ${fs(9)}pt;
              text-align: center;
              margin: 0 0 0.3mm 0;
              letter-spacing: 0.3px;
            }
            .subtitle {
              text-align: center;
              font-size: ${fs(6.5)}pt;
              margin: 0 0 0.5mm 0;
              line-height: 1.1;
              color: #333;
            }
            .info p {
              margin: 0.3mm 0;
              font-size: ${fs(8)}pt;
              word-wrap: break-word;
              line-height: 1.15;
            }
            .delivery-time {
              text-align: center;
              font-size: ${fs(11)}pt;
              font-weight: 700;
              margin: ${mm(1.5)}mm 0;
              padding: ${mm(0.8)}mm 0;
              border: 1px solid #000;
            }
            .notes-box {
              margin: ${mm(1)}mm 0;
              padding: ${mm(0.8)}mm;
              border: 1px dashed #000;
              font-size: ${fs(7.5)}pt;
              word-wrap: break-word;
              line-height: 1.2;
            }
            .item {
              margin: ${mm(0.6)}mm 0;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              gap: 1mm;
              font-size: ${fs(8.5)}pt;
            }
            .item-name {
              flex: 1;
              font-weight: 700;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .item-price {
              white-space: nowrap;
            }
            .item-note {
              font-size: ${fs(7)}pt;
              font-style: italic;
              padding-left: 2.5mm;
              margin-top: 0.2mm;
              line-height: 1.15;
            }
            .total {
              font-size: ${fs(11)}pt;
              font-weight: 700;
              text-align: right;
              margin-top: ${mm(1.5)}mm;
            }
          </style>
        </head>
        <body>
          ${itemPages.map((items, idx) => renderLabel(items, idx + 1, idx === 0, idx === totalPages - 1)).join('')}
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        // Web: open in new window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent + '<script>window.print();</script>');
          printWindow.document.close();
        }
      } else {
        // Mobile (iOS/Android): genera PDF con dimensione esatta rotolo 62mm.
        // Etichetta DK Brother = 62x100mm fissi.
        // Se split: ogni "pagina" del PDF è una nuova etichetta → height = 95mm.
        // Se singola: altezza calcolata in base al contenuto, max 95mm.
        let heightPts: number;
        if (needsSplit) {
          heightPts = Math.round(95 * 2.83465);
        } else {
          const baseHeightMm = 35 * scale;
          const perItemMm = 7 * scale;
          const perItemNoteMm = 5 * scale;
          const deliveryMm = order.deliveryTime ? 10 * scale : 0;
          const notesMm = order.notes ? (10 + Math.ceil(order.notes.length / 22) * 3.5) * scale : 0;
          const itemsMm = order.items.reduce((acc, it) => {
            const extraNameLines = Math.max(0, Math.floor(it.dishName.length / 24));
            return acc + perItemMm + extraNameLines * 4 * scale + (it.notes ? perItemNoteMm : 0);
          }, 0);
          const calcMm = baseHeightMm + deliveryMm + notesMm + itemsMm + 8;
          const totalMm = Math.min(95, Math.max(65, calcMm));
          heightPts = Math.round(totalMm * 2.83465);
        }

        await Print.printAsync({
          html: htmlContent,
          width: 176,                // 62mm fissi
          height: heightPts,         // 95mm se split, dinamico se singola
          orientation: 'portrait',
          margins: { left: 0, right: 0, top: 0, bottom: 0 },
        });
      }
    } catch (error) {
      console.error('Print error:', error);
      showToast('Errore nella stampa', 'error');
    }
  };

  // Filter orders by status + customer name search
  // "Tutti" esclude gli ordini chiusi
  const filteredOrders = useMemo(() => {
    let result = statusFilter 
      ? orders.filter(o => o.status === statusFilter)
      : orders.filter(o => o.status !== 'consegnato');
    
    if (orderSearchQuery.trim()) {
      const query = orderSearchQuery.toLowerCase();
      result = result.filter(order => 
        (order.customerName || 'anonimo').toLowerCase().includes(query)
      );
    }
    return result;
  }, [orders, statusFilter, orderSearchQuery]);

  // Conteggio ordini per filtro "Tutti" (esclude consegnato)
  const activeOrdersCount = orders.filter(o => o.status !== 'consegnato').length;
  const closedOrdersCount = orders.filter(o => o.status === 'consegnato').length;

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

  // Reset edit mode and edit-related sub-states when the selected order changes
  // (or when no order is selected). Prevents "modifica" from staying open across orders.
  useEffect(() => {
    setEditOrderHeader(false);
    setEditShowCustomerPicker(false);
    setEditCustomerSearchQuery('');
    setShowEditOrderTimePicker(false);
  }, [selectedOrder?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openEditOrderHeader = () => {
    if (!selectedOrder) return;
    setEditCustomerName(selectedOrder.customerName || '');
    setEditCustomerId(selectedOrder.customerId || null);
    setEditOrderNotes(selectedOrder.notes || '');
    setEditOrderDeliveryTime(selectedOrder.deliveryTime || '');
    setEditOrderServiceType((selectedOrder.serviceType as any) || 'in_sede');
    setEditShowCustomerPicker(false);
    setEditCustomerSearchQuery('');
    setEditOrderHeader(true);
  };

  const saveOrderHeader = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await ordersApi.updateInfo(selectedOrder.id, {
        customerName: editCustomerName.trim() || null,
        customerId: editCustomerId,
        notes: editOrderNotes,
        deliveryTime: editOrderDeliveryTime,
        serviceType: editOrderServiceType,
      });
      setSelectedOrder(updated);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      setEditOrderHeader(false);
      showToast('Ordine aggiornato');
    } catch (e: any) {
      showToast(e.response?.data?.detail || 'Errore aggiornamento ordine', 'error');
    }
  };

  const handleCreateOrder = async () => {
    if (!currentMenu) {
      showToast('Nessun menu disponibile per questa data', 'error');
      return;
    }

    try {
      const order = await ordersApi.create(selectedDate, {
        channel: newOrderChannel,
        serviceType: newOrderServiceType,
        customerId: newOrderCustomer?.id,
        customerName: newOrderCustomer?.name,
        notes: newOrderNotes,
        deliveryTime: newOrderDeliveryTime,
      });
      
      setOrders([order, ...orders]);
      setSelectedOrder(order);
      setShowNewOrderModal(false);
      setNewOrderChannel('persona');
      setNewOrderServiceType('in_sede');
      setNewOrderCustomer(null);
      setNewOrderNotes('');
      setNewOrderDeliveryTime('');
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

    // Prezzo personalizzato (se specificato)
    const customPrice = itemCustomPrice ? parseFloat(itemCustomPrice.replace(',', '.')) : undefined;

    try {
      const updatedOrder = await ordersApi.addItem(selectedOrder.id, {
        dishId: selectedMenuItem.dishId,
        quantity: qty,
        customPrice: customPrice,
        notes: itemNotes || undefined,
      });
      
      // Update orders list
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      
      // Refresh menu to get updated portions
      const menu = await menusApi.getByDate(selectedDate);
      setCurrentMenu(menu);
      
      setSelectedMenuItem(null);
      setItemQuantity('1');
      setItemCustomPrice('');
      setItemNotes('');
      showToast('Piatto aggiunto');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiungere il piatto', 'error');
    }
  };

  // Aggiungi piatto libero
  const handleAddCustomItem = async () => {
    if (!selectedOrder) return;
    
    if (!customItemName.trim()) {
      showToast('Inserisci il nome del piatto', 'error');
      return;
    }
    
    const price = parseFloat(customItemPrice.replace(',', '.'));
    if (isNaN(price) || price < 0) {
      showToast('Prezzo non valido', 'error');
      return;
    }
    
    const qty = parseInt(customItemQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Quantità non valida', 'error');
      return;
    }

    try {
      const updatedOrder = await ordersApi.addItem(selectedOrder.id, {
        dishName: customItemName.trim(),
        quantity: qty,
        customPrice: price,
      });
      
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      
      // Reset e chiudi modal
      setCustomItemName('');
      setCustomItemPrice('');
      setCustomItemQuantity('1');
      setShowCustomItemModal(false);
      showToast('Piatto libero aggiunto');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiungere il piatto', 'error');
    }
  };

  const handleRemoveItem = async (itemIndex: number) => {
    if (!selectedOrder) return;

    try {
      const updatedOrder = await ordersApi.removeItemByIndex(selectedOrder.id, itemIndex);
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

  // Inline editing dei singoli item dell'ordine (solo per ordini di oggi)
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const canEditOrderItems = selectedOrder && selectedOrder.menuDate === todayDate;

  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemEditQty, setItemEditQty] = useState('1');
  const [itemEditNotes, setItemEditNotes] = useState('');
  const [itemEditName, setItemEditName] = useState('');
  const [itemEditPrice, setItemEditPrice] = useState('');

  const openEditItem = (index: number) => {
    if (!selectedOrder) return;
    const it = selectedOrder.items[index];
    setEditingItemIndex(index);
    setItemEditQty(String(it.quantity));
    setItemEditNotes(it.notes || '');
    setItemEditName(it.dishName || '');
    setItemEditPrice(String(it.unitPrice ?? ''));
  };

  const cancelEditItem = () => {
    setEditingItemIndex(null);
    setItemEditQty('1');
    setItemEditNotes('');
    setItemEditName('');
    setItemEditPrice('');
  };

  const saveEditItem = async () => {
    if (!selectedOrder || editingItemIndex === null) return;
    const it = selectedOrder.items[editingItemIndex];
    const qty = parseInt(itemEditQty);
    if (isNaN(qty) || qty < 1) {
      showToast('Quantità non valida', 'error');
      return;
    }
    const payload: { quantity?: number; notes?: string; dishName?: string; unitPrice?: number } = {
      quantity: qty,
      notes: itemEditNotes,
    };
    if (it.isCustomItem) {
      if (!itemEditName.trim()) {
        showToast('Nome piatto richiesto', 'error');
        return;
      }
      const price = parseFloat(itemEditPrice.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        showToast('Prezzo non valido', 'error');
        return;
      }
      payload.dishName = itemEditName.trim();
      payload.unitPrice = price;
    }
    try {
      const updated = await ordersApi.updateItemByIndex(selectedOrder.id, editingItemIndex, payload);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      setSelectedOrder(updated);
      if (!it.isCustomItem) {
        const menu = await menusApi.getByDate(selectedDate);
        setCurrentMenu(menu);
      }
      cancelEditItem();
      showToast('Piatto aggiornato');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile modificare il piatto', 'error');
    }
  };

  // Duplica un piatto libero (utile per varianti veloci tipo "insalata senza tonno")
  const handleDuplicateCustomItem = async (itemIndex: number) => {
    if (!selectedOrder) return;
    const it = selectedOrder.items[itemIndex];
    if (!it.isCustomItem) return;
    try {
      const updated = await ordersApi.addItem(selectedOrder.id, {
        dishName: it.dishName,
        quantity: it.quantity,
        customPrice: it.unitPrice,
      });
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      setSelectedOrder(updated);
      // Apri subito edit sul nuovo item (ultimo in lista) per modifica veloce
      const newIndex = updated.items.length - 1;
      setTimeout(() => openEditItem(newIndex), 100);
      showToast('Piatto duplicato. Modifica come vuoi.');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile duplicare il piatto', 'error');
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
          <ActivityIndicator size="large" color="#DB0007" />
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
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/images/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Bancó</Text>
        </View>
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
      </View>

      {/* Stats Bar - Filterable Counters */}
      <View style={styles.statsBar}>
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === null && styles.filterStatItemActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.statValue, statusFilter === null && styles.statValueActive]}>{activeOrdersCount}</Text>
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
        <TouchableOpacity 
          style={[styles.filterStatItem, statusFilter === 'consegnato' && styles.filterStatItemActive, { borderLeftColor: STATUS_COLORS.consegnato }]}
          onPress={() => setStatusFilter(statusFilter === 'consegnato' ? null : 'consegnato')}
        >
          <Text style={[styles.statValue, { color: STATUS_COLORS.consegnato }]}>
            {closedOrdersCount}
          </Text>
          <Text style={styles.statLabel}>Consegn.</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Orders List */}
        <View style={styles.ordersPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Ordini del Giorno</Text>
            <View style={styles.panelHeaderActions}>
              {/* OP06: Portions Dashboard Button - Compact */}
              {currentMenu && currentMenu.items && currentMenu.items.length > 0 && (
                <TouchableOpacity 
                  style={styles.compactButton}
                  onPress={() => setShowPortionsModal(true)}
                >
                  <Ionicons name="restaurant-outline" size={18} color="#00754A" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.compactButtonPrimary, !currentMenu && styles.disabledButton]}
                onPress={() => setShowNewOrderModal(true)}
                disabled={!currentMenu}
                testID="new-order-button"
              >
                <Ionicons name="add" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Orders by Customer Name */}
          {currentMenu && (
            <View style={styles.ordersSearchContainer} testID="orders-search-container">
              <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
              <TextInput
                style={styles.ordersSearchInput}
                value={orderSearchQuery}
                onChangeText={setOrderSearchQuery}
                placeholder="Cerca ordine per nome cliente..."
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                testID="orders-search-input"
              />
              {orderSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setOrderSearchQuery('')} style={styles.clearSearchButton} testID="orders-search-clear">
                  <Ionicons name="close-circle" size={20} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {!currentMenu ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#64748b" />
              <Text style={styles.emptyStateText}>Nessun menu per questa data</Text>
              <Text style={styles.emptyStateSubtext}>Crea prima un menu giornaliero</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.ordersList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB0007" />
              }
            >
              {filteredOrders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color="#64748b" />
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
                      <View style={styles.orderCardTitle}>
                        <Text style={styles.customerNameHeader}>
                          {order.customerName || 'Anonimo'}
                        </Text>
                        <Text style={styles.orderNumberSmall}>#{order.orderNumber}</Text>
                      </View>
                      <View style={styles.orderCardActions}>
                        <TouchableOpacity 
                          style={styles.cardPrintButton}
                          onPress={(e) => handlePrintOrder(order, e)}
                        >
                          <Ionicons name="print" size={18} color="#3498db" />
                        </TouchableOpacity>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] }]}>
                          <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.orderCardBody}>
                      <View style={styles.orderInfo}>
                        <Ionicons
                          name={CHANNELS.find(c => c.id === order.channel)?.icon as any || 'person'}
                          size={16}
                          color="#64748b"
                        />
                        <Text style={styles.orderInfoText}>
                          {CHANNELS.find(c => c.id === order.channel)?.label}
                          {' - '}
                          {order.serviceType === 'da_consegnare' ? 'Da consegnare' : 
                           order.serviceType === 'da_ritirare' ? 'Da ritirare' : 'In sede'}
                        </Text>
                      </View>
                      {!!order.deliveryTime && (
                        <View style={styles.orderDeliveryTime} testID={`order-delivery-${order.id}`}>
                          <Ionicons name="time-outline" size={14} color="#FFBC0D" />
                          <Text style={styles.orderDeliveryTimeText}>
                            Ora: {order.deliveryTime}
                          </Text>
                        </View>
                      )}
                      {order.items.length > 0 && (
                        <View style={styles.orderItemsList} testID={`order-items-summary-${order.id}`}>
                          {order.items.map((item, idx) => (
                            <Text key={`${order.id}-item-${idx}`} style={styles.orderItemLine} numberOfLines={2}>
                              • {item.quantity}x {item.dishName}
                              {!!item.notes && (
                                <Text style={styles.orderItemNoteInline}> ({item.notes})</Text>
                              )}
                            </Text>
                          ))}
                        </View>
                      )}
                      {!!order.notes && (
                        <View style={styles.orderNotesBox} testID={`order-notes-${order.id}`}>
                          <Ionicons name="document-text-outline" size={13} color="#3498db" />
                          <Text style={styles.orderNotesText} numberOfLines={2}>
                            {order.notes}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.orderCardFooter}>
                      <Text style={styles.orderTotal}>{order.total.toFixed(2)} €</Text>
                      <View style={styles.orderFooterRight}>
                        <TouchableOpacity 
                          style={[
                            styles.paymentToggle,
                            order.isPaid ? styles.paymentTogglePaid : styles.paymentToggleUnpaid
                          ]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleTogglePayment(order);
                          }}
                        >
                          <Ionicons 
                            name="card" 
                            size={14} 
                            color={order.isPaid ? "#00754A" : "#DB0007"} 
                          />
                        </TouchableOpacity>
                        <Text style={styles.orderTime}>
                          {format(new Date(order.createdAt), 'HH:mm')}
                        </Text>
                      </View>
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
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.newOrderScroll}
              contentContainerStyle={styles.newOrderScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >

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
                    color={newOrderChannel === channel.id ? '#1a202c' : '#64748b'}
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

            <Text style={styles.inputLabel}>Tipologia</Text>
            <View style={styles.serviceTypeSelector}>
              {[
                { id: 'in_sede', label: 'In Sede', icon: 'restaurant' },
                { id: 'da_ritirare', label: 'Da Ritirare', icon: 'walk' },
                { id: 'da_consegnare', label: 'Da Consegnare', icon: 'bicycle' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.serviceTypeButton,
                    newOrderServiceType === type.id && styles.serviceTypeButtonActive,
                  ]}
                  onPress={() => setNewOrderServiceType(type.id as any)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={20}
                    color={newOrderServiceType === type.id ? '#1a202c' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.serviceTypeButtonText,
                      newOrderServiceType === type.id && styles.serviceTypeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Cliente (opzionale)</Text>
            {!showInlineCustomerPicker ? (
              <TouchableOpacity
                style={[
                  styles.customerSelector,
                  Platform.OS === 'web' && { cursor: 'pointer' } as any,
                ]}
                onPress={() => setShowInlineCustomerPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.customerSelectorText}>
                  {newOrderCustomer ? newOrderCustomer.name : 'Seleziona cliente...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
            ) : (
              <View style={styles.inlineCustomerPicker}>
                <View style={styles.inlinePickerHeader}>
                  <TextInput
                    style={styles.inlineSearchInput}
                    placeholder="Cerca cliente..."
                    placeholderTextColor="#64748b"
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                    autoFocus
                  />
                  <TouchableOpacity 
                    onPress={() => {
                      setShowInlineCustomerPicker(false);
                      setCustomerSearchQuery('');
                    }}
                    style={styles.inlineCloseBtn}
                  >
                    <Ionicons name="close" size={20} color="#1a202c" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.inlineCustomerList} nestedScrollEnabled={true}>
                  <TouchableOpacity
                    style={styles.customerOption}
                    onPress={() => {
                      setNewOrderCustomer(null);
                      setShowInlineCustomerPicker(false);
                      setCustomerSearchQuery('');
                    }}
                  >
                    <Text style={styles.customerOptionText}>Nessun cliente (Anonimo)</Text>
                  </TouchableOpacity>
                  {customers
                    .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                    .map(customer => (
                      <TouchableOpacity
                        key={customer.id}
                        style={[
                          styles.customerOption,
                          newOrderCustomer?.id === customer.id && styles.customerOptionSelected
                        ]}
                        onPress={() => {
                          setNewOrderCustomer(customer);
                          setShowInlineCustomerPicker(false);
                          setCustomerSearchQuery('');
                          // Load unpaid orders for this customer
                          customersApi.getUnpaidOrders(customer.id).then(setUnpaidOrders).catch(() => {});
                        }}
                      >
                        <Text style={styles.customerOptionText}>{customer.name}</Text>
                        {customer.type === 'azienda' && (
                          <Ionicons name="business" size={16} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.textInput}
              value={newOrderNotes}
              onChangeText={setNewOrderNotes}
              placeholder="Note ordine..."
              placeholderTextColor="#64748b"
              multiline
            />

            <Text style={styles.inputLabel}>Ora di consegna (opzionale)</Text>
            <TimePickerInline 
              value={newOrderDeliveryTime}
              onChange={setNewOrderDeliveryTime}
              testIDPrefix="new-order-time-picker"
              label="Ora di consegna"
            />

            {/* Unpaid Orders Warning - Compact with view options */}
            {unpaidOrders.length > 0 && newOrderCustomer && (
              <View style={styles.unpaidWarningBox}>
                <View style={styles.unpaidWarningHeader}>
                  <Ionicons name="alert-circle" size={16} color="#DB0007" />
                  <Text style={styles.unpaidWarningTitle}>
                    {unpaidOrders.length} ordine/i non pagato/i
                  </Text>
                  {unpaidOrders.length > 2 && (
                    <TouchableOpacity 
                      style={styles.unpaidViewAllBtn}
                      onPress={() => {
                        setShowNewOrderModal(false);
                        router.push(`/unpaid-orders?customerId=${newOrderCustomer?.id}&customerName=${encodeURIComponent(newOrderCustomer?.name || '')}` as any);
                      }}
                    >
                      <Text style={styles.unpaidViewAllText}>Vedi tutti</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {unpaidOrders.slice(0, 2).map((uo) => (
                  <View key={uo.id} style={styles.unpaidOrderItem}>
                    <TouchableOpacity 
                      style={styles.unpaidOrderInfo}
                      onPress={() => {
                        // Navigate to unpaid orders page
                        setShowNewOrderModal(false);
                        router.push(`/unpaid-orders?customerId=${newOrderCustomer?.id}&customerName=${encodeURIComponent(newOrderCustomer?.name || '')}` as any);
                      }}
                    >
                      <Text style={styles.unpaidOrderText} numberOfLines={1}>
                        #{uo.orderNumber} • {uo.total.toFixed(2)} €
                      </Text>
                      <Ionicons name="eye-outline" size={14} color="#3498db" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.unpaidPayButton}
                      onPress={async () => {
                        try {
                          await ordersApi.updatePayment(uo.id, true);
                          const updatedUnpaid = unpaidOrders.filter(o => o.id !== uo.id);
                          setUnpaidOrders(updatedUnpaid);
                          showToast(`Ordine #${uo.orderNumber} pagato`);
                          loadData();
                        } catch (error) {
                          showToast('Errore', 'error');
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color="#00754A" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateOrder} testID="create-order-button">
              <Text style={styles.primaryButtonText}>Crea Ordine</Text>
            </TouchableOpacity>
            </ScrollView>
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
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                placeholder="Cerca cliente per nome..."
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerSearchQuery('')} style={styles.clearSearchButton}>
                  <Ionicons name="close-circle" size={20} color="#64748b" />
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
                      checkUnpaidOrders(customer.id);
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
                  <Ionicons name="person-outline" size={40} color="#64748b" />
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
                  {selectedOrder?.serviceType && (
                    <Text style={styles.modalServiceType}>
                      {' - '}
                      {selectedOrder.serviceType === 'da_consegnare' ? 'Da consegnare' : 
                       selectedOrder.serviceType === 'da_ritirare' ? 'Da ritirare' : 'In sede'}
                    </Text>
                  )}
                </Text>
                {selectedOrder && (
                  <Text style={styles.modalCustomerName}>
                    {selectedOrder.customerName || 'Anonimo'}
                  </Text>
                )}
              </View>
              <View style={styles.modalHeaderActions}>
                {selectedOrder && (
                  <>
                    <Pressable 
                      style={({ pressed }) => [
                        styles.deleteOrderButton,
                        pressed && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' } as any,
                      ]}
                      onPress={() => {
                        console.log('Delete button pressed');
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Ionicons name="trash" size={22} color="#DB0007" />
                    </Pressable>
                    <TouchableOpacity 
                      style={styles.printButton}
                      onPress={() => handlePrintOrder(selectedOrder)}
                    >
                      <Ionicons name="print" size={24} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => {
                    setShowAddItemModal(false);
                    setSelectedOrder(null);
                    setSelectedMenuItem(null);
                    // The unpaid orders view is already showing underneath
                  }}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Inline Delete Confirmation Panel */}
            {showDeleteConfirm && (
              <View style={styles.deleteConfirmPanel}>
                <View style={styles.deleteConfirmContent}>
                  <Ionicons name="warning" size={32} color="#DB0007" />
                  <Text style={styles.deleteConfirmTitle}>Conferma Cancellazione</Text>
                  <Text style={styles.deleteConfirmText}>
                    Vuoi cancellare l'ordine #{selectedOrder?.orderNumber}?{'\n'}
                    Le porzioni verranno ripristinate nel menu.
                  </Text>
                  <View style={styles.deleteConfirmButtons}>
                    <TouchableOpacity 
                      style={styles.deleteConfirmCancelBtn}
                      onPress={() => setShowDeleteConfirm(false)}
                    >
                      <Text style={styles.deleteConfirmCancelText}>Annulla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteConfirmDeleteBtn}
                      onPress={handleDeleteOrder}
                    >
                      <Ionicons name="trash" size={18} color="#fff" />
                      <Text style={styles.deleteConfirmDeleteText}>Cancella Ordine</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <ScrollView 
              style={styles.modalScrollContent} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={[styles.modalScrollContentContainer, selectedMenuItem && styles.modalScrollWithFooter]}
            >
              {/* Order Header Info - Editable */}
              <View style={styles.mobileSectionCard} testID="order-header-info">
                <View style={styles.orderHeaderInfoRow}>
                  <Text style={styles.sectionTitle}>Info Ordine</Text>
                  {!editOrderHeader && (
                    <TouchableOpacity 
                      style={styles.editHeaderBtn}
                      onPress={openEditOrderHeader}
                      testID="edit-order-header-btn"
                    >
                      <Ionicons name="create-outline" size={18} color="#3498db" />
                      <Text style={styles.editHeaderBtnText}>Modifica</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {!editOrderHeader ? (
                  <View>
                    <View style={styles.orderHeaderInfoLine}>
                      <Ionicons name="person-outline" size={16} color="#64748b" />
                      <Text style={styles.orderHeaderInfoLabel}>Intestatario: </Text>
                      <Text style={styles.orderHeaderInfoValue}>
                        {selectedOrder?.customerName || 'Anonimo'}
                      </Text>
                    </View>
                    <View style={styles.orderHeaderInfoLine}>
                      <Ionicons name="restaurant-outline" size={16} color="#64748b" />
                      <Text style={styles.orderHeaderInfoLabel}>Tipologia: </Text>
                      <Text style={styles.orderHeaderInfoValue}>
                        {selectedOrder?.serviceType === 'da_consegnare' ? 'Da consegnare' : 
                         selectedOrder?.serviceType === 'da_ritirare' ? 'Da ritirare' : 'In sede'}
                      </Text>
                    </View>
                    {!!selectedOrder?.deliveryTime && (
                      <View style={styles.orderHeaderInfoLine}>
                        <Ionicons name="time-outline" size={16} color="#FFBC0D" />
                        <Text style={styles.orderHeaderInfoLabel}>Ora consegna: </Text>
                        <Text style={[styles.orderHeaderInfoValue, { color: '#FFBC0D', fontWeight: '700' }]}>
                          {selectedOrder.deliveryTime}
                        </Text>
                      </View>
                    )}
                    {!!selectedOrder?.notes && (
                      <View style={[styles.orderHeaderInfoLine, { alignItems: 'flex-start' }]}>
                        <Ionicons name="document-text-outline" size={16} color="#3498db" style={{ marginTop: 2 }} />
                        <Text style={styles.orderHeaderInfoLabel}>Note: </Text>
                        <Text style={[styles.orderHeaderInfoValue, { flex: 1 }]}>{selectedOrder.notes}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.inputLabel}>Intestatario</Text>
                    {!editShowCustomerPicker ? (
                      <View style={styles.editCustomerRow}>
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          value={editCustomerName}
                          onChangeText={(t) => { setEditCustomerName(t); setEditCustomerId(null); }}
                          placeholder="Nome intestatario..."
                          placeholderTextColor="#64748b"
                          testID="edit-customer-name-input"
                        />
                        <TouchableOpacity 
                          style={styles.pickCustomerBtn}
                          onPress={() => setEditShowCustomerPicker(true)}
                        >
                          <Ionicons name="people" size={20} color="#1a202c" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.inlineCustomerPicker}>
                        <View style={styles.inlinePickerHeader}>
                          <TextInput
                            style={styles.inlineSearchInput}
                            placeholder="Cerca cliente..."
                            placeholderTextColor="#64748b"
                            value={editCustomerSearchQuery}
                            onChangeText={setEditCustomerSearchQuery}
                            autoFocus
                          />
                          <TouchableOpacity 
                            onPress={() => { setEditShowCustomerPicker(false); setEditCustomerSearchQuery(''); }}
                            style={styles.inlineCloseBtn}
                          >
                            <Ionicons name="close" size={20} color="#1a202c" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.inlineCustomerList} nestedScrollEnabled>
                          <TouchableOpacity
                            style={styles.customerOption}
                            onPress={() => {
                              setEditCustomerName('');
                              setEditCustomerId(null);
                              setEditShowCustomerPicker(false);
                              setEditCustomerSearchQuery('');
                            }}
                          >
                            <Text style={styles.customerOptionText}>Anonimo</Text>
                          </TouchableOpacity>
                          {customers
                            .filter(c => c.name.toLowerCase().includes(editCustomerSearchQuery.toLowerCase()))
                            .map(c => (
                              <TouchableOpacity
                                key={c.id}
                                style={styles.customerOption}
                                onPress={() => {
                                  setEditCustomerName(c.name);
                                  setEditCustomerId(c.id);
                                  setEditShowCustomerPicker(false);
                                  setEditCustomerSearchQuery('');
                                }}
                              >
                                <Text style={styles.customerOptionText}>{c.name}</Text>
                              </TouchableOpacity>
                            ))}
                        </ScrollView>
                      </View>
                    )}
                    
                    <Text style={styles.inputLabel}>Tipologia</Text>
                    <View style={styles.serviceTypeSelector}>
                      {[
                        { id: 'in_sede', label: 'In Sede', icon: 'restaurant' },
                        { id: 'da_ritirare', label: 'Da Ritirare', icon: 'walk' },
                        { id: 'da_consegnare', label: 'Da Consegnare', icon: 'bicycle' },
                      ].map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.serviceTypeButton,
                            editOrderServiceType === type.id && styles.serviceTypeButtonActive,
                          ]}
                          onPress={() => setEditOrderServiceType(type.id as any)}
                        >
                          <Ionicons
                            name={type.icon as any}
                            size={18}
                            color={editOrderServiceType === type.id ? '#fff' : '#64748b'}
                          />
                          <Text
                            style={[
                              styles.serviceTypeButtonText,
                              editOrderServiceType === type.id && styles.serviceTypeButtonTextActive,
                            ]}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <Text style={styles.inputLabel}>Ora di consegna (opzionale)</Text>
                    <TimePickerInline 
                      value={editOrderDeliveryTime}
                      onChange={setEditOrderDeliveryTime}
                      testIDPrefix="edit-time-picker"
                      label="Ora di consegna"
                    />
                    
                    <Text style={styles.inputLabel}>Note ordine</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60 }]}
                      value={editOrderNotes}
                      onChangeText={setEditOrderNotes}
                      placeholder="Note ordine..."
                      placeholderTextColor="#64748b"
                      multiline
                      testID="edit-notes-input"
                    />
                    
                    <View style={styles.editHeaderActions}>
                      <TouchableOpacity
                        style={styles.editHeaderCancelBtn}
                        onPress={() => setEditOrderHeader(false)}
                      >
                        <Text style={styles.editHeaderCancelText}>Annulla</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editHeaderSaveBtn}
                        onPress={saveOrderHeader}
                        testID="save-order-header-btn"
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.editHeaderSaveText}>Salva</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Order Summary Section - NOW FIRST */}
              <View style={styles.mobileSectionCard}>
                <Text style={styles.sectionTitle}>Riepilogo Ordine</Text>
                {selectedOrder?.items.length === 0 ? (
                  <Text style={styles.emptyOrderText}>Nessun piatto nell&apos;ordine</Text>
                ) : (
                  selectedOrder?.items.map((item, index) => (
                    <View key={`order-${item.dishId || 'custom'}-${index}`} style={[
                      styles.orderItemRow,
                      item.itemStatus === 'ready' && styles.orderItemReady,
                      item.itemStatus === 'problem' && styles.orderItemProblem,
                    ]}>
                      {editingItemIndex === index ? (
                        /* INLINE EDIT FORM */
                        <View style={styles.itemEditForm} testID={`item-edit-form-${index}`}>
                          {item.isCustomItem && (
                            <>
                              <Text style={styles.itemEditLabel}>Nome piatto</Text>
                              <TextInput
                                style={styles.itemEditInput}
                                value={itemEditName}
                                onChangeText={setItemEditName}
                                placeholder="Nome piatto libero"
                                placeholderTextColor="#9CA3AF"
                                testID={`item-edit-name-${index}`}
                              />
                            </>
                          )}
                          <View style={styles.itemEditRow}>
                            <View style={styles.itemEditCol}>
                              <Text style={styles.itemEditLabel}>Quantità</Text>
                              <TextInput
                                style={styles.itemEditInput}
                                value={itemEditQty}
                                onChangeText={setItemEditQty}
                                keyboardType="number-pad"
                                testID={`item-edit-qty-${index}`}
                              />
                            </View>
                            {item.isCustomItem && (
                              <View style={styles.itemEditCol}>
                                <Text style={styles.itemEditLabel}>Prezzo (€)</Text>
                                <TextInput
                                  style={styles.itemEditInput}
                                  value={itemEditPrice}
                                  onChangeText={setItemEditPrice}
                                  keyboardType="decimal-pad"
                                  testID={`item-edit-price-${index}`}
                                />
                              </View>
                            )}
                          </View>
                          <Text style={styles.itemEditLabel}>Note</Text>
                          <TextInput
                            style={[styles.itemEditInput, styles.itemEditTextarea]}
                            value={itemEditNotes}
                            onChangeText={setItemEditNotes}
                            placeholder="Note per questo piatto..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            testID={`item-edit-notes-${index}`}
                          />
                          <View style={styles.itemEditActions}>
                            <TouchableOpacity
                              style={styles.itemEditCancelBtn}
                              onPress={cancelEditItem}
                              testID={`item-edit-cancel-${index}`}
                            >
                              <Text style={styles.itemEditCancelText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.itemEditSaveBtn}
                              onPress={saveEditItem}
                              testID={`item-edit-save-${index}`}
                            >
                              <Ionicons name="checkmark" size={16} color="#fff" />
                              <Text style={styles.itemEditSaveText}>Salva</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        /* NORMAL ITEM ROW */
                        <>
                          <View style={styles.orderItemInfo}>
                            <View style={styles.orderItemNameRow}>
                              <Text style={styles.orderItemName}>{item.dishName}</Text>
                              {item.isCustomItem && (
                                <View style={styles.customItemBadge}>
                                  <Text style={styles.customItemBadgeText}>LIBERO</Text>
                                </View>
                              )}
                            </View>
                            {item.notes ? (
                              <Text style={styles.orderItemNotes}>📝 {item.notes}</Text>
                            ) : null}
                            <Text style={styles.orderItemDetails}>
                              {item.quantity} x {item.unitPrice.toFixed(2)} €
                            </Text>
                          </View>

                          {/* Item Status Icons */}
                          <View style={styles.itemStatusIcons}>
                            <TouchableOpacity
                              style={[
                                styles.itemStatusBtn,
                                item.itemStatus === 'ready' && styles.itemStatusBtnActive,
                                item.itemStatus === 'ready' && styles.itemStatusBtnReady,
                              ]}
                              onPress={() => selectedOrder && handleItemStatusChange(
                                selectedOrder.id, 
                                index, 
                                item.itemStatus === 'ready' ? 'pending' : 'ready'
                              )}
                            >
                              <Ionicons 
                                name="checkmark-circle" 
                                size={22} 
                                color={item.itemStatus === 'ready' ? '#fff' : '#00754A'} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.itemStatusBtn,
                                item.itemStatus === 'problem' && styles.itemStatusBtnActive,
                                item.itemStatus === 'problem' && styles.itemStatusBtnProblem,
                              ]}
                              onPress={() => selectedOrder && handleItemStatusChange(
                                selectedOrder.id, 
                                index, 
                                item.itemStatus === 'problem' ? 'pending' : 'problem'
                              )}
                            >
                              <Ionicons 
                                name="alert-circle" 
                                size={22} 
                                color={item.itemStatus === 'problem' ? '#fff' : '#DB0007'} 
                              />
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.orderItemSubtotal}>{item.subtotal.toFixed(2)} €</Text>

                          {/* Edit + Duplicate (only for today's orders) */}
                          {canEditOrderItems && (
                            <>
                              <TouchableOpacity
                                style={styles.itemActionBtn}
                                onPress={() => openEditItem(index)}
                                testID={`item-edit-btn-${index}`}
                              >
                                <Ionicons name="create-outline" size={18} color="#5423E7" />
                              </TouchableOpacity>
                              {item.isCustomItem && (
                                <TouchableOpacity
                                  style={styles.itemActionBtn}
                                  onPress={() => handleDuplicateCustomItem(index)}
                                  testID={`item-duplicate-btn-${index}`}
                                >
                                  <Ionicons name="copy-outline" size={18} color="#00754A" />
                                </TouchableOpacity>
                              )}
                            </>
                          )}

                          <TouchableOpacity
                            style={styles.removeItemButton}
                            onPress={() => handleRemoveItem(index)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#DB0007" />
                          </TouchableOpacity>
                        </>
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
                      {/* Pulsante Consegnato - sempre visibile, solo manuale */}
                      {selectedOrder.status !== 'consegnato' && (
                        <TouchableOpacity
                          style={[styles.statusGridButton, { backgroundColor: STATUS_COLORS.consegnato }]}
                          onPress={() => handleUpdateStatus(selectedOrder.id, 'consegnato')}
                        >
                          <Text style={styles.statusGridButtonText}>Consegnato</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Payment Toggle - Compact chip style */}
                    <View style={styles.paymentSection}>
                      <TouchableOpacity 
                        style={[
                          styles.paymentChip,
                          selectedOrder.isPaid ? styles.paymentChipPaid : styles.paymentChipUnpaid
                        ]}
                        onPress={() => handleTogglePayment(selectedOrder)}
                      >
                        <Ionicons 
                          name="card" 
                          size={18} 
                          color={selectedOrder.isPaid ? "#00754A" : "#DB0007"} 
                        />
                        <Text style={[
                          styles.paymentChipText,
                          selectedOrder.isPaid ? styles.paymentChipTextPaid : styles.paymentChipTextUnpaid
                        ]}>
                          {selectedOrder.isPaid ? 'Pagato' : 'Da pagare'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#64748b" />
                      </TouchableOpacity>
                      
                      {/* Receipt Button */}
                      <View style={styles.receiptSection}>
                        {selectedOrder.receiptImage ? (
                          <View style={styles.receiptActions}>
                            {!showInlineReceipt ? (
                              <>
                                <TouchableOpacity 
                                  style={styles.receiptPreviewBtn}
                                  onPress={() => setShowInlineReceipt(true)}
                                >
                                  <Ionicons name="document-text" size={18} color="#00754A" />
                                  <Text style={styles.receiptPreviewText}>Scontrino</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  style={styles.receiptDeleteBtn}
                                  onPress={handleDeleteReceipt}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#DB0007" />
                                </TouchableOpacity>
                              </>
                            ) : (
                              <View style={styles.inlineReceiptContainer}>
                                <View style={styles.inlineReceiptHeader}>
                                  <Text style={styles.inlineReceiptTitle}>Scontrino</Text>
                                  <TouchableOpacity onPress={() => setShowInlineReceipt(false)}>
                                    <Ionicons name="close" size={20} color="#1a202c" />
                                  </TouchableOpacity>
                                </View>
                                <Image
                                  source={{ uri: selectedOrder.receiptImage }}
                                  style={styles.inlineReceiptImage}
                                  resizeMode="contain"
                                />
                                <TouchableOpacity 
                                  style={styles.receiptDeleteBtn}
                                  onPress={() => {
                                    handleDeleteReceipt();
                                    setShowInlineReceipt(false);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#DB0007" />
                                  <Text style={{color: '#DB0007', marginLeft: 5}}>Elimina</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={styles.receiptCaptureBtn}
                            onPress={handleTakeReceiptPhoto}
                          >
                            <Ionicons name="camera" size={18} color="#3498db" />
                            <Text style={styles.receiptCaptureText}>Allega Scontrino</Text>
                          </TouchableOpacity>
                        )}
                      </View>
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
                    {sortedCategories.map((category) => (
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

                  {/* Pulsante Piatto Libero */}
                  {!showInlineCustomItem ? (
                    <TouchableOpacity 
                      style={[
                        styles.customItemButton,
                        Platform.OS === 'web' && { cursor: 'pointer' } as any,
                      ]}
                      onPress={() => setShowInlineCustomItem(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={18} color="#ffffff" />
                      <Text style={styles.customItemButtonText}>Piatto Libero</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.inlineCustomItemForm}>
                      <View style={styles.inlineFormHeader}>
                        <Text style={styles.inlineFormTitle}>Piatto Libero</Text>
                        <TouchableOpacity onPress={() => {
                          setShowInlineCustomItem(false);
                          setCustomItemName('');
                          setCustomItemPrice('');
                          setCustomItemQuantity('1');
                        }}>
                          <Ionicons name="close" size={20} color="#1a202c" />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.inlineFormInput}
                        value={customItemName}
                        onChangeText={setCustomItemName}
                        placeholder="Nome piatto"
                        placeholderTextColor="#888"
                      />
                      <View style={styles.inlineFormRow}>
                        <TextInput
                          style={[styles.inlineFormInput, { flex: 1 }]}
                          value={customItemPrice}
                          onChangeText={setCustomItemPrice}
                          placeholder="Prezzo €"
                          placeholderTextColor="#888"
                          keyboardType="decimal-pad"
                        />
                        <View style={styles.inlineQuantityControl}>
                          <TouchableOpacity
                            style={styles.inlineQtyBtn}
                            onPress={() => setCustomItemQuantity(Math.max(1, parseInt(customItemQuantity || '1') - 1).toString())}
                          >
                            <Ionicons name="remove" size={18} color="#1a202c" />
                          </TouchableOpacity>
                          <Text style={styles.inlineQtyText}>{customItemQuantity}</Text>
                          <TouchableOpacity
                            style={styles.inlineQtyBtn}
                            onPress={() => setCustomItemQuantity((parseInt(customItemQuantity || '1') + 1).toString())}
                          >
                            <Ionicons name="add" size={18} color="#1a202c" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.inlineAddBtn}
                        onPress={async () => {
                          if (!selectedOrder || !customItemName.trim() || !customItemPrice) {
                            showToast('Inserisci nome e prezzo', 'error');
                            return;
                          }
                          try {
                            const price = parseFloat(customItemPrice.replace(',', '.'));
                            const qty = parseInt(customItemQuantity) || 1;
                            const updatedOrder = await ordersApi.addItem(selectedOrder.id, {
                              dishName: customItemName.trim(),
                              quantity: qty,
                              customPrice: price,
                            });
                            setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                            setSelectedOrder(updatedOrder);
                            showToast(`${customItemName} aggiunto`);
                            setShowInlineCustomItem(false);
                            setCustomItemName('');
                            setCustomItemPrice('');
                            setCustomItemQuantity('1');
                          } catch (error: any) {
                            showToast(error.response?.data?.detail || 'Errore', 'error');
                          }
                        }}
                      >
                        <Ionicons name="add-circle" size={18} color="#fff" />
                        <Text style={styles.inlineAddBtnText}>Aggiungi</Text>
                      </TouchableOpacity>
                    </View>
                  )}

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
                                <Ionicons name="checkmark-circle" size={24} color="#00754A" />
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
            {selectedMenuItem && (
              <View style={styles.fixedFooter}>
                <View style={styles.footerSelectedItem}>
                  <Text style={styles.footerItemName} numberOfLines={1}>
                    {selectedMenuItem.dishName}
                  </Text>
                  <View style={styles.footerItemRight}>
                    <Text style={styles.footerItemPrice}>
                      {selectedMenuItem.dailyPrice.toFixed(2)} €
                    </Text>
                    <Text style={styles.footerAvailableText}>
                      disp. {selectedMenuItem.portions}
                    </Text>
                  </View>
                </View>
                {/* Footer Controls - Layout verticale per mobile */}
                <View style={styles.footerControlsVertical}>
                  {/* Prima riga: Prezzo e Quantità */}
                  <View style={styles.footerRow}>
                    <View style={styles.footerPriceBox}>
                      <Text style={styles.footerPriceLabel}>Prezzo €</Text>
                      <TextInput
                        style={styles.footerPriceInput}
                        value={itemCustomPrice}
                        onChangeText={setItemCustomPrice}
                        placeholder={selectedMenuItem.dailyPrice.toFixed(2)}
                        placeholderTextColor="#888"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.footerQuantityBox}>
                      <Text style={styles.footerQuantityLabel}>Qtà</Text>
                      <View style={styles.footerQuantityControls}>
                        <TouchableOpacity
                          style={[
                            styles.footerQtyBtn,
                            parseInt(itemQuantity) <= 1 && styles.footerQtyBtnDisabled
                          ]}
                          onPress={() => setItemQuantity(Math.max(1, parseInt(itemQuantity) - 1).toString())}
                          disabled={parseInt(itemQuantity) <= 1}
                        >
                          <Ionicons name="remove" size={18} color={parseInt(itemQuantity) <= 1 ? '#666' : '#fff'} />
                        </TouchableOpacity>
                        <Text style={styles.footerQtyText}>{itemQuantity}</Text>
                        <TouchableOpacity
                          style={[
                            styles.footerQtyBtn,
                            parseInt(itemQuantity) >= selectedMenuItem.portions && styles.footerQtyBtnDisabled
                          ]}
                          onPress={() => setItemQuantity(Math.min(selectedMenuItem.portions, parseInt(itemQuantity) + 1).toString())}
                          disabled={parseInt(itemQuantity) >= selectedMenuItem.portions}
                        >
                          <Ionicons name="add" size={18} color={parseInt(itemQuantity) >= selectedMenuItem.portions ? '#666' : '#fff'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {/* Campo Note */}
                  <TextInput
                    style={styles.footerNotesInput}
                    value={itemNotes}
                    onChangeText={setItemNotes}
                    placeholder="Note (es: senza sale, ben cotto...)"
                    placeholderTextColor="#888"
                  />
                  {/* Seconda riga: Pulsante Aggiungi */}
                  <TouchableOpacity style={styles.footerAddButtonFull} onPress={handleAddItem}>
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.footerAddButtonText}>Conferma Piatto</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Custom Item Modal - Piatto Libero */}
      <Modal visible={showCustomItemModal} animationType="slide" transparent>
        <View style={styles.customItemModalOverlay}>
          <View style={styles.customItemModalContent}>
            <View style={styles.customItemModalHeader}>
              <Text style={styles.customItemModalTitle}>Piatto Libero</Text>
              <TouchableOpacity onPress={() => setShowCustomItemModal(false)}>
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.customItemModalBody}>
              <Text style={styles.customItemLabel}>Nome piatto</Text>
              <TextInput
                style={styles.customItemInput}
                value={customItemName}
                onChangeText={setCustomItemName}
                placeholder="Es: Piatto speciale del cliente"
                placeholderTextColor="#888"
              />
              
              <View style={styles.customItemRow}>
                <View style={styles.customItemField}>
                  <Text style={styles.customItemLabel}>Prezzo (€)</Text>
                  <TextInput
                    style={styles.customItemInput}
                    value={customItemPrice}
                    onChangeText={setCustomItemPrice}
                    placeholder="0.00"
                    placeholderTextColor="#888"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.customItemField}>
                  <Text style={styles.customItemLabel}>Quantità</Text>
                  <View style={styles.customItemQuantityRow}>
                    <TouchableOpacity
                      style={styles.customItemQuantityBtn}
                      onPress={() => setCustomItemQuantity(Math.max(1, parseInt(customItemQuantity) - 1).toString())}
                    >
                      <Ionicons name="remove" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.customItemQuantityText}>{customItemQuantity}</Text>
                    <TouchableOpacity
                      style={styles.customItemQuantityBtn}
                      onPress={() => setCustomItemQuantity((parseInt(customItemQuantity) + 1).toString())}
                    >
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.customItemAddBtn}
                onPress={handleAddCustomItem}
              >
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.customItemAddBtnText}>Aggiungi all'ordine</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal visible={showReceiptPreview} animationType="fade" transparent>
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle}>Scontrino</Text>
              <TouchableOpacity 
                style={styles.receiptModalCloseBtn}
                onPress={() => setShowReceiptPreview(false)}
              >
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>
            {selectedOrder?.receiptImage && (
              <Image
                source={{ uri: selectedOrder.receiptImage }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* OP06: Portions Dashboard Modal */}
      <Modal visible={showPortionsModal} animationType="slide" transparent>
        <View style={styles.portionsModalOverlay}>
          <View style={styles.portionsModalContent}>
            <View style={styles.portionsModalHeader}>
              <Text style={styles.portionsModalTitle}>Porzioni Disponibili</Text>
              <TouchableOpacity 
                style={styles.portionsModalCloseBtn}
                onPress={() => setShowPortionsModal(false)}
              >
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.portionsModalBody}>
              {currentMenu?.items?.map((item, index) => (
                <View key={`portion-${item.dishId}-${index}`} style={styles.portionItem}>
                  <View style={styles.portionItemInfo}>
                    <Text style={styles.portionItemName}>{item.dishName}</Text>
                    {item.categoryName && (
                      <Text style={styles.portionItemCategory}>{item.categoryName}</Text>
                    )}
                  </View>
                  <View style={[
                    styles.portionItemBadge,
                    item.portions === 0 && styles.portionItemBadgeEmpty,
                    item.portions > 0 && item.portions <= 3 && styles.portionItemBadgeLow,
                  ]}>
                    <Text style={styles.portionItemBadgeText}>
                      {item.portions}/{item.initialPortions || item.portions}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 9,
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
    color: '#DB0007',
    fontWeight: '600',
    marginHorizontal: 16,
    textTransform: 'capitalize',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  statValueActive: {
    color: '#DB0007',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  statLabelActive: {
    color: '#1a202c',
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
    backgroundColor: '#dde4ee',
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
  deleteOrderButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  // Delete confirmation panel styles
  deleteConfirmPanel: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 2,
    borderColor: '#DB0007',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  deleteConfirmContent: {
    alignItems: 'center',
  },
  deleteConfirmTitle: {
    color: '#DB0007',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  deleteConfirmText: {
    color: '#1a202c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmCancelBtn: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmCancelText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#DB0007',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteConfirmDeleteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  ordersPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  newOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DB0007',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  newOrderButtonText: {
    color: '#ffffff',
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
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dde4ee',
    shadowColor: '#5423E7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 2,
  },
  orderCardSelected: {
    borderColor: '#DB0007',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardPrintButton: {
    padding: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderRadius: 6,
  },
  orderCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  customerNameHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  orderNumberSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  serviceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    gap: 3,
  },
  serviceTypeText: {
    color: '#3498db',
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#1a202c',
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
    color: '#64748b',
    marginLeft: 8,
    fontSize: 14,
  },
  customerName: {
    color: '#1a202c',
    fontSize: 14,
    marginTop: 4,
  },
  orderItems: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  orderItemsList: {
    marginTop: 6,
    paddingLeft: 4,
  },
  orderItemLine: {
    color: '#2d3748',
    fontSize: 13,
    lineHeight: 18,
  },
  orderItemNoteInline: {
    color: '#3498db',
    fontStyle: 'italic',
    fontSize: 12,
  },
  orderDeliveryTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  orderDeliveryTimeText: {
    color: '#FFBC0D',
    fontSize: 12,
    fontWeight: '700',
  },
  orderNotesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  orderNotesText: {
    color: '#2d3748',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  // Order header info section
  orderHeaderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderRadius: 8,
  },
  editHeaderBtnText: {
    color: '#3498db',
    fontSize: 13,
    fontWeight: '600',
  },
  orderHeaderInfoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  orderHeaderInfoLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  orderHeaderInfoValue: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '500',
  },
  editCustomerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pickCustomerBtn: {
    backgroundColor: '#dde4ee',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editHeaderActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  editHeaderCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#dde4ee',
    alignItems: 'center',
  },
  editHeaderCancelText: {
    color: '#1a202c',
    fontWeight: '600',
    fontSize: 14,
  },
  editHeaderSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#00754A',
  },
  editHeaderSaveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  timeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeTriggerText: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timeTriggerPlaceholder: {
    color: '#64748b',
    fontWeight: '400',
  },
  ordersSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 14,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#dde4ee',
    shadowColor: '#5423E7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 1,
  },
  ordersSearchInput: {
    flex: 1,
    color: '#1a202c',
    fontSize: 14,
    paddingVertical: 10,
    marginLeft: 8,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
    paddingTop: 10,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00754A',
  },
  orderTime: {
    color: '#64748b',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
      },
    }),
  },
  mobileModalOverlay: {
    backgroundColor: '#f5f7fa',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  fullScreenModalContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        zIndex: 100000,
      },
    }),
  },
  newOrderScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  newOrderScrollContent: {
    paddingBottom: 8,
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
    backgroundColor: '#f5f7fa',
  },
  modalScrollContent: {
    flex: 1,
  },
  modalScrollContentContainer: {
    paddingBottom: 100,
  },
  closeButton: {
    padding: 10,
    backgroundColor: '#DB0007',
    borderRadius: 25,
  },
  mobileSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  emptyOrderText: {
    color: '#64748b',
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
    color: '#1a202c',
  },
  modalServiceType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3498db',
  },
  modalCustomerName: {
    fontSize: 14,
    color: '#DB0007',
    marginTop: 4,
  },
  inputLabel: {
    color: '#64748b',
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
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  channelButtonActive: {
    borderColor: '#DB0007',
    backgroundColor: '#DB000720',
  },
  channelButtonText: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 12,
  },
  channelButtonTextActive: {
    color: '#1a202c',
    fontWeight: '700',
  },
  // Service Type Selector
  serviceTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  serviceTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 4,
  },
  serviceTypeButtonActive: {
    borderColor: '#3498db',
    backgroundColor: '#3498db20',
  },
  serviceTypeButtonText: {
    color: '#64748b',
    fontSize: 11,
  },
  serviceTypeButtonTextActive: {
    color: '#1a202c',
    fontWeight: '700',
  },
  customerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 14,
    borderRadius: 10,
  },
  customerSelectorText: {
    color: '#1a202c',
    fontSize: 15,
  },
  // Inline customer picker styles
  inlineCustomerPicker: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    maxHeight: 250,
    overflow: 'hidden',
  },
  inlinePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  inlineSearchInput: {
    flex: 1,
    backgroundColor: '#dde4ee',
    color: '#1a202c',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  inlineCloseBtn: {
    marginLeft: 10,
    padding: 5,
  },
  inlineCustomerList: {
    maxHeight: 180,
  },
  customerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  customerOptionSelected: {
    backgroundColor: '#dde4ee',
  },
  customerOptionText: {
    color: '#1a202c',
    fontSize: 14,
  },
  textInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    minHeight: 60,
  },
  primaryButton: {
    backgroundColor: '#DB0007',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  customerList: {
    maxHeight: 400,
  },
  customerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  customerItemText: {
    color: '#1a202c',
    fontSize: 16,
  },
  customerItemSubtext: {
    color: '#64748b',
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
    backgroundColor: '#f5f7fa',
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
    color: '#1a202c',
    marginBottom: 12,
  },
  menuCategoryFilter: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  menuCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#dde4ee',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  menuCategoryChipActive: {
    backgroundColor: '#DB0007',
  },
  menuCategoryChipText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  menuCategoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyMenuText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  menuCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DB0007',
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
    backgroundColor: '#f5f7fa',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menuItemCardSelected: {
    borderColor: '#DB0007',
  },
  menuItemCardDisabled: {
    opacity: 0.5,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemPrice: {
    color: '#00754A',
    fontSize: 14,
    marginTop: 4,
  },
  portionsBadge: {
    backgroundColor: '#00754A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  portionsBadgeEmpty: {
    backgroundColor: '#DB0007',
  },
  portionsBadgeLow: {
    backgroundColor: '#FFBC0D',
  },
  portionsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  addItemForm: {
    backgroundColor: '#dde4ee',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  selectedItemText: {
    color: '#1a202c',
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
    backgroundColor: '#DB0007',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
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
    backgroundColor: '#00754A',
    padding: 14,
    borderRadius: 10,
    marginTop: 0,
  },
  addItemButtonText: {
    color: '#ffffff',
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
    borderBottomColor: '#dde4ee',
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    color: '#1a202c',
    fontSize: 14,
  },
  orderItemDetails: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  orderItemNotes: {
    color: '#FFBC0D',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  orderItemSubtotal: {
    color: '#00754A',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  removeItemButton: {
    padding: 8,
  },
  itemActionBtn: {
    padding: 8,
  },
  orderItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  customItemBadge: {
    backgroundColor: '#5423E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customItemBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemEditForm: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#5423E7',
  },
  itemEditLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 6,
  },
  itemEditInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1a202c',
  },
  itemEditTextarea: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  itemEditRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemEditCol: {
    flex: 1,
  },
  itemEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  itemEditCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dde4ee',
  },
  itemEditCancelText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  itemEditSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#00754A',
  },
  itemEditSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#dde4ee',
  },
  orderTotalLabel: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  orderTotalValue: {
    color: '#00754A',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
  },
  statusSectionTitle: {
    color: '#64748b',
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
    color: '#1a202c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeStatusLabel: {
    color: '#64748b',
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
    color: '#ffffff',
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
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionSubtitle: {
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    borderTopWidth: 2,
    borderTopColor: '#DB0007',
    padding: 16,
    paddingBottom: 24,
    shadowColor: '#5423E7',
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
    borderBottomColor: '#dde4ee',
  },
  footerItemName: {
    flex: 1,
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
  },
  footerItemRight: {
    alignItems: 'flex-end',
  },
  footerItemPrice: {
    color: '#00754A',
    fontSize: 18,
    fontWeight: '700',
  },
  footerAvailableText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
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
    backgroundColor: '#DB0007',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerQuantityInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 56,
    height: 44,
    borderRadius: 10,
  },
  footerQuantityDisplay: {
    backgroundColor: '#f5f7fa',
    width: 50,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerQuantityText: {
    color: '#1a202c',
    fontSize: 20,
    fontWeight: 'bold',
  },
  footerQuantityButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  footerAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 48,
  },
  footerAddButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  // Layout verticale per mobile
  footerControlsVertical: {
    gap: 10,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerPriceBox: {
    flex: 1,
  },
  footerPriceLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  footerPriceInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    fontSize: 18,
    fontWeight: '600',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
  },
  footerQuantityBox: {
    flex: 1,
  },
  footerQuantityLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  footerQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 6,
  },
  footerQtyBtn: {
    backgroundColor: '#DB0007',
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerQtyBtnDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  footerQtyText: {
    color: '#1a202c',
    fontSize: 20,
    fontWeight: '700',
  },
  footerAddButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  footerNotesInput: {
    backgroundColor: '#dde4ee',
    color: '#1a202c',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  // Vecchi stili (mantenuti per compatibilità)
  footerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  footerPriceCurrency: {
    color: '#00754A',
    fontSize: 14,
    marginLeft: 4,
  },
  // Pulsante Piatto Libero
  customItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5423E7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
    gap: 6,
  },
  customItemButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Inline Custom Item Form
  inlineCustomItemForm: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#5423E7',
  },
  inlineFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inlineFormTitle: {
    color: '#5423E7',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineFormInput: {
    backgroundColor: '#dde4ee',
    color: '#1a202c',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  inlineFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dde4ee',
    borderRadius: 8,
    padding: 4,
  },
  inlineQtyBtn: {
    padding: 8,
  },
  inlineQtyText: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  inlineAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Piatto Libero
  customItemModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
      },
    }),
  },
  customItemModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        zIndex: 100000,
      },
    }),
  },
  customItemModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  customItemModalTitle: {
    color: '#1a202c',
    fontSize: 18,
    fontWeight: '700',
  },
  customItemModalBody: {
    padding: 16,
  },
  customItemLabel: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 6,
  },
  customItemInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    fontSize: 16,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  customItemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  customItemField: {
    flex: 1,
  },
  customItemQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 8,
  },
  customItemQuantityBtn: {
    backgroundColor: '#DB0007',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customItemQuantityText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  customItemAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  customItemAddBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#1a202c',
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
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  noResultsSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  unpaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DB0007',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  unpaidBadgeText: {
    color: '#1a202c',
    fontSize: 10,
    fontWeight: '700',
  },
  unpaidWarningBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 1,
    borderColor: '#DB0007',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  unpaidWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  unpaidWarningTitle: {
    color: '#DB0007',
    fontSize: 13,
    fontWeight: '600',
  },
  unpaidWarningText: {
    color: '#1a202c',
    fontSize: 13,
    marginBottom: 8,
  },
  unpaidOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7fa',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  unpaidOrderText: {
    color: '#1a202c',
    fontSize: 12,
    flex: 1,
  },
  unpaidPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  unpaidPayText: {
    color: '#00754A',
    fontSize: 11,
    fontWeight: '600',
  },
  unpaidMoreText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  paymentSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8,
  },
  paymentChipPaid: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    borderWidth: 1,
    borderColor: '#00754A',
  },
  paymentChipUnpaid: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderWidth: 1,
    borderColor: '#DB0007',
  },
  paymentChipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  paymentChipTextPaid: {
    color: '#00754A',
  },
  paymentChipTextUnpaid: {
    color: '#DB0007',
  },
  orderFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentTogglePaid: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  paymentToggleUnpaid: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  orderItemReady: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#00754A',
  },
  orderItemProblem: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#DB0007',
  },
  itemStatusIcons: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
  },
  itemStatusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#dde4ee',
  },
  itemStatusBtnActive: {
    borderWidth: 0,
  },
  itemStatusBtnReady: {
    backgroundColor: '#00754A',
  },
  itemStatusBtnProblem: {
    backgroundColor: '#DB0007',
  },
  receiptSection: {
    marginTop: 12,
  },
  receiptActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  receiptPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    borderWidth: 1,
    borderColor: '#00754A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  receiptPreviewText: {
    color: '#00754A',
    fontSize: 14,
    fontWeight: '600',
  },
  receiptDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderRadius: 8,
  },
  // Inline Receipt Styles
  inlineReceiptContainer: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#00754A',
  },
  inlineReceiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inlineReceiptTitle: {
    color: '#00754A',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineReceiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  receiptCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderWidth: 1,
    borderColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  receiptCaptureText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  receiptModalTitle: {
    color: '#1a202c',
    fontSize: 18,
    fontWeight: '600',
  },
  receiptModalCloseBtn: {
    padding: 4,
  },
  receiptImage: {
    width: '100%',
    height: 500,
    backgroundColor: '#f5f7fa',
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00754A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  portionsButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  portionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  portionsModalContent: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  portionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  portionsModalTitle: {
    color: '#1a202c',
    fontSize: 18,
    fontWeight: '600',
  },
  portionsModalCloseBtn: {
    padding: 4,
  },
  portionsModalBody: {
    padding: 16,
  },
  portionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  portionItemInfo: {
    flex: 1,
  },
  portionItemName: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '500',
  },
  portionItemCategory: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  portionItemBadge: {
    backgroundColor: '#00754A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  portionItemBadgeEmpty: {
    backgroundColor: '#DB0007',
  },
  portionItemBadgeLow: {
    backgroundColor: '#FFBC0D',
  },
  portionItemBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    borderWidth: 1,
    borderColor: '#00754A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButtonPrimary: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#DB0007',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unpaidViewAllBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 4,
  },
  unpaidViewAllText: {
    color: '#3498db',
    fontSize: 11,
    fontWeight: '600',
  },
  unpaidOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  unpaidAllItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  unpaidAllInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unpaidAllNumber: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '600',
  },
  unpaidAllTotal: {
    color: '#DB0007',
    fontSize: 15,
    fontWeight: '600',
  },
  unpaidAllDate: {
    color: '#64748b',
    fontSize: 12,
  },
  unpaidAllPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  unpaidAllPayText: {
    color: '#00754A',
    fontSize: 13,
    fontWeight: '600',
  },
});
