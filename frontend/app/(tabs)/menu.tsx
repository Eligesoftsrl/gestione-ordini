import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../src/store/appStore';
import { menusApi, dishesApi, missedSalesApi } from '../../src/services/api';
import { DailyMenu, Dish, MenuItem } from '../../src/types';

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
    <Animated.View style={[styles.toast, type === 'success' ? styles.toastSuccess : styles.toastError, { opacity: fadeAnim }]}>
      <Ionicons name={type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={24} color="#fff" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function MenuScreen() {
  const { selectedDate, setSelectedDate, dishes, setDishes, currentMenu, setCurrentMenu } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [portions, setPortions] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // Missed sale modal state
  const [showMissedSaleModal, setShowMissedSaleModal] = useState(false);
  const [missedSaleItem, setMissedSaleItem] = useState<MenuItem | null>(null);
  const [missedSaleQuantity, setMissedSaleQuantity] = useState('1');

  const handleMissedSale = async () => {
    if (!missedSaleItem) return;
    
    const quantity = parseInt(missedSaleQuantity) || 1;
    if (quantity <= 0) {
      showToast('Inserisci una quantità valida', 'error');
      return;
    }
    
    try {
      await missedSalesApi.create({
        dishName: missedSaleItem.dishName,
        date: selectedDate,
        timeSlot: 'giornata',
        channel: 'richiesta',
        reason: 'esaurito',
      });
      
      showToast(`Registrate ${quantity} richieste non soddisfatte`);
      setShowMissedSaleModal(false);
      setMissedSaleItem(null);
      setMissedSaleQuantity('1');
    } catch (error) {
      console.error('Error creating missed sale:', error);
      showToast('Errore nel registrare la mancata vendita', 'error');
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load dishes
      const dishesData = await dishesApi.getAll();
      setDishes(dishesData);
      
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

  const handleCreateMenu = async () => {
    try {
      const menu = await menusApi.create(selectedDate);
      setCurrentMenu(menu);
      // No toast needed - the menu will appear automatically
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile creare il menu', 'error');
    }
  };

  const handleAddDish = async () => {
    if (!currentMenu || !selectedDish) return;
    
    const portionsNum = parseInt(portions);
    const priceNum = parseFloat(dailyPrice);
    
    if (isNaN(portionsNum) || portionsNum <= 0) {
      showToast('Inserisci un numero di porzioni valido', 'error');
      return;
    }
    
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Inserisci un prezzo valido', 'error');
      return;
    }

    try {
      const updatedMenu = await menusApi.addItem(currentMenu.id, {
        dishId: selectedDish.id,
        portions: portionsNum,
        dailyPrice: priceNum,
        notes: notes,
      });
      
      setCurrentMenu(updatedMenu);
      setShowAddDishModal(false);
      resetForm();
      showToast('Piatto aggiunto al menu');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiungere il piatto', 'error');
    }
  };

  const handleUpdateItem = async () => {
    if (!currentMenu || !selectedItem) return;

    const updates: any = {};
    
    if (portions) {
      const portionsNum = parseInt(portions);
      if (!isNaN(portionsNum) && portionsNum >= 0) {
        updates.portions = portionsNum;
      }
    }
    
    if (dailyPrice) {
      const priceNum = parseFloat(dailyPrice);
      if (!isNaN(priceNum) && priceNum > 0) {
        updates.dailyPrice = priceNum;
      }
    }
    
    if (notes !== selectedItem.notes) {
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      setShowEditItemModal(false);
      return;
    }

    try {
      const updatedMenu = await menusApi.updateItem(currentMenu.id, selectedItem.dishId, updates);
      setCurrentMenu(updatedMenu);
      setShowEditItemModal(false);
      resetForm();
      showToast('Piatto aggiornato');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile aggiornare il piatto', 'error');
    }
  };

  const handleRemoveItem = async (dishId: string) => {
    if (!currentMenu) return;

    setConfirmDialog({
      visible: true,
      title: 'Rimuovi Piatto',
      message: 'Vuoi rimuovere questo piatto dal menu?',
      onConfirm: async () => {
        try {
          const updatedMenu = await menusApi.removeItem(currentMenu.id, dishId);
          setCurrentMenu(updatedMenu);
          showToast('Piatto rimosso');
        } catch (error: any) {
          showToast(error.response?.data?.detail || 'Impossibile rimuovere il piatto', 'error');
        }
        setConfirmDialog(null);
      },
    });
  };

  const resetForm = () => {
    setSelectedDish(null);
    setSelectedItem(null);
    setPortions('');
    setDailyPrice('');
    setNotes('');
  };

  const changeDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(format(currentDate, 'yyyy-MM-dd'));
  };

  const openEditModal = (item: MenuItem) => {
    setSelectedItem(item);
    setPortions(item.portions.toString());
    setDailyPrice(item.dailyPrice.toString());
    setNotes(item.notes || '');
    setShowEditItemModal(true);
  };

  const openAddModal = (dish: Dish) => {
    setSelectedDish(dish);
    setPortions('');
    setDailyPrice(dish.basePrice.toString());
    setNotes('');
    setShowAddDishModal(true);
  };

  // Get dishes not already in menu
  const availableDishes = dishes.filter(
    d => !currentMenu?.items.some(item => item.dishId === d.id)
  );

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
        <Text style={styles.headerTitle}>Menu Giornaliero</Text>
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
        {!currentMenu ? (
          <View style={styles.noMenuContainer}>
            <Ionicons name="calendar-outline" size={64} color="#8892b0" />
            <Text style={styles.noMenuText}>Nessun menu per questa data</Text>
            <TouchableOpacity style={styles.createMenuButton} onPress={handleCreateMenu}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createMenuButtonText}>Crea Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Menu Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Piatti nel Menu ({currentMenu.items.length})
                </Text>
              </View>

              {currentMenu.items.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>Nessun piatto nel menu</Text>
                </View>
              ) : (
                currentMenu.items.map((item, index) => (
                  <TouchableOpacity 
                    key={`menu-item-${item.dishId}-${index}`} 
                    style={[styles.menuItemCard, item.portions === 0 && styles.menuItemCardSoldOut]}
                    onPress={() => {
                      if (item.portions === 0) {
                        setMissedSaleItem(item);
                        setShowMissedSaleModal(true);
                      } else {
                        openEditModal(item);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemInfo}>
                      <View style={styles.menuItemNameRow}>
                        <Text style={styles.menuItemName}>{item.dishName}</Text>
                        {item.portions === 0 && (
                          <View style={styles.soldOutBadge}>
                            <Ionicons name="alert-circle" size={14} color="#fff" />
                            <Text style={styles.soldOutText}>ESAURITO</Text>
                          </View>
                        )}
                      </View>
                      {item.notes && (
                        <Text style={styles.menuItemNotes}>{item.notes}</Text>
                      )}
                      <View style={styles.menuItemDetails}>
                        <Text style={styles.menuItemPrice}>{item.dailyPrice.toFixed(2)} €</Text>
                        <View style={[
                          styles.portionsBadge,
                          item.portions === 0 && styles.portionsBadgeEmpty,
                          item.portions > 0 && item.portions <= 3 && styles.portionsBadgeLow,
                        ]}>
                          <Text style={styles.portionsText}>{item.portions} porzioni</Text>
                        </View>
                      </View>
                      {item.portions === 0 && (
                        <Text style={styles.missedSaleHint}>Tocca per registrare mancata vendita</Text>
                      )}
                    </View>
                    <View style={styles.menuItemActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          openEditModal(item);
                        }}
                      >
                        <Ionicons name="create-outline" size={22} color="#3498db" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.dishId);
                        }}
                      >
                        <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Available Dishes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Piatti Disponibili ({availableDishes.length})
                </Text>
              </View>

              {availableDishes.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>Tutti i piatti sono già nel menu</Text>
                </View>
              ) : (
                availableDishes.map((dish) => (
                  <TouchableOpacity
                    key={dish.id}
                    style={styles.dishCard}
                    onPress={() => openAddModal(dish)}
                  >
                    <View style={styles.dishInfo}>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      {dish.description && (
                        <Text style={styles.dishDescription}>{dish.description}</Text>
                      )}
                      <Text style={styles.dishPrice}>Prezzo base: {dish.basePrice.toFixed(2)} €</Text>
                    </View>
                    <View style={styles.addDishButton}>
                      <Ionicons name="add-circle" size={32} color="#27ae60" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Confirm Dialog */}
      <Modal visible={!!confirmDialog?.visible} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>{confirmDialog?.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog?.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={styles.confirmButtonCancel} 
                onPress={() => setConfirmDialog(null)}
              >
                <Text style={styles.confirmButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButtonConfirm} 
                onPress={confirmDialog?.onConfirm}
              >
                <Text style={styles.confirmButtonConfirmText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Dish Modal */}
      <Modal visible={showAddDishModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aggiungi al Menu</Text>
              <TouchableOpacity onPress={() => { setShowAddDishModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedDish && (
              <>
                <Text style={styles.selectedDishName}>{selectedDish.name}</Text>
                
                <Text style={styles.inputLabel}>Porzioni Disponibili *</Text>
                <TextInput
                  style={styles.textInput}
                  value={portions}
                  onChangeText={setPortions}
                  placeholder="Numero di porzioni"
                  placeholderTextColor="#8892b0"
                  keyboardType="number-pad"
                />

                <Text style={styles.inputLabel}>Prezzo Giornaliero *</Text>
                <TextInput
                  style={styles.textInput}
                  value={dailyPrice}
                  onChangeText={setDailyPrice}
                  placeholder="Prezzo in euro"
                  placeholderTextColor="#8892b0"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Note Operative</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Note per la preparazione..."
                  placeholderTextColor="#8892b0"
                  multiline
                />

                <TouchableOpacity style={styles.primaryButton} onPress={handleAddDish}>
                  <Text style={styles.primaryButtonText}>Aggiungi al Menu</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={showEditItemModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Piatto</Text>
              <TouchableOpacity onPress={() => { setShowEditItemModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <>
                <Text style={styles.selectedDishName}>{selectedItem.dishName}</Text>
                
                <Text style={styles.inputLabel}>Porzioni Disponibili</Text>
                <TextInput
                  style={styles.textInput}
                  value={portions}
                  onChangeText={setPortions}
                  placeholder="Numero di porzioni"
                  placeholderTextColor="#8892b0"
                  keyboardType="number-pad"
                />

                <Text style={styles.inputLabel}>Prezzo Giornaliero</Text>
                <TextInput
                  style={styles.textInput}
                  value={dailyPrice}
                  onChangeText={setDailyPrice}
                  placeholder="Prezzo in euro"
                  placeholderTextColor="#8892b0"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Note Operative</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Note per la preparazione..."
                  placeholderTextColor="#8892b0"
                  multiline
                />

                <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateItem}>
                  <Text style={styles.primaryButtonText}>Salva Modifiche</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Missed Sale Modal */}
      <Modal visible={showMissedSaleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registra Mancata Vendita</Text>
              <TouchableOpacity onPress={() => {
                setShowMissedSaleModal(false);
                setMissedSaleItem(null);
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {missedSaleItem && (
              <>
                <View style={styles.missedSaleDishInfo}>
                  <Ionicons name="alert-circle" size={32} color="#e74c3c" />
                  <Text style={styles.missedSaleDishName}>{missedSaleItem.dishName}</Text>
                  <Text style={styles.missedSaleDishPrice}>{missedSaleItem.dailyPrice.toFixed(2)} €</Text>
                </View>

                <Text style={styles.inputLabel}>Fascia Oraria</Text>
                <View style={styles.timeSlotSelector}>
                  {TIME_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        styles.timeSlotButton,
                        missedSaleTimeSlot === slot.id && styles.timeSlotButtonActive,
                      ]}
                      onPress={() => setMissedSaleTimeSlot(slot.id)}
                    >
                      <Text
                        style={[
                          styles.timeSlotButtonText,
                          missedSaleTimeSlot === slot.id && styles.timeSlotButtonTextActive,
                        ]}
                      >
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Canale</Text>
                <View style={styles.channelSelector}>
                  {CHANNELS.map((channel) => (
                    <TouchableOpacity
                      key={channel.id}
                      style={[
                        styles.channelButton,
                        missedSaleChannel === channel.id && styles.channelButtonActive,
                      ]}
                      onPress={() => setMissedSaleChannel(channel.id)}
                    >
                      <Ionicons
                        name={channel.icon as any}
                        size={20}
                        color={missedSaleChannel === channel.id ? '#fff' : '#8892b0'}
                      />
                      <Text
                        style={[
                          styles.channelButtonText,
                          missedSaleChannel === channel.id && styles.channelButtonTextActive,
                        ]}
                      >
                        {channel.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.missedSaleButton} onPress={handleMissedSale}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.missedSaleButtonText}>Registra Mancata Vendita</Text>
                </TouchableOpacity>
              </>
            )}
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
  noMenuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  noMenuText: {
    color: '#8892b0',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  createMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  createMenuButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptySection: {
    padding: 24,
    alignItems: 'center',
  },
  emptySectionText: {
    color: '#8892b0',
    fontSize: 14,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  menuItemNotes: {
    fontSize: 13,
    color: '#8892b0',
    marginTop: 4,
    fontStyle: 'italic',
  },
  menuItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
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
  menuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  dishInfo: {
    flex: 1,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dishDescription: {
    fontSize: 13,
    color: '#8892b0',
    marginTop: 4,
  },
  dishPrice: {
    fontSize: 14,
    color: '#27ae60',
    marginTop: 6,
  },
  addDishButton: {
    padding: 8,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDialog: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#8892b0',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonCancel: {
    flex: 1,
    backgroundColor: '#0f3460',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonConfirm: {
    flex: 1,
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
  selectedDishName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e94560',
    marginBottom: 16,
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
  menuItemCardSoldOut: {
    borderColor: '#e74c3c',
    borderWidth: 2,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  menuItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  soldOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  soldOutText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  missedSaleHint: {
    color: '#e74c3c',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  missedSaleDishInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    marginBottom: 20,
  },
  missedSaleDishName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  missedSaleDishPrice: {
    color: '#8892b0',
    fontSize: 16,
    marginTop: 4,
  },
  timeSlotSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  timeSlotButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeSlotButtonActive: {
    backgroundColor: '#e94560',
  },
  timeSlotButtonText: {
    color: '#8892b0',
    fontSize: 15,
    fontWeight: '500',
  },
  timeSlotButtonTextActive: {
    color: '#fff',
  },
  channelSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  channelButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  channelButtonActive: {
    backgroundColor: '#e94560',
  },
  channelButtonText: {
    color: '#8892b0',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  channelButtonTextActive: {
    color: '#fff',
  },
  missedSaleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  missedSaleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
