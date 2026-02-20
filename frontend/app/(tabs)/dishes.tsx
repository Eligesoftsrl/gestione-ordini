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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { dishesApi } from '../../src/services/api';
import { Dish } from '../../src/types';

export default function DishesScreen() {
  const { dishes, setDishes } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await dishesApi.getAll(!showInactive);
      setDishes(data);
    } catch (error) {
      console.error('Error loading dishes:', error);
      Alert.alert('Errore', 'Impossibile caricare i piatti');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

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
    setDescription('');
    setBasePrice('');
    setEditingDish(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (dish: Dish) => {
    setEditingDish(dish);
    setName(dish.name);
    setDescription(dish.description || '');
    setBasePrice(dish.basePrice.toString());
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome del piatto');
      return;
    }

    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Errore', 'Inserisci un prezzo valido');
      return;
    }

    try {
      if (editingDish) {
        // Update existing dish
        const updated = await dishesApi.update(editingDish.id, {
          name: name.trim(),
          description: description.trim(),
          basePrice: price,
        });
        setDishes(dishes.map(d => d.id === updated.id ? updated : d));
        Alert.alert('Successo', 'Piatto aggiornato');
      } else {
        // Create new dish
        const newDish = await dishesApi.create({
          name: name.trim(),
          description: description.trim(),
          basePrice: price,
        });
        setDishes([newDish, ...dishes]);
        Alert.alert('Successo', 'Piatto creato');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare il piatto');
    }
  };

  const handleDeactivate = (dish: Dish) => {
    Alert.alert(
      'Conferma',
      `Vuoi disattivare il piatto "${dish.name}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Disattiva',
          style: 'destructive',
          onPress: async () => {
            try {
              await dishesApi.deactivate(dish.id);
              setDishes(dishes.filter(d => d.id !== dish.id));
              Alert.alert('Successo', 'Piatto disattivato');
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Impossibile disattivare il piatto');
            }
          },
        },
      ]
    );
  };

  const handleReactivate = async (dish: Dish) => {
    try {
      const updated = await dishesApi.update(dish.id, { active: true });
      setDishes(dishes.map(d => d.id === updated.id ? updated : d));
      Alert.alert('Successo', 'Piatto riattivato');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile riattivare il piatto');
    }
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
        <Text style={styles.headerTitle}>Anagrafica Piatti</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterButton, showInactive && styles.filterButtonActive]}
            onPress={() => setShowInactive(!showInactive)}
          >
            <Ionicons name={showInactive ? 'eye' : 'eye-off'} size={18} color="#fff" />
            <Text style={styles.filterButtonText}>
              {showInactive ? 'Tutti' : 'Solo Attivi'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Nuovo Piatto</Text>
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
        {dishes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="fast-food-outline" size={64} color="#8892b0" />
            <Text style={styles.emptyStateText}>Nessun piatto trovato</Text>
            <Text style={styles.emptyStateSubtext}>Crea il tuo primo piatto</Text>
          </View>
        ) : (
          <View style={styles.dishesGrid}>
            {dishes.map((dish) => (
              <View key={dish.id} style={[styles.dishCard, !dish.active && styles.dishCardInactive]}>
                <View style={styles.dishHeader}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  {!dish.active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Disattivato</Text>
                    </View>
                  )}
                </View>
                
                {dish.description && (
                  <Text style={styles.dishDescription}>{dish.description}</Text>
                )}
                
                <Text style={styles.dishPrice}>{dish.basePrice.toFixed(2)} €</Text>
                
                <View style={styles.dishActions}>
                  <TouchableOpacity
                    style={[styles.dishActionButton, styles.editButton]}
                    onPress={() => openEditModal(dish)}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={styles.dishActionText}>Modifica</Text>
                  </TouchableOpacity>
                  
                  {dish.active ? (
                    <TouchableOpacity
                      style={[styles.dishActionButton, styles.deactivateButton]}
                      onPress={() => handleDeactivate(dish)}
                    >
                      <Ionicons name="eye-off-outline" size={18} color="#fff" />
                      <Text style={styles.dishActionText}>Disattiva</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.dishActionButton, styles.activateButton]}
                      onPress={() => handleReactivate(dish)}
                    >
                      <Ionicons name="eye-outline" size={18} color="#fff" />
                      <Text style={styles.dishActionText}>Riattiva</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDish ? 'Modifica Piatto' : 'Nuovo Piatto'}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome Piatto *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Es: Pasta al pomodoro"
              placeholderTextColor="#8892b0"
            />

            <Text style={styles.inputLabel}>Descrizione</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descrizione del piatto..."
              placeholderTextColor="#8892b0"
              multiline
            />

            <Text style={styles.inputLabel}>Prezzo Base (€) *</Text>
            <TextInput
              style={styles.textInput}
              value={basePrice}
              onChangeText={setBasePrice}
              placeholder="Es: 8.50"
              placeholderTextColor="#8892b0"
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>
                {editingDish ? 'Salva Modifiche' : 'Crea Piatto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
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
    color: '#8892b0',
    fontSize: 18,
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#5a6078',
    fontSize: 14,
    marginTop: 8,
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dishCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 350,
    minWidth: 280,
    flex: 1,
  },
  dishCardInactive: {
    opacity: 0.6,
  },
  dishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dishName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dishDescription: {
    fontSize: 14,
    color: '#8892b0',
    marginBottom: 12,
  },
  dishPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 16,
  },
  dishActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dishActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: '#3498db',
  },
  deactivateButton: {
    backgroundColor: '#e74c3c',
  },
  activateButton: {
    backgroundColor: '#27ae60',
  },
  dishActionText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 6,
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
  textInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#e94560',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
