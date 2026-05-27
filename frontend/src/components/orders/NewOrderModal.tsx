import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Customer } from '../../types';

const CHANNELS = [
  { id: 'persona', label: 'Di Persona', icon: 'person' },
  { id: 'telefono', label: 'Telefono', icon: 'call' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
];

interface NewOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateOrder: (channel: string, customerId?: string, customerName?: string, notes?: string) => void;
  customers: Customer[];
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  visible,
  onClose,
  onCreateOrder,
  customers,
}) => {
  const [channel, setChannel] = useState('persona');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const handleCreate = () => {
    onCreateOrder(
      channel,
      selectedCustomer?.id,
      selectedCustomer?.name,
      notes
    );
    // Reset
    setChannel('persona');
    setSelectedCustomer(null);
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuovo Ordine</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1a202c" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Channel Selection */}
            <Text style={styles.sectionLabel}>Canale</Text>
            <View style={styles.channelContainer}>
              {CHANNELS.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={[
                    styles.channelButton,
                    channel === ch.id && styles.channelButtonActive
                  ]}
                  onPress={() => setChannel(ch.id)}
                >
                  <Ionicons 
                    name={ch.icon as any} 
                    size={20} 
                    color={channel === ch.id ? '#fff' : '#64748b'} 
                  />
                  <Text style={[
                    styles.channelText,
                    channel === ch.id && styles.channelTextActive
                  ]}>
                    {ch.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Customer Selection */}
            <Text style={styles.sectionLabel}>Cliente (opzionale)</Text>
            <TouchableOpacity
              style={styles.customerSelector}
              onPress={() => setShowCustomerPicker(true)}
            >
              <Ionicons name="person-outline" size={20} color="#64748b" />
              <Text style={styles.customerSelectorText}>
                {selectedCustomer ? selectedCustomer.name : 'Seleziona cliente...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>

            {/* Notes */}
            <Text style={styles.sectionLabel}>Note</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Note per l'ordine..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreate}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.createButtonText}>Crea Ordine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Picker Sub-Modal */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Seleziona Cliente</Text>
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Cerca cliente..."
              placeholderTextColor="#666"
            />

            <ScrollView style={styles.customerList}>
              <TouchableOpacity
                style={styles.customerItem}
                onPress={() => {
                  setSelectedCustomer(null);
                  setShowCustomerPicker(false);
                }}
              >
                <Text style={styles.customerItemText}>Nessun cliente (Anonimo)</Text>
              </TouchableOpacity>
              {filteredCustomers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={[
                    styles.customerItem,
                    selectedCustomer?.id === customer.id && styles.customerItemActive
                  ]}
                  onPress={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerPicker(false);
                  }}
                >
                  <Text style={styles.customerItemText}>{customer.name}</Text>
                  {customer.phone && (
                    <Text style={styles.customerItemPhone}>{customer.phone}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f5f7fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  modalTitle: {
    color: '#1a202c',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  channelContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  channelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  channelButtonActive: {
    backgroundColor: '#DB0007',
  },
  channelText: {
    color: '#64748b',
    fontSize: 13,
  },
  channelTextActive: {
    color: '#1a202c',
    fontWeight: '600',
  },
  customerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  customerSelectorText: {
    flex: 1,
    color: '#1a202c',
    fontSize: 15,
  },
  notesInput: {
    backgroundColor: '#ffffff',
    color: '#1a202c',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  // Customer Picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerContent: {
    backgroundColor: '#f5f7fa',
    borderRadius: 16,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  pickerTitle: {
    color: '#1a202c',
    fontSize: 18,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#ffffff',
    color: '#1a202c',
    padding: 14,
    margin: 16,
    borderRadius: 10,
    fontSize: 15,
  },
  customerList: {
    maxHeight: 300,
  },
  customerItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  customerItemActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
  },
  customerItemText: {
    color: '#1a202c',
    fontSize: 15,
  },
  customerItemPhone: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
});

export default NewOrderModal;
