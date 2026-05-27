import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { sortCategoriesByFixedOrder, sortDishesByCategory, sortMenuItemsByCategory } from '../../src/utils/categoryOrder';
import { useFocusEffect } from 'expo-router';

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
      <Ionicons name={type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={24} color="#1a202c" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function MenuScreen() {
  const { selectedDate, setSelectedDate, dishes, setDishes, currentMenu, setCurrentMenu } = useAppStore();
  // Local "all dishes" list for the Menu tab so it isn't affected when
  // the Piatti tab filters the shared `dishes` store by category.
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  // Free-text search query for the "Piatti Disponibili" section
  const [availableSearchQuery, setAvailableSearchQuery] = useState('');
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
  
  // Categories selection for sharing menu
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [selectedShareCategories, setSelectedShareCategories] = useState<string[]>([]);
  
  // Sort categories by fixed order
  const sortedCategories = useMemo(() => sortCategoriesByFixedOrder(categories), [categories]);
  
  // Sort menu items by category
  const sortedMenuItems = useMemo(() => 
    currentMenu ? sortMenuItemsByCategory(currentMenu.items, categories) : [],
    [currentMenu, categories]
  );

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
      
      // Load dishes (all active, no category filter) for the available list
      const dishesData = await dishesApi.getAll();
      setAllDishes(dishesData);
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

  // Reload data whenever the Menu tab is focused (other tabs might mutate the shared dishes store)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
    const priceNum = parseFloat((dailyPrice || '').replace(',', '.'));
    
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
      const priceNum = parseFloat((dailyPrice || '').replace(',', '.'));
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

  // Get dishes not already in menu, sorted by category
  // Uses local `allDishes` (not the shared store) so the Piatti tab filter
  // can't accidentally hide dishes here. Also applies selectedCategoryFilter
  // and the free-text search (availableSearchQuery) — both only affect this list.
  const availableDishes = useMemo(() => {
    let filtered = allDishes.filter(
      d => !currentMenu?.items.some(item => item.dishId === d.id)
    );
    if (selectedCategoryFilter) {
      filtered = filtered.filter(d => d.categoryId === selectedCategoryFilter);
    }
    if (availableSearchQuery.trim()) {
      const q = availableSearchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
    }
    return sortDishesByCategory(filtered, categories);
  }, [allDishes, currentMenu, categories, selectedCategoryFilter, availableSearchQuery]);

  // OP10: Print Menu PDF with nice graphics - Clean white design for WhatsApp
  const handlePrintMenu = async () => {
    if (!currentMenu || !currentMenu.items.length) {
      showToast('Nessun piatto nel menu da stampare', 'error');
      return;
    }

    // Filter items by selected categories
    const itemsToShare = currentMenu.items.filter(item => 
      selectedShareCategories.includes(item.categoryName || 'Altro')
    );

    if (itemsToShare.length === 0) {
      showToast('Nessun piatto nelle categorie selezionate', 'error');
      return;
    }

    const formattedDate = format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: it });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    
    // Group items by category
    const groupedItems: Record<string, MenuItem[]> = {};
    itemsToShare.forEach(item => {
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
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Montserrat:wght@300;400;500&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          /* Print-specific styles for multi-page support */
          @media print {
            html, body {
              height: auto !important;
              overflow: visible !important;
            }
            .container {
              min-height: auto !important;
              height: auto !important;
              border: none !important;
              page-break-inside: auto;
            }
            .category {
              page-break-inside: avoid;
            }
            .menu-item {
              page-break-inside: avoid;
            }
            .footer {
              page-break-inside: avoid;
            }
          }
          
          @page {
            size: A4;
            margin: 15mm 10mm;
          }
          
          body {
            font-family: 'Cormorant Garamond', Georgia, serif;
            background: #f8f5f0;
            padding: 0;
            color: #475569;
          }
          
          .container {
            width: 100%;
            padding: 40px 35px;
            background: linear-gradient(180deg, #fffef9 0%, #f9f6f0 100%);
            border: 6px double #c9a961;
            border-radius: 4px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 25px;
            border-bottom: 2px solid #c9a961;
          }
          
          .logo {
            font-size: 56px;
            font-weight: 700;
            color: #7a1f1f;
            letter-spacing: 6px;
            margin-bottom: 12px;
            font-family: 'Cormorant Garamond', Georgia, serif;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
          }
          
          .divider {
            width: 100px;
            height: 3px;
            background: linear-gradient(90deg, transparent, #c9a961, transparent);
            margin: 12px auto;
          }
          
          .subtitle {
            font-size: 16px;
            color: #8b7355;
            text-transform: uppercase;
            letter-spacing: 5px;
            margin-bottom: 12px;
            font-family: 'Montserrat', sans-serif;
            font-weight: 400;
          }
          
          .date {
            font-size: 18px;
            color: #5a4a3a;
            font-style: italic;
            font-weight: 500;
          }
          
          .category {
            margin-bottom: 25px;
          }
          
          .category-header {
            font-size: 20px;
            font-weight: 600;
            color: #7a1f1f;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e8dcc8;
            font-family: 'Cormorant Garamond', Georgia, serif;
          }
          
          .category-items {
            padding-left: 8px;
          }
          
          .menu-item {
            display: flex;
            align-items: baseline;
            padding: 8px 0;
            font-size: 18px;
          }
          
          .item-name {
            color: #475569;
            font-weight: 500;
          }
          
          .item-dots {
            flex: 1;
            border-bottom: 2px dotted #d4c9b8;
            margin: 0 12px;
            min-width: 20px;
          }
          
          .item-price {
            color: #7a1f1f;
            font-weight: 700;
            white-space: nowrap;
            font-size: 18px;
          }
          
          .item-notes {
            font-size: 14px;
            color: #8b7355;
            font-style: italic;
            padding-left: 12px;
            margin-top: -3px;
            margin-bottom: 6px;
          }
          
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #c9a961;
          }
          
          .footer-text {
            font-size: 16px;
            color: #8b7355;
            font-style: italic;
            font-family: 'Cormorant Garamond', Georgia, serif;
          }
          
          .heart {
            color: #7a1f1f;
            font-size: 18px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">GIORGIO IV</div>
            <div class="divider"></div>
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
        <Text style={styles.headerTitle}>Menu Giornaliero</Text>
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

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB0007" />
        }
      >
        {!currentMenu ? (
          <View style={styles.noMenuContainer}>
            <Ionicons name="calendar-outline" size={64} color="#64748b" />
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
                    onPress={() => {
                      // Get unique categories from menu items
                      const menuCategories = [...new Set(currentMenu.items.map(item => item.categoryName || 'Altro'))];
                      setSelectedShareCategories(menuCategories); // Select all by default
                      setShowShareOptions(true);
                    }}
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.printMenuButtonText}>Condividi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Share Options Panel */}
              {showShareOptions && (
                <View style={styles.shareOptionsPanel}>
                  <View style={styles.shareOptionsHeader}>
                    <Text style={styles.shareOptionsTitle}>Seleziona categorie da condividere:</Text>
                    <TouchableOpacity onPress={() => setShowShareOptions(false)}>
                      <Ionicons name="close" size={20} color="#1a202c" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.shareCategoriesList}>
                    {[...new Set(currentMenu.items.map(item => item.categoryName || 'Altro'))].map(catName => (
                      <TouchableOpacity
                        key={catName}
                        style={[
                          styles.shareCategoryChip,
                          selectedShareCategories.includes(catName) && styles.shareCategoryChipActive
                        ]}
                        onPress={() => {
                          if (selectedShareCategories.includes(catName)) {
                            setSelectedShareCategories(selectedShareCategories.filter(c => c !== catName));
                          } else {
                            setSelectedShareCategories([...selectedShareCategories, catName]);
                          }
                        }}
                      >
                        <Ionicons 
                          name={selectedShareCategories.includes(catName) ? "checkbox" : "square-outline"} 
                          size={18} 
                          color={selectedShareCategories.includes(catName) ? "#00754A" : "#64748b"} 
                        />
                        <Text style={[
                          styles.shareCategoryText,
                          selectedShareCategories.includes(catName) && styles.shareCategoryTextActive
                        ]}>
                          {catName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.shareConfirmButton,
                      selectedShareCategories.length === 0 && styles.shareConfirmButtonDisabled
                    ]}
                    onPress={() => {
                      if (selectedShareCategories.length > 0) {
                        setShowShareOptions(false);
                        handlePrintMenu();
                      }
                    }}
                    disabled={selectedShareCategories.length === 0}
                  >
                    <Ionicons name="share-outline" size={18} color="#ffffff" />
                    <Text style={styles.shareConfirmButtonText}>Condividi ({selectedShareCategories.length} categorie)</Text>
                  </TouchableOpacity>
                </View>
              )}

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
                  {sortedCategories.map((category) => (
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
                // Filter and sort menu items by category
                const filteredItems = sortedMenuItems.filter(item => 
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
                          <Text style={styles.portionsText}>
                            {item.portions}/{item.initialPortions || item.portions} porz.
                          </Text>
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
                        <Ionicons name="trash-outline" size={22} color="#DB0007" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ));
              })()}
            </View>

            {/* Available Dishes - Grouped by Category */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Piatti Disponibili ({availableDishes.length})
                </Text>
              </View>

              {/* Free-text search for available dishes */}
              <View style={styles.availableSearchContainer} testID="available-search-container">
                <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.availableSearchInput}
                  value={availableSearchQuery}
                  onChangeText={setAvailableSearchQuery}
                  placeholder="Cerca piatto per nome..."
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="available-search-input"
                />
                {availableSearchQuery.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => setAvailableSearchQuery('')}
                    testID="available-search-clear"
                  >
                    <Ionicons name="close-circle" size={20} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {availableDishes.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    {availableSearchQuery.trim() || selectedCategoryFilter
                      ? 'Nessun piatto trovato'
                      : 'Tutti i piatti sono già nel menu'}
                  </Text>
                </View>
              ) : (
                (() => {
                  // Group dishes by category
                  const groupedDishes: Record<string, Dish[]> = {};
                  availableDishes.forEach(dish => {
                    const catName = dish.categoryName || 'Senza Categoria';
                    if (!groupedDishes[catName]) groupedDishes[catName] = [];
                    groupedDishes[catName].push(dish);
                  });
                  
                  return Object.entries(groupedDishes).map(([categoryName, dishesInCategory]) => (
                    <View key={`cat-${categoryName}`}>
                      <View style={styles.availableCategoryHeader}>
                        <Text style={styles.availableCategoryTitle}>{categoryName}</Text>
                        <Text style={styles.availableCategoryCount}>{dishesInCategory.length}</Text>
                      </View>
                      {dishesInCategory.map((dish) => (
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
                            <Ionicons name="add-circle" size={32} color="#00754A" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ));
                })()
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
                <Ionicons name="close" size={24} color="#1a202c" />
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
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                />

                <Text style={styles.inputLabel}>Prezzo Giornaliero *</Text>
                <TextInput
                  style={styles.textInput}
                  value={dailyPrice}
                  onChangeText={setDailyPrice}
                  placeholder="Prezzo in euro"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Note Operative</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Note per la preparazione..."
                  placeholderTextColor="#64748b"
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
                <Ionicons name="close" size={24} color="#1a202c" />
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
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                />

                <Text style={styles.inputLabel}>Prezzo Giornaliero</Text>
                <TextInput
                  style={styles.textInput}
                  value={dailyPrice}
                  onChangeText={setDailyPrice}
                  placeholder="Prezzo in euro"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Note Operative</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Note per la preparazione..."
                  placeholderTextColor="#64748b"
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
                <Ionicons name="close" size={24} color="#1a202c" />
              </TouchableOpacity>
            </View>

            {missedSaleItem && (
              <>
                <View style={styles.missedSaleDishInfo}>
                  <Ionicons name="alert-circle" size={40} color="#DB0007" />
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
    color: '#64748b',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  createMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DB0007',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  createMenuButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#5423E7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  emptySection: {
    padding: 24,
    alignItems: 'center',
  },
  emptySectionText: {
    color: '#64748b',
    fontSize: 14,
  },
  availableSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#dde4ee',
  },
  availableSearchInput: {
    flex: 1,
    color: '#1a202c',
    fontSize: 14,
    paddingVertical: 10,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  menuItemNotes: {
    fontSize: 13,
    color: '#64748b',
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
    color: '#00754A',
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
  menuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 10,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
  },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  dishInfo: {
    flex: 1,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  dishDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  dishPrice: {
    fontSize: 14,
    color: '#00754A',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonCancel: {
    flex: 1,
    backgroundColor: '#dde4ee',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    color: '#1a202c',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonConfirm: {
    flex: 1,
    backgroundColor: '#DB0007',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonConfirmText: {
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    color: '#1a202c',
  },
  selectedDishName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DB0007',
    marginBottom: 16,
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
  primaryButton: {
    backgroundColor: '#DB0007',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemCardSoldOut: {
    borderColor: '#DB0007',
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
    backgroundColor: '#DB0007',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  missedSaleHint: {
    color: '#DB0007',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  missedSaleDishInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
    marginBottom: 24,
  },
  missedSaleDishName: {
    color: '#1a202c',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  missedSaleExplanation: {
    color: '#64748b',
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
    backgroundColor: '#DB0007',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInputLarge: {
    backgroundColor: '#f5f7fa',
    color: '#1a202c',
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
    backgroundColor: '#DB0007',
    padding: 16,
    borderRadius: 10,
    gap: 8,
  },
  missedSaleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  missedSaleHelpText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  categoryFilter: {
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  categoryFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f5f7fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde4ee',
  },
  categoryChipActive: {
    backgroundColor: '#DB0007',
    borderColor: '#DB0007',
  },
  categoryChipText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: '#dde4ee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  printMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00754A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printMenuButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  availableCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#dde4ee',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f7fa',
  },
  availableCategoryTitle: {
    color: '#DB0007',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  availableCategoryCount: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  // Share options styles
  shareOptionsPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00754A',
  },
  shareOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shareOptionsTitle: {
    color: '#1a202c',
    fontSize: 14,
    fontWeight: '600',
  },
  shareCategoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  shareCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  shareCategoryChipActive: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    borderWidth: 1,
    borderColor: '#00754A',
  },
  shareCategoryText: {
    color: '#64748b',
    fontSize: 13,
  },
  shareCategoryTextActive: {
    color: '#1a202c',
  },
  shareConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00754A',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  shareConfirmButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.6,
  },
  shareConfirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
