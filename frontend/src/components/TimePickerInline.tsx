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

export const TimePickerInline: React.FC<TimePickerInlineProps> = ({ value, onChange, onClose, testIDPrefix = 'time-picker' }) => {
  return (
    <View style={styles.container} testID={testIDPrefix}>
      <View style={styles.row}>
        {Platform.OS === 'web' ? (
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
            <Text style={styles.nativeOnlyHint}>{value || '--:--'}</Text>
          </View>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID={`${testIDPrefix}-close`}>
            <Ionicons name="checkmark-circle" size={28} color="#27ae60" />
          </TouchableOpacity>
        )}
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
    color: '#f39c12',
    fontSize: 20,
    fontWeight: '700',
    padding: 14,
    backgroundColor: '#0f1a30',
    borderWidth: 1,
    borderColor: '#1f3a5a',
    borderRadius: 10,
  },
});

export default TimePickerInline;
