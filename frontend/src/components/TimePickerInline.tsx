import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimePickerInlineProps {
  value: string; // formato "HH:MM"
  onChange: (newValue: string) => void;
  onClose?: () => void;
  testIDPrefix?: string;
}

// Genera array di valori a 2 cifre [00..23] o [00, 05, ..., 55]
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

export const TimePickerInline: React.FC<TimePickerInlineProps> = ({ value, onChange, onClose, testIDPrefix = 'time-picker' }) => {
  // Stato interno: ora e minuti correnti
  const [hour, setHour] = useState<string>('12');
  const [minute, setMinute] = useState<string>('00');

  // Inizializza dai valore esterno se presente
  useEffect(() => {
    if (value && /^\d{1,2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':');
      setHour(h.padStart(2, '0'));
      setMinute(m);
    }
  }, [value]);

  const handlePickHour = (h: string) => {
    setHour(h);
    onChange(`${h}:${minute}`);
  };

  const handlePickMinute = (m: string) => {
    setMinute(m);
    onChange(`${hour}:${m}`);
  };

  return (
    <View style={styles.container} testID={testIDPrefix}>
      {/* Anteprima ora corrente */}
      <View style={styles.header}>
        <Ionicons name="time-outline" size={22} color="#f39c12" />
        <Text style={styles.currentTimeText} testID={`${testIDPrefix}-current`}>
          {hour}:{minute}
        </Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID={`${testIDPrefix}-close`}>
            <Ionicons name="checkmark-circle" size={26} color="#27ae60" />
          </TouchableOpacity>
        )}
      </View>

      {/* Sezione Ore */}
      <Text style={styles.sectionLabel}>Ora</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gridScrollContent}
        nestedScrollEnabled
      >
        <View style={styles.gridWrap}>
          {HOURS.map((h) => {
            const isSelected = h === hour;
            return (
              <TouchableOpacity
                key={`h-${h}`}
                style={[styles.cell, isSelected && styles.cellSelected]}
                onPress={() => handlePickHour(h)}
                testID={`${testIDPrefix}-hour-${h}`}
              >
                <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>{h}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Sezione Minuti */}
      <Text style={styles.sectionLabel}>Minuti</Text>
      <View style={styles.minutesRow}>
        {MINUTES.map((m) => {
          const isSelected = m === minute;
          return (
            <TouchableOpacity
              key={`m-${m}`}
              style={[styles.cell, styles.cellMinute, isSelected && styles.cellSelected]}
              onPress={() => handlePickMinute(m)}
              testID={`${testIDPrefix}-minute-${m}`}
            >
              <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1a30',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f3a5a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f3a5a',
  },
  currentTimeText: {
    color: '#f39c12',
    fontSize: 26,
    fontWeight: 'bold',
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: 6,
  },
  sectionLabel: {
    color: '#8892b0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridScrollContent: {
    paddingVertical: 2,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 6 * 56,
  },
  cell: {
    width: 50,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1a2a45',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellMinute: {
    flex: 1,
    minWidth: 44,
    maxWidth: 70,
  },
  cellSelected: {
    backgroundColor: '#f39c12',
    borderColor: '#fff',
  },
  cellText: {
    color: '#cdd6f4',
    fontSize: 15,
    fontWeight: '600',
  },
  cellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  minutesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
});

export default TimePickerInline;
