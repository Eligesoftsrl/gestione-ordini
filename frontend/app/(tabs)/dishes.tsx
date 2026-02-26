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
import { useAppStore } from '../../src/store/appStore';
import { dishesApi, categoriesApi } from '../../src/services/api';
import { Dish, Category } from '../../src/types';

// Toast notification component
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

export default function DishesScreen() {
  const { dishes, setDishes } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDishModal, setShowDishModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };
  
  // Dish form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Category form state
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [dishesData, categoriesData] = await Promise.all([
        dishesApi.getAll(!showInactive, selectedCategoryFilter || undefined),
        categoriesApi.getAll(),
      ]);
      setDishes(dishesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Impossibile caricare i dati', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive, selectedCategoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const resetDishForm = () => {
    setName('');
    setDescription('');
    setBasePrice('');
    setSelectedCategoryId(null);
    setEditingDish(null);
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryOrder('');
    setEditingCategory(null);
  };

  const openCreateDishModal = () => {
    resetDishForm();
    setShowDishModal(true);
  };

  const openEditDishModal = (dish: Dish) => {
    setEditingDish(dish);
    setName(dish.name);
    setDescription(dish.description || '');
    setBasePrice(dish.basePrice.toString());
    setSelectedCategoryId(dish.categoryId || null);
    setShowDishModal(true);
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setCategoryOrder((categories.length + 1).toString());
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryOrder(category.order.toString());
    setShowCategoryModal(true);
  };

  const handleSaveDish = async () => {
    if (!name.trim()) {
      showToast('Inserisci il nome del piatto', 'error');
      return;
    }

    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) {
      showToast('Inserisci un prezzo valido', 'error');
      return;
    }

    try {
      if (editingDish) {
        const updated = await dishesApi.update(editingDish.id, {
          name: name.trim(),
          description: description.trim(),
          basePrice: price,
          categoryId: selectedCategoryId || undefined,
        });
        setDishes(dishes.map(d => d.id === updated.id ? updated : d));
        showToast('Piatto aggiornato');
      } else {
        const newDish = await dishesApi.create({
          name: name.trim(),
          description: description.trim(),
          basePrice: price,
          categoryId: selectedCategoryId || undefined,
        });
        setDishes([newDish, ...dishes]);
        showToast('Piatto creato');
      }
      
      setShowDishModal(false);
      resetDishForm();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile salvare il piatto', 'error');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      showToast('Inserisci il nome della categoria', 'error');
      return;
    }

    const order = parseInt(categoryOrder) || 0;

    try {
      if (editingCategory) {
        const updated = await categoriesApi.update(editingCategory.id, {
          name: categoryName.trim(),
          order,
        });
        setCategories(categories.map(c => c.id === updated.id ? updated : c));
        showToast('Categoria aggiornata');
      } else {
        const newCategory = await categoriesApi.create({
          name: categoryName.trim(),
          order,
        });
        setCategories([...categories, newCategory].sort((a, b) => a.order - b.order));
        showToast('Categoria creata');
      }
      
      setShowCategoryModal(false);
      resetCategoryForm();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile salvare la categoria', 'error');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    setConfirmDialog({
      visible: true,
      title: 'Elimina Categoria',
      message: `Vuoi eliminare la categoria "${category.name}"?`,
      onConfirm: async () => {
        try {
          await categoriesApi.delete(category.id);
          setCategories(categories.filter(c => c.id !== category.id));
          if (selectedCategoryFilter === category.id) {
            setSelectedCategoryFilter(null);
          }
          showToast('Categoria eliminata');
        } catch (error: any) {
          showToast(error.response?.data?.detail || 'Impossibile eliminare la categoria', 'error');
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleDeactivateDish = (dish: Dish) => {
    setConfirmDialog({
      visible: true,
      title: 'Disattiva Piatto',
      message: `Vuoi disattivare il piatto "${dish.name}"?`,
      onConfirm: async () => {
        try {
          await dishesApi.deactivate(dish.id);
          setDishes(dishes.filter(d => d.id !== dish.id));
          showToast('Piatto disattivato');
        } catch (error: any) {
          showToast(error.response?.data?.detail || 'Impossibile disattivare il piatto', 'error');
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleReactivateDish = async (dish: Dish) => {
    try {
      const updated = await dishesApi.update(dish.id, { active: true });
      setDishes(dishes.map(d => d.id === updated.id ? updated : d));
      showToast('Piatto riattivato');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Impossibile riattivare il piatto', 'error');
    }
  };

  // Group dishes by category
  const groupedDishes = dishes.reduce((acc, dish) => {
    const categoryName = dish.categoryName || 'Senza categoria';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(dish);
    return acc;
  }, {} as Record<string, Dish[]>);

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
        <Text style={styles.headerTitle}>Anagrafica Piatti</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterButton, showInactive && styles.filterButtonActive]}
            onPress={() => setShowInactive(!showInactive)}
          >
            <Ionicons name={showInactive ? 'eye' : 'eye-off'} size={16} color="#fff" />
            <Text style={styles.filterButtonText}>
              {showInactive ? 'Tutti' : 'Attivi'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton} onPress={openCreateCategoryModal}>
            <Ionicons name="pricetag" size={16} color="#fff" />
            <Text style={styles.categoryButtonText}>Categorie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openCreateDishModal}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Nuovo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter - Fixed height chips */}
      <View style={styles.categoryFilterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilterContent}>
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
              onLongPress={() => openEditCategoryModal(category)}
            >
              <Text style={[styles.categoryChipText, selectedCategoryFilter === category.id && styles.categoryChipTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          Object.entries(groupedDishes).map(([categoryName, categoryDishes]) => (
            <View key={categoryName} style={styles.categorySection}>
              <Text style={styles.categorySectionTitle}>{categoryName}</Text>
              {categoryDishes.map((dish) => (
                <View key={dish.id} style={[styles.dishCard, !dish.active && styles.dishCardInactive]}>
                  <View style={styles.dishHeader}>
                    <Text style={styles.dishName}>{dish.name}</Text>
                    {!dish.active && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Disattivo</Text>
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
                      onPress={() => openEditDishModal(dish)}
                    >
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={styles.dishActionText}>Modifica</Text>
                    </TouchableOpacity>
                    
                    {dish.active ? (
                      <TouchableOpacity
                        style={[styles.dishActionButton, styles.deactivateButton]}
                        onPress={() => handleDeactivateDish(dish)}
                      >
                        <Ionicons name="eye-off-outline" size={18} color="#fff" />
                        <Text style={styles.dishActionText}>Disattiva</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.dishActionButton, styles.activateButton]}
                        onPress={() => handleReactivateDish(dish)}
                      >
                        <Ionicons name="eye-outline" size={18} color="#fff" />
                        <Text style={styles.dishActionText}>Riattiva</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))
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

      {/* Dish Modal */}
      <Modal visible={showDishModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDish ? 'Modifica Piatto' : 'Nuovo Piatto'}
              </Text>
              <TouchableOpacity onPress={() => { setShowDishModal(false); resetDishForm(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nome Piatto *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Es: Pasta al pomodoro"
                placeholderTextColor="#8892b0"
              />

              <Text style={styles.inputLabel}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                <TouchableOpacity
                  style={[styles.categorySelectorChip, !selectedCategoryId && styles.categorySelectorChipActive]}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <Text style={[styles.categorySelectorChipText, !selectedCategoryId && styles.categorySelectorChipTextActive]}>
                    Nessuna
                  </Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categorySelectorChip, selectedCategoryId === category.id && styles.categorySelectorChipActive]}
                    onPress={() => setSelectedCategoryId(category.id)}
                  >
                    <Text style={[styles.categorySelectorChipText, selectedCategoryId === category.id && styles.categorySelectorChipTextActive]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveDish}>
                <Text style={styles.primaryButtonText}>
                  {editingDish ? 'Salva Modifiche' : 'Crea Piatto'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
              </Text>
              <TouchableOpacity onPress={() => { setShowCategoryModal(false); resetCategoryForm(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome Categoria *</Text>
            <TextInput
              style={styles.textInput}
              value={categoryName}
              onChangeText={setCategoryName}
              placeholder="Es: Primi, Secondi, Dolci..."
              placeholderTextColor="#8892b0"
            />

            <Text style={styles.inputLabel}>Ordine</Text>
            <TextInput
              style={styles.textInput}
              value={categoryOrder}
              onChangeText={setCategoryOrder}
              placeholder="1"
              placeholderTextColor="#8892b0"
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveCategory}>
              <Text style={styles.primaryButtonText}>
                {editingCategory ? 'Salva Modifiche' : 'Crea Categoria'}
              </Text>
            </TouchableOpacity>

            {editingCategory && (
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => {
                  setShowCategoryModal(false);
                  handleDeleteCategory(editingCategory);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteButtonText}>Elimina Categoria</Text>
              </TouchableOpacity>
            )}

            {/* Categories List */}
            <Text style={[styles.inputLabel, { marginTop: 24 }]}>Categorie Esistenti</Text>
            <ScrollView style={styles.categoriesList}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryListItem}
                  onPress={() => openEditCategoryModal(category)}
                >
                  <View style={styles.categoryOrderBadge}>
                    <Text style={styles.categoryOrderText}>{category.order}</Text>
                  </View>
                  <Text style={styles.categoryListItemText}>{category.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#8892b0" />
                </TouchableOpacity>
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
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 13,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9b59b6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 13,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  categoryFilterWrapper: {
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    height: 56,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f3460',
    borderRadius: 20,
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#e94560',
  },
  categoryChipText: {
    color: '#8892b0',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
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
  categorySection: {
    marginBottom: 20,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e94560',
    marginBottom: 12,
    paddingLeft: 4,
  },
  dishCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  dishCardInactive: {
    opacity: 0.6,
  },
  dishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dishName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  dishDescription: {
    fontSize: 13,
    color: '#8892b0',
    marginBottom: 8,
  },
  dishPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 12,
  },
  dishActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dishActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
    marginLeft: 4,
    fontSize: 12,
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
  categorySelector: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categorySelectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelectorChipActive: {
    borderColor: '#e94560',
    backgroundColor: '#e9456020',
  },
  categorySelectorChipText: {
    color: '#8892b0',
    fontSize: 14,
  },
  categorySelectorChipTextActive: {
    color: '#fff',
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoriesList: {
    maxHeight: 200,
    marginTop: 8,
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryOrderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  categoryListItemText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
});
