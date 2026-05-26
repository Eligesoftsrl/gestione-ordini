import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimePickerInlineProps {
  value: string; // formato "HH:MM"
  onChange: (newValue: string) => void;
  onClose?: () => void;
  testIDPrefix?: string;
}

// Picker minimale: su web (iPad Safari incluso) usa il time input nativo
// del browser → apre lo spinner/wheel nativo del sistema operativo.
// Su mobile native (Expo Go iOS/Android) mostra solo le shortcut pranzo/cena.

const QUICK_PRESETS = [
  { label: 'Pranzo', time: '13:00' },
  { label: 'Cena', time: '20:00' },
];

export const TimePickerInline: React.FC<TimePickerInlineProps> = ({ value, onChange, onClose, testIDPrefix = 'time-picker' }) => {
  return (
    <View style={styles.container} testID={testIDPrefix}>
      <View style={styles.row}>
        {Platform.OS === 'web' ? (
          // Native HTML5 time input — apre il picker nativo OS (su iPad mostra il wheel)
          <View style={styles.inputWrap}>
            {React.createElement('input' as any, {
              type: 'time',
              value: value || '',
              onChange: (e: any) => onChange(e.target.value),
              style: {
                background: '#0f1a30',
                color: '#f39c12',
                border: '1px solid #1f3a5a',
                borderRadius: 10,
                padding: '14px 12px',
                fontSize: 20,
                fontWeight: '700',
                width: '100%',
                outline: 'none',
                fontFamily: 'inherit',
              },
              'data-testid': `${testIDPrefix}-input`,
            })}
          </View>
        ) : (
          <View style={styles.inputWrap}>
            <Text style={styles.nativeOnlyHint}>
              {value || 'Usa i preset rapidi qui sotto'}
            </Text>
          </View>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID={`${testIDPrefix}-close`}>
            <Ionicons name="checkmark-circle" size={28} color="#27ae60" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.presetsRow}>
        {QUICK_PRESETS.map((p) => {
          const isActive = p.time === value;
          return (
            <TouchableOpacity
              key={p.time}
              style={[styles.presetChip, isActive && styles.presetChipActive]}
              onPress={() => onChange(p.time)}
              testID={`${testIDPrefix}-preset-${p.time}`}
            >
              <Ionicons name="restaurant-outline" size={14} color={isActive ? '#fff' : '#f39c12'} />
              <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                {p.label} {p.time}
              </Text>
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
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f3a5a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: 4,
  },
  nativeOnlyHint: {
    color: '#8892b0',
    fontSize: 14,
    padding: 14,
    backgroundColor: '#0f1a30',
    borderWidth: 1,
    borderColor: '#1f3a5a',
    borderRadius: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f39c12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  presetChipActive: {
    backgroundColor: '#f39c12',
  },
  presetText: {
    color: '#f39c12',
    fontSize: 12,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#fff',
  },
});

export default TimePickerInline;
