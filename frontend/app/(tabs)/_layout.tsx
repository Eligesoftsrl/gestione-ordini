import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { kitchenApi } from '../../src/services/api';
import { useAppStore } from '../../src/store/appStore';

export default function TabLayout() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [pendingKitchen, setPendingKitchen] = useState(0);
  const intervalRef = useRef<any>(null);

  const refreshCount = async () => {
    // Il contatore riflette il giorno CORRENTE reale (non selectedDate scelta dall'utente),
    // perché la Cucina lavora sul giorno attuale.
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      const groups = await kitchenApi.getForDate(today);
      const total = groups.reduce((sum, g) => sum + g.pendingQuantity, 0);
      setPendingKitchen(total);
    } catch {
      // fallisce silenziosamente
    }
  };

  useEffect(() => {
    refreshCount();
    // poll ogni 15s
    intervalRef.current = setInterval(refreshCount, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh anche quando cambia la data selezionata (l'utente potrebbe aver modificato ordini di oggi)
  useEffect(() => {
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#DB0007',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ordini',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dishes"
        options={{
          title: 'Piatti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fast-food-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clienti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
          tabBarBadge: pendingKitchen > 0 ? pendingKitchen : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#dde4ee',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#DB0007',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 20,
    height: 20,
    lineHeight: 20,
    borderRadius: 10,
  },
});
