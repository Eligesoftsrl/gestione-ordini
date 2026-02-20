import { create } from 'zustand';
import { Dish, DailyMenu, Order, Customer } from '../types';
import { format } from 'date-fns';

interface AppState {
  // Current date for operations
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  
  // Dishes
  dishes: Dish[];
  setDishes: (dishes: Dish[]) => void;
  
  // Current menu
  currentMenu: DailyMenu | null;
  setCurrentMenu: (menu: DailyMenu | null) => void;
  
  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  
  // Current order being edited
  currentOrder: Order | null;
  setCurrentOrder: (order: Order | null) => void;
  
  // Customers
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  
  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  dishes: [],
  setDishes: (dishes) => set({ dishes }),
  
  currentMenu: null,
  setCurrentMenu: (menu) => set({ currentMenu: menu }),
  
  orders: [],
  setOrders: (orders) => set({ orders }),
  
  currentOrder: null,
  setCurrentOrder: (order) => set({ currentOrder: order }),
  
  customers: [],
  setCustomers: (customers) => set({ customers }),
  
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
