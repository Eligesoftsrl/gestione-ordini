import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimePickerInlineProps {
  value: string; // formato "HH:MM"
  onChange: (newValue: string) => void;
  testIDPrefix?: string;
}

const parseTime = (v: string): Date => {
  const d = new Date();
  if (v && /^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(13, 0, 0, 0); // default 13:00
  }
  return d;
};

const formatTime = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const TimePickerInline: React.FC<TimePickerInlineProps> = ({
  value,
  onChange,
  testIDPrefix = 'time-picker',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseTime(value));

  const openPicker = () => {
    setTempDate(parseTime(value));
    setShowPicker(true);
  };

  const closePicker = () => setShowPicker(false);
  const confirmPicker = () => {
    onChange(formatTime(tempDate));
    setShowPicker(false);
  };

  // Trigger button: same UI on all platforms
  const renderTrigger = () => (
    <TouchableOpacity
      style={styles.trigger}
      onPress={openPicker}
      testID={`${testIDPrefix}-trigger`}
    >
      <Ionicons name="time-outline" size={22} color="#FFBC0D" />
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
          <Ionicons name="close-circle" size={20} color="#64748b" />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-down" size={18} color="#64748b" />
    </TouchableOpacity>
  );

  // Web: usa il time input HTML5 nativo
  if (Platform.OS === 'web') {
    return (
      <View>
        <View style={styles.webInputWrap}>
          <Ionicons name="time-outline" size={22} color="#FFBC0D" />
          {React.createElement('input' as any, {
            type: 'time',
            value: value || '',
            onChange: (e: any) => onChange(e.target.value),
            style: {
              background: 'transparent',
              color: '#1a202c',
              border: 'none',
              padding: '12px 4px',
              fontSize: 18,
              fontWeight: '700',
              outline: 'none',
              fontFamily: 'inherit',
              flex: 1,
              colorScheme: 'dark',
            },
            'data-testid': `${testIDPrefix}-web-input`,
          })}
          {!!value && (
            <TouchableOpacity onPress={() => onChange('')} testID={`${testIDPrefix}-clear`}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // iOS: picker wheel inline dentro modal con "Conferma"/"Annulla"
  if (Platform.OS === 'ios') {
    return (
      <>
        {renderTrigger()}
        <Modal visible={showPicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.iosModalContent}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={closePicker} testID={`${testIDPrefix}-cancel`}>
                  <Text style={styles.iosCancelText}>Annulla</Text>
                </TouchableOpacity>
                <Text style={styles.iosTitle}>Seleziona ora</Text>
                <TouchableOpacity onPress={confirmPicker} testID={`${testIDPrefix}-confirm`}>
                  <Text style={styles.iosConfirmText}>Conferma</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                onChange={(_, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                themeVariant="light"
                textColor="#1a202c"
                locale="it-IT"
                is24Hour
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Android: il picker si apre come dialog nativo
  return (
    <>
      {renderTrigger()}
      {showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          is24Hour
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (event.type === 'set' && selectedDate) {
              onChange(formatTime(selectedDate));
            }
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  triggerText: {
    color: '#1a202c',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 1,
  },
  placeholderText: {
    color: '#64748b',
    fontWeight: '400',
    letterSpacing: 0,
  },
  webInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  iosModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#dde4ee',
  },
  iosTitle: {
    color: '#1a202c',
    fontSize: 16,
    fontWeight: '700',
  },
  iosCancelText: {
    color: '#64748b',
    fontSize: 16,
  },
  iosConfirmText: {
    color: '#FFBC0D',
    fontSize: 16,
    fontWeight: '700',
  },
  iosPicker: {
    backgroundColor: '#ffffff',
    height: 200,
  },
});

export default TimePickerInline;
