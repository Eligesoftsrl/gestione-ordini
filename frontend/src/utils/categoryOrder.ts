// Utility functions for the app

import { Category, Dish, MenuItem } from '../types';

// Fixed category order: Primi, Secondi, Contorni, Piatti Freddi, Fuori Menù, then everything else
const CATEGORY_ORDER: string[] = [
  'Primi',
  'Secondi', 
  'Contorni',
  'Piatti Freddi',
  'Fuori Menù',
];

/**
 * Sort categories by the fixed order defined above.
 * Categories not in the fixed order will appear at the end, sorted by their original order.
 */
export const sortCategoriesByFixedOrder = (categories: Category[]): Category[] => {
  return [...categories].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a.name);
    const indexB = CATEGORY_ORDER.indexOf(b.name);
    
    // Both in fixed order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // Only A in fixed order
    if (indexA !== -1) {
      return -1;
    }
    
    // Only B in fixed order
    if (indexB !== -1) {
      return 1;
    }
    
    // Neither in fixed order - sort by original order field
    return a.order - b.order;
  });
};

/**
 * Sort dishes by category following the fixed category order.
 */
export const sortDishesByCategory = (
  dishes: Dish[], 
  categories: Category[]
): Dish[] => {
  const sortedCategories = sortCategoriesByFixedOrder(categories);
  const categoryOrderMap = new Map<string, number>();
  
  sortedCategories.forEach((cat, index) => {
    categoryOrderMap.set(cat.id, index);
  });
  
  return [...dishes].sort((a, b) => {
    const orderA = a.categoryId ? (categoryOrderMap.get(a.categoryId) ?? 999) : 999;
    const orderB = b.categoryId ? (categoryOrderMap.get(b.categoryId) ?? 999) : 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Same category - sort by name
    return a.name.localeCompare(b.name, 'it');
  });
};

/**
 * Sort menu items by category following the fixed category order.
 */
export const sortMenuItemsByCategory = (
  items: MenuItem[],
  categories: Category[]
): MenuItem[] => {
  const sortedCategories = sortCategoriesByFixedOrder(categories);
  const categoryOrderMap = new Map<string, number>();
  
  sortedCategories.forEach((cat, index) => {
    categoryOrderMap.set(cat.id, index);
  });
  
  return [...items].sort((a, b) => {
    const orderA = a.categoryId ? (categoryOrderMap.get(a.categoryId) ?? 999) : 999;
    const orderB = b.categoryId ? (categoryOrderMap.get(b.categoryId) ?? 999) : 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Same category - sort by name
    return a.dishName.localeCompare(b.dishName, 'it');
  });
};

/**
 * Get category order index for a given category name
 */
export const getCategoryOrderIndex = (categoryName: string): number => {
  const index = CATEGORY_ORDER.indexOf(categoryName);
  return index !== -1 ? index : CATEGORY_ORDER.length + 1;
};
