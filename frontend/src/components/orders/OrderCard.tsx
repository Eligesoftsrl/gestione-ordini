import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Order } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  in_attesa: '#f39c12',
  in_preparazione: '#3498db',
  pronto: '#27ae60',
  sospeso: '#9b59b6',
  consegnato: '#1abc9c',
};

const STATUS_LABELS: Record<string, string> = {
  in_attesa: 'In Attesa',
  in_preparazione: 'In Preparazione',
  pronto: 'Pronto',
  sospeso: 'Sospeso',
  consegnato: 'Consegnato',
};

interface OrderCardProps {
  order: Order;
  onPress: (order: Order) => void;
  onTogglePayment: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onPress, onTogglePayment }) => {
  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        { borderLeftColor: STATUS_COLORS[order.status] || '#666' }
      ]}
      onPress={() => onPress(order)}
      data-testid={`order-card-${order.orderNumber}`}
    >
      <View style={styles.orderCardHeader}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
          </View>
        </View>
        <Text style={styles.customerName}>
          {order.customerName || 'Anonimo'}
        </Text>
      </View>
      <View style={styles.orderCardBody}>
        <Text style={styles.orderItems}>
          {order.items.length} piatt{order.items.length === 1 ? 'o' : 'i'}
        </Text>
      </View>
      <View style={styles.orderCardFooter}>
        <Text style={styles.orderTotal}>{order.total.toFixed(2)} €</Text>
        <View style={styles.orderFooterRight}>
          <TouchableOpacity 
            style={[
              styles.paymentToggle,
              order.isPaid ? styles.paymentTogglePaid : styles.paymentToggleUnpaid
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onTogglePayment(order);
            }}
            data-testid={`payment-toggle-${order.orderNumber}`}
          >
            <Ionicons 
              name="card" 
              size={14} 
              color={order.isPaid ? "#27ae60" : "#e74c3c"} 
            />
          </TouchableOpacity>
          <Text style={styles.orderTime}>
            {format(new Date(order.createdAt), 'HH:mm')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    color: '#8892b0',
    fontSize: 14,
  },
  orderCardBody: {
    marginBottom: 8,
  },
  orderItems: {
    color: '#8892b0',
    fontSize: 13,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    color: '#27ae60',
    fontSize: 18,
    fontWeight: '700',
  },
  orderFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentTogglePaid: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  paymentToggleUnpaid: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  orderTime: {
    color: '#8892b0',
    fontSize: 13,
  },
});

export default OrderCard;
