// Types for the Restaurant POS System

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: string;
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  categoryId?: string;
  categoryName?: string;
  active: boolean;
  isFavorite: boolean;
  createdAt: string;
}

export interface MenuItem {
  dishId: string;
  dishName: string;
  categoryId?: string;
  categoryName?: string;
  portions: number;
  dailyPrice: number;
  notes: string;
}

export interface DailyMenu {
  id: string;
  date: string;
  items: MenuItem[];
  createdAt: string;
}

export interface OrderItem {
  dishId: string;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  menuDate: string;
  channel: string;
  items: OrderItem[];
  total: number;
  status: 'in_attesa' | 'in_preparazione' | 'pronto' | 'sospeso';
  customerId?: string;
  customerName?: string;
  notes: string;
  createdAt: string;
}

export interface MissedSale {
  id: string;
  dishName: string;
  date: string;
  timeSlot: string;
  channel: string;
  quantity: number;
  customerId?: string;
  customerName?: string;
  reason: 'esaurito' | 'non_nel_menu';
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  customerType: 'persona' | 'societa';
  partitaIva: string;
  phone: string;
  email: string;
  address: string;
  requiresInvoice: boolean;
  notes: string;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  dishSales: {
    dishName: string;
    quantity: number;
    revenue: number;
  }[];
  channelBreakdown: Record<string, number>;
  menuItems: MenuItem[];
}
