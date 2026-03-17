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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAppStore } from '../../src/store/appStore';
import { menusApi, dishesApi, missedSalesApi, categoriesApi } from '../../src/services/api';
import { DailyMenu, Dish, MenuItem, Category } from '../../src/types';

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
  
  // Categories state for filtering
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

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
        quantity: quantity,
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
      
      // Load categories
      try {
        const categoriesData = await categoriesApi.getAll();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
      
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
      // OP03 fix: Force refresh to ensure all items are displayed
      await loadData();
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

  // OP10: Print Menu PDF with nice graphics - Clean white design for WhatsApp
  const handlePrintMenu = async () => {
    if (!currentMenu || !currentMenu.items.length) {
      showToast('Nessun piatto nel menu da stampare', 'error');
      return;
    }

    const formattedDate = format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: it });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    
    // Group items by category
    const groupedItems: Record<string, MenuItem[]> = {};
    currentMenu.items.forEach(item => {
      const cat = item.categoryName || 'Altro';
      if (!groupedItems[cat]) groupedItems[cat] = [];
      groupedItems[cat].push(item);
    });

    // Category order
    const categoryOrder = ['Primi', 'Secondi', 'Contorni', 'Piatti Freddi', 'Insalate', 'Dolci', 'Bibite', 'Fuori Menù', 'Altro'];
    const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const menuItemsHtml = sortedCategories.map(category => `
      <div class="category">
        <div class="category-header">${category}</div>
        <div class="category-items">
          ${groupedItems[category].map(item => `
            <div class="menu-item">
              <span class="item-name">${item.dishName}</span>
              <span class="item-dots"></span>
              <span class="item-price">${item.dailyPrice.toFixed(2)} €</span>
            </div>
            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
          `).join('')}
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Georgia, 'Times New Roman', serif;
            background: #fff;
            padding: 30px;
            color: #2c2c2c;
          }
          
          .container {
            width: 100%;
            max-width: 550px;
            margin: 0 auto;
            padding: 40px 35px;
            border: 3px double #c9a961;
            background: #fffef9;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 25px;
            border-bottom: 1px solid #c9a961;
          }
          
          .logo {
            font-size: 48px;
            font-weight: bold;
            color: #8b0000;
            letter-spacing: 5px;
            margin-bottom: 8px;
            font-family: Georgia, serif;
          }
          
          .subtitle {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 12px;
          }
          
          .date {
            font-size: 14px;
            color: #444;
            font-style: italic;
          }
          
          .category {
            margin-bottom: 20px;
          }
          
          .category-header {
            font-size: 18px;
            font-weight: bold;
            color: #8b0000;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e8e0c8;
          }
          
          .category-items {
            padding-left: 5px;
          }
          
          .menu-item {
            display: flex;
            align-items: baseline;
            padding: 8px 0;
            font-size: 16px;
          }
          
          .item-name {
            color: #333;
          }
          
          .item-dots {
            flex: 1;
            border-bottom: 1px dotted #ccc;
            margin: 0 10px;
            min-width: 20px;
          }
          
          .item-price {
            color: #8b0000;
            font-weight: bold;
            white-space: nowrap;
          }
          
          .item-notes {
            font-size: 13px;
            color: #888;
            font-style: italic;
            padding-left: 10px;
            margin-top: -2px;
            margin-bottom: 4px;
          }
          
          .footer {
            text-align: center;
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #c9a961;
          }
          
          .footer-text {
            font-size: 10px;
            color: #999;
            font-style: italic;
          }
          
          .heart {
            color: #8b0000;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Bancó</div>
            <div class="subtitle">Menu del Giorno</div>
            <div class="date">${capitalizedDate}</div>
          </div>
          
          ${menuItemsHtml}
          
          <div class="footer">
            <div class="footer-text">Buon appetito! <span class="heart">♥</span></div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Menu ${formattedDate}`,
            UTI: 'com.adobe.pdf'
          });
        } else {
          await Print.printAsync({ html });
        }
      }
      showToast('Menu pronto per la condivisione!');
    } catch (error) {
      console.error('Print error:', error);
      showToast('Errore nella stampa', 'error');
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
                {/* OP10: Print Menu Button */}
                {currentMenu.items.length > 0 && (
                  <TouchableOpacity 
                    style={styles.printMenuButton}
                    onPress={handlePrintMenu}
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.printMenuButtonText}>Condividi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Filter */}
              {categories.length > 0 && currentMenu.items.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.categoryFilter}
                  contentContainerStyle={styles.categoryFilterContent}
                >
                  <TouchableOpacity
                    style={[styles.categoryChip, !selectedCategoryFilter && styles.categoryChipActive]}
                    onPress={() => setSelectedCategoryFilter(null)}
                  >
                    <Text style={[styles.categoryChipText, !selectedCategoryFilter && styles.categoryChipTextActive]}>
                      Tutte
                    </Text>
                  </TouchableOpacity>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.categoryChip, selectedCategoryFilter === category.id && styles.categoryChipActive]}
                      onPress={() => setSelectedCategoryFilter(selectedCategoryFilter === category.id ? null : category.id)}
                    >
                      <Text style={[styles.categoryChipText, selectedCategoryFilter === category.id && styles.categoryChipTextActive]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {(() => {
                // Filter menu items by selected category
                const filteredItems = currentMenu.items.filter(item => 
                  !selectedCategoryFilter || item.categoryId === selectedCategoryFilter
                );
                
                if (filteredItems.length === 0) {
                  return (
                    <View style={styles.emptySection}>
                      <Text style={styles.emptySectionText}>
                        {selectedCategoryFilter ? 'Nessun piatto in questa categoria' : 'Nessun piatto nel menu'}
                      </Text>
                    </View>
                  );
                }
                
                return filteredItems.map((item, index) => (
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
                        {item.categoryName && !selectedCategoryFilter && (
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{item.categoryName}</Text>
                          </View>
                        )}
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
                ));
              })()}
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

      {/* Missed Sale Modal - Simple quantity input */}
      <Modal visible={showMissedSaleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mancata Vendita</Text>
              <TouchableOpacity onPress={() => {
                setShowMissedSaleModal(false);
                setMissedSaleItem(null);
                setMissedSaleQuantity('1');
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {missedSaleItem && (
              <>
                <View style={styles.missedSaleDishInfo}>
                  <Ionicons name="alert-circle" size={40} color="#e74c3c" />
                  <Text style={styles.missedSaleDishName}>{missedSaleItem.dishName}</Text>
                  <Text style={styles.missedSaleExplanation}>
                    Quante porzioni sono state richieste?
                  </Text>
                </View>

                <View style={styles.quantityInputRow}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setMissedSaleQuantity(Math.max(1, parseInt(missedSaleQuantity) - 1).toString())}
                  >
                    <Ionicons name="remove" size={28} color="#fff" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInputLarge}
                    value={missedSaleQuantity}
                    onChangeText={setMissedSaleQuantity}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setMissedSaleQuantity((parseInt(missedSaleQuantity) + 1).toString())}
                  >
                    <Ionicons name="add" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.missedSaleButton} onPress={handleMissedSale}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.missedSaleButtonText}>Registra Richiesta</Text>
                </TouchableOpacity>
                
                <Text style={styles.missedSaleHelpText}>
                  Questo aiuta a capire la domanda reale per aumentare le porzioni da produrre
                </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    marginBottom: 24,
  },
  missedSaleDishName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  missedSaleExplanation: {
    color: '#8892b0',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  quantityButton: {
    backgroundColor: '#e94560',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInputLarge: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 100,
    height: 60,
    borderRadius: 12,
  },
  missedSaleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 10,
    gap: 8,
  },
  missedSaleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  missedSaleHelpText: {
    color: '#5a6078',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  categoryFilter: {
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  categoryFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  categoryChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  categoryChipText: {
    color: '#8892b0',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#8892b0',
    fontSize: 10,
    fontWeight: '600',
  },
  printMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printMenuButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
