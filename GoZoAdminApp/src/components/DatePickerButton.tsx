import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';

interface DatePickerButtonProps {
  date: Date | null;
  onChange: (date: Date | null) => void;
}

export default function DatePickerButton({ date, onChange }: DatePickerButtonProps) {
  const [show, setShow] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios'); // For iOS, keep open; for Android, close
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatDateLabel = (d: Date | null) => {
    if (!d) return 'All Dates ▾';
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today ▾';
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday ▾';
    
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()} ▾`;
  };

  return (
    <View>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={() => setShow(true)}>
          <Text style={styles.text}>{formatDateLabel(date)}</Text>
        </TouchableOpacity>
        {date && (
          <TouchableOpacity style={styles.clearButton} onPress={() => onChange(null)}>
            <Text style={styles.clearText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {show && (
        <DateTimePicker
          value={date || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  text: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: COLORS.cancelled + '15',
    borderColor: COLORS.cancelled,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  clearText: {
    color: COLORS.cancelled,
    fontWeight: '700',
    fontSize: 14,
  },
});
