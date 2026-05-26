import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, price: number, quantity: number) => void;
}

export const CustomItemModal: React.FC<CustomItemModalProps> = ({
  visible,
  onClose,
  onAdd,
}) => {
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');

  const handleAdd = () => {
    const priceNum = parseFloat(price);
    const qtyNum = parseInt(quantity);
    
    if (!name.trim()) return;
    if (isNaN(priceNum) || priceNum < 0) return;
    if (isNaN(qtyNum) || qtyNum <= 0) return;

    onAdd(name.trim(), priceNum, qtyNum);
    
    // Reset
    setName('');
    setPrice('');
    setQuantity('1');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Piatto Libero</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1a202c" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.label}>Nome piatto</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Es: Piatto speciale del cliente"
              placeholderTextColor="#888"
            />
            
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Prezzo (€)</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor="#888"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Quantità</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.quantityBtn}
                    onPress={() => setQuantity(Math.max(1, parseInt(quantity) - 1).toString())}
                  >
                    <Ionicons name="remove" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityBtn}
                    onPress={() => setQuantity((parseInt(quantity) + 1).toString())}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.addBtnText}>Aggiungi all'ordine</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    width: '100%',
    maxWidth: 400,
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
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
    fontSize: 16,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 8,
  },
  quantityBtn: {
    backgroundColor: '#DB0007',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: '#1a202c',
    fontSize: 20,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  addBtnText: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CustomItemModal;
