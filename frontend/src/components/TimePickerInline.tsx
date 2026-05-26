import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimePickerModal } from 'react-native-paper-dates';

interface TimePickerInlineProps {
  value: string; // formato "HH:MM"
  onChange: (newValue: string) => void;
  testIDPrefix?: string;
  label?: string;
}

const parseTime = (v: string): { hours: number; minutes: number } => {
  if (v && /^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':');
    return { hours: parseInt(h, 10) || 0, minutes: parseInt(m, 10) || 0 };
  }
  return { hours: 12, minutes: 0 };
};

const formatTime = (hours: number, minutes: number) =>
  `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

export const TimePickerInline: React.FC<TimePickerInlineProps> = ({
  value,
  onChange,
  testIDPrefix = 'time-picker',
  label = 'Seleziona ora',
}) => {
  const [visible, setVisible] = useState(false);

  const onConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
    setVisible(false);
    onChange(formatTime(hours, minutes));
  };

  const onDismiss = () => setVisible(false);
  const { hours, minutes } = parseTime(value);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        testID={`${testIDPrefix}-trigger`}
      >
        <Ionicons name="time-outline" size={22} color="#f39c12" />
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value || 'Tocca per scegliere'}
        </Text>
        {!!value && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onChange('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`${testIDPrefix}-clear`}
          >
            <Ionicons name="close-circle" size={20} color="#8892b0" />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-down" size={18} color="#8892b0" />
      </TouchableOpacity>

      <TimePickerModal
        visible={visible}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        hours={hours}
        minutes={minutes}
        label={label}
        cancelLabel="Annulla"
        confirmLabel="Conferma"
        animationType="fade"
        locale="it"
        use24HourClock
      />
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#0f3460',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  triggerText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 1,
  },
  placeholderText: {
    color: '#8892b0',
    fontWeight: '400',
    letterSpacing: 0,
  },
});

export default TimePickerInline;
