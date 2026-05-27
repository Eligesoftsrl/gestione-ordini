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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { customersApi } from '../../src/services/api';
import { Customer, Order } from '../../src/types';

export default function CustomersScreen() {
  const { customers, setCustomers } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<'persona' | 'societa'>('persona');
  const [partitaIva, setPartitaIva] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Errore', 'Impossibile caricare i clienti');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setName('');
    setCustomerType('persona');
    setPartitaIva('');
    setPhone('');
    setEmail('');
    setAddress('');
    setRequiresInvoice(false);
    setNotes('');
    setEditingCustomer(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setCustomerType(customer.customerType || 'persona');
    setPartitaIva(customer.partitaIva || '');
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setRequiresInvoice(customer.requiresInvoice);
    setNotes(customer.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome del cliente');
      return;
    }
    
    // Validazione partita IVA per società
    if (customerType === 'societa' && !partitaIva.trim()) {
      Alert.alert('Errore', 'La Partita IVA è obbligatoria per le società');
      return;
    }

    try {
      if (editingCustomer) {
        const updated = await customersApi.update(editingCustomer.id, {
          name: name.trim(),
          customerType,
          partitaIva: partitaIva.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          requiresInvoice,
          notes: notes.trim(),
        });
        setCustomers(customers.map(c => c.id === updated.id ? updated : c));
        Alert.alert('Successo', 'Cliente aggiornato');
      } else {
        const newCustomer = await customersApi.create({
          name: name.trim(),
          customerType,
          partitaIva: partitaIva.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          requiresInvoice,
          notes: notes.trim(),
        });
        setCustomers([newCustomer, ...customers]);
        Alert.alert('Successo', 'Cliente creato');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare il cliente');
    }
  };

  const viewCustomerOrders = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      const orders = await customersApi.getOrders(customer.id);
      setCustomerOrders(orders);
      setShowOrdersModal(true);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare lo storico ordini');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partitaIva?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestione Clienti</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cerca cliente..."
              placeholderTextColor="#64748b"
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Nuovo Cliente</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB0007" />
        }
      >
        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#64748b" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Nessun risultato' : 'Nessun cliente'}
            </Text>
          </View>
        ) : (
          filteredCustomers.map((customer) => (
            <View key={customer.id} style={styles.customerCard}>
              <View style={styles.customerHeader}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {customer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.customerInfo}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    {customer.requiresInvoice && (
                      <View style={styles.invoiceBadge}>
                        <Ionicons name="document-text" size={12} color="#fff" />
                        <Text style={styles.invoiceBadgeText}>Fattura</Text>
                      </View>
                    )}
                  </View>
                  {customer.phone && (
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={14} color="#64748b" />
                      <Text style={styles.contactText}>{customer.phone}</Text>
                    </View>
                  )}
                  {customer.email && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={14} color="#64748b" />
                      <Text style={styles.contactText}>{customer.email}</Text>
                    </View>
                  )}
                  {customer.address && (
                    <View style={styles.contactRow}>
                      <Ionicons name="location-outline" size={14} color="#64748b" />
                      <Text style={styles.contactText}>{customer.address}</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {customer.notes && (
                <Text style={styles.customerNotes}>{customer.notes}</Text>
              )}
              
              <View style={styles.customerActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.historyButton]}
                  onPress={() => viewCustomerOrders(customer)}
                >
                  <Ionicons name="time-outline" size={18} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Storico</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => openEditModal(customer)}
                >
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Modifica</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Modifica Cliente' : 'Nuovo Cliente'}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Customer Type Selector */}
              <Text style={styles.inputLabel}>Tipo Cliente *</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, customerType === 'persona' && styles.typeButtonActive]}
                  onPress={() => setCustomerType('persona')}
                >
                  <Ionicons name="person" size={20} color={customerType === 'persona' ? '#fff' : '#64748b'} />
                  <Text style={[styles.typeButtonText, customerType === 'persona' && styles.typeButtonTextActive]}>
                    Persona Fisica
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, customerType === 'societa' && styles.typeButtonActive]}
                  onPress={() => setCustomerType('societa')}
                >
                  <Ionicons name="business" size={20} color={customerType === 'societa' ? '#fff' : '#64748b'} />
                  <Text style={[styles.typeButtonText, customerType === 'societa' && styles.typeButtonTextActive]}>
                    Società
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>{customerType === 'societa' ? 'Ragione Sociale *' : 'Nome *'}</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder={customerType === 'societa' ? 'Ragione sociale' : 'Nome cliente'}
                placeholderTextColor="#64748b"
              />

              {customerType === 'societa' && (
                <>
                  <Text style={styles.inputLabel}>Partita IVA *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={partitaIva}
                    onChangeText={setPartitaIva}
                    placeholder="Inserisci Partita IVA"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Telefono</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Numero di telefono"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Indirizzo email"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Indirizzo</Text>
              <TextInput
                style={styles.textInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Indirizzo"
                placeholderTextColor="#64748b"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Richiede Fattura</Text>
                <Switch
                  value={requiresInvoice}
                  onValueChange={setRequiresInvoice}
                  trackColor={{ false: '#dde4ee', true: '#00754A' }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.inputLabel}>Note</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Note sul cliente..."
                placeholderTextColor="#64748b"
                multiline
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
                <Text style={styles.primaryButtonText}>
                  {editingCustomer ? 'Salva Modifiche' : 'Crea Cliente'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Orders History Modal */}
      <Modal visible={showOrdersModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.ordersModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Storico Ordini - {selectedCustomer?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowOrdersModal(false)}>
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.ordersList}>
              {customerOrders.length === 0 ? (
                <View style={styles.emptyOrdersState}>
                  <Ionicons name="receipt-outline" size={48} color="#64748b" />
                  <Text style={styles.emptyOrdersText}>Nessun ordine trovato</Text>
                </View>
              ) : (
                customerOrders.map((order) => (
                  <View key={order.id} style={styles.orderHistoryCard}>
                    <View style={styles.orderHistoryHeader}>
                      <Text style={styles.orderHistoryNumber}>#{order.orderNumber}</Text>
                      <Text style={styles.orderHistoryDate}>
                        {format(new Date(order.createdAt), 'd MMM yyyy HH:mm', { locale: it })}
                      </Text>
                    </View>
                    <View style={styles.orderHistoryItems}>
                      {order.items.map((item, idx) => (
                        <Text key={idx} style={styles.orderHistoryItem}>
                          {item.quantity}x {item.dishName}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.orderHistoryFooter}>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: order.status === 'completato' ? '#00754A' : order.status === 'annullato' ? '#DB0007' : '#FFBC0D' }
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {order.status === 'completato' ? 'Completato' : order.status === 'annullato' ? 'Annullato' : 'In Attesa'}
                        </Text>
                      </View>
                      <Text style={styles.orderHistoryTotal}>{order.total.toFixed(2)} €</Text>
                    </View>
                  </View>
                ))
              )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#1a202c',
    padding: 10,
    fontSize: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DB0007',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 18,
    marginTop: 16,
  },
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DB0007',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  customerAvatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  customerInfo: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a202c',
    marginRight: 10,
  },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  invoiceBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    marginLeft: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 8,
  },
  customerNotes: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  historyButton: {
    backgroundColor: '#5423E7',
  },
  editButton: {
    backgroundColor: '#3498db',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  ordersModal: {
    maxWidth: 600,
    maxHeight: '85%',
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
    color: '#1a202c',
    flex: 1,
  },
  inputLabel: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#1a202c',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#DB0007',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ordersList: {
    flex: 1,
  },
  emptyOrdersState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyOrdersText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  orderHistoryCard: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  orderHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderHistoryNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  orderHistoryDate: {
    color: '#64748b',
    fontSize: 13,
  },
  orderHistoryItems: {
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
    paddingTop: 10,
  },
  orderHistoryItem: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 4,
  },
  orderHistoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#1a202c',
    fontSize: 12,
    fontWeight: '600',
  },
  orderHistoryTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00754A',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#DB0007',
  },
  typeButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
});
