import axios from 'axios';
import { Dish, DailyMenu, Order, MissedSale, Customer, DailySummary, Category } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data;
  },
  
  create: async (data: { name: string; order?: number }): Promise<Category> => {
    const response = await api.post('/categories', data);
    return response.data;
  },
  
  update: async (id: string, data: { name?: string; order?: number }): Promise<Category> => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

// Dishes API
export const dishesApi = {
  getAll: async (activeOnly = true, categoryId?: string): Promise<Dish[]> => {
    const params = new URLSearchParams();
    params.append('active_only', activeOnly.toString());
    if (categoryId) params.append('category_id', categoryId);
    const response = await api.get(`/dishes?${params.toString()}`);
    return response.data;
  },
  
  getById: async (id: string): Promise<Dish> => {
    const response = await api.get(`/dishes/${id}`);
    return response.data;
  },
  
  create: async (data: { name: string; description?: string; basePrice: number; categoryId?: string }): Promise<Dish> => {
    const response = await api.post('/dishes', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<Dish>): Promise<Dish> => {
    const response = await api.put(`/dishes/${id}`, data);
    return response.data;
  },
  
  deactivate: async (id: string): Promise<void> => {
    await api.delete(`/dishes/${id}`);
  },
};

// Daily Menu API
export const menusApi = {
  getAll: async (limit = 30): Promise<DailyMenu[]> => {
    const response = await api.get(`/menus?limit=${limit}`);
    return response.data;
  },
  
  getByDate: async (date: string): Promise<DailyMenu> => {
    const response = await api.get(`/menus/date/${date}`);
    return response.data;
  },
  
  getById: async (id: string): Promise<DailyMenu> => {
    const response = await api.get(`/menus/${id}`);
    return response.data;
  },
  
  create: async (date: string): Promise<DailyMenu> => {
    const response = await api.post('/menus', { date });
    return response.data;
  },
  
  addItem: async (menuId: string, data: { dishId: string; portions: number; dailyPrice: number; notes?: string }): Promise<DailyMenu> => {
    const response = await api.post(`/menus/${menuId}/items`, data);
    return response.data;
  },
  
  updateItem: async (menuId: string, dishId: string, data: { portions?: number; dailyPrice?: number; notes?: string }): Promise<DailyMenu> => {
    const response = await api.put(`/menus/${menuId}/items/${dishId}`, data);
    return response.data;
  },
  
  removeItem: async (menuId: string, dishId: string): Promise<DailyMenu> => {
    const response = await api.delete(`/menus/${menuId}/items/${dishId}`);
    return response.data;
  },
};

// Orders API
export const ordersApi = {
  getAll: async (menuDate?: string, status?: string, limit = 100): Promise<Order[]> => {
    const params = new URLSearchParams();
    if (menuDate) params.append('menu_date', menuDate);
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    const response = await api.get(`/orders?${params.toString()}`);
    return response.data;
  },
  
  getById: async (id: string): Promise<Order> => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  
  create: async (menuDate: string, data: { channel: string; customerId?: string; customerName?: string; notes?: string }): Promise<Order> => {
    const response = await api.post(`/orders?menu_date=${menuDate}`, data);
    return response.data;
  },
  
  addItem: async (orderId: string, data: { dishId: string; quantity: number }): Promise<Order> => {
    const response = await api.post(`/orders/${orderId}/items`, data);
    return response.data;
  },
  
  removeItem: async (orderId: string, dishId: string): Promise<Order> => {
    const response = await api.delete(`/orders/${orderId}/items/${dishId}`);
    return response.data;
  },
  
  updateStatus: async (orderId: string, status: string): Promise<Order> => {
    const response = await api.put(`/orders/${orderId}/status`, { status });
    return response.data;
  },
};

// Missed Sales API
export const missedSalesApi = {
  getAll: async (date?: string, limit = 100): Promise<MissedSale[]> => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('limit', limit.toString());
    const response = await api.get(`/missed-sales?${params.toString()}`);
    return response.data;
  },
  
  create: async (data: Omit<MissedSale, 'id' | 'createdAt'>): Promise<MissedSale> => {
    const response = await api.post('/missed-sales', data);
    return response.data;
  },
};

// Customers API
export const customersApi = {
  getAll: async (limit = 100): Promise<Customer[]> => {
    const response = await api.get(`/customers?limit=${limit}`);
    return response.data;
  },
  
  getById: async (id: string): Promise<Customer> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
  
  create: async (data: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> => {
    const response = await api.post('/customers', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },
  
  getOrders: async (customerId: string): Promise<Order[]> => {
    const response = await api.get(`/customers/${customerId}/orders`);
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getDailySummary: async (date: string): Promise<DailySummary> => {
    const response = await api.get(`/reports/daily-summary?date=${date}`);
    return response.data;
  },
  
  getTopDishes: async (startDate?: string, endDate?: string, limit = 10) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('limit', limit.toString());
    const response = await api.get(`/reports/top-dishes?${params.toString()}`);
    return response.data;
  },
  
  getMissedSalesSummary: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get(`/reports/missed-sales-summary?${params.toString()}`);
    return response.data;
  },
};

export default api;
