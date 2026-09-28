import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Input } from '../common/Input';
import { FormModal } from '../common/FormModal';
import { followUpApi } from '../../api/followUpApi';

interface FollowUpModalProps {
  visible: boolean;
  leadId: number;
  leadName?: string;
  onClose: () => void;
  onScheduled?: () => void;
  onFollowUpCreated?: () => void;
}

const QUICK_12H_PRESETS = [
  { label: '10:00 AM', time: '10:00', period: 'AM' },
  { label: '11:30 AM', time: '11:30', period: 'AM' },
  { label: '01:00 PM', time: '01:00', period: 'PM' },
  { label: '02:30 PM', time: '02:30', period: 'PM' },
  { label: '04:00 PM', time: '04:00', period: 'PM' },
  { label: '06:00 PM', time: '06:00', period: 'PM' },
];

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  visible,
  leadId,
  leadName,
  onClose,
  onScheduled,
  onFollowUpCreated,
}) => {
  // Default tomorrow at 10:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [dateStr, setDateStr] = useState(defaultDate);
  const [time12Str, setTime12Str] = useState('10:00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Convert 12-hour (hh:mm AM/PM) to 24-hour (HH:mm)
  const get24HourTime = (t12: string, ampm: 'AM' | 'PM'): string => {
    const parts = t12.trim().split(':');
    let h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (isNaN(h)) h = 10;
    const safeMin = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const pad2 = (n: number) => n.toString().padStart(2, '0');
    return `${pad2(h)}:${pad2(safeMin)}`;
  };

  const handleSave = async () => {
    if (!dateStr.trim() || !time12Str.trim()) {
      Alert.alert('Validation Error', 'Please specify both follow-up date and time.');
      return;
    }

    const time24 = get24HourTime(time12Str, period);
    // Ensure format YYYY-MM-DDTHH:mm:ss for backend LocalDateTime parser
    const scheduledTime = `${dateStr.trim()}T${time24}:00`;

    setSubmitting(true);
    try {
      await followUpApi.createFollowUp({
        leadId,
        scheduledTime,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', `Follow-up scheduled for ${dateStr} at ${time12Str} ${period}.`);
      if (onScheduled) onScheduled();
      else if (onFollowUpCreated) onFollowUpCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to schedule follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title="Schedule Follow-up"
      subtitle={leadName}
      onSave={handleSave}
      saveTitle="Schedule"
      saveLoading={submitting}
      saveVariant="primary"
      heightPercent={0.84}
      maxHeightPixels={620}
    >
      <Input
        label="Follow-up Date (YYYY-MM-DD) *"
        placeholder="e.g. 2026-09-26"
        value={dateStr}
        onChangeText={setDateStr}
        leftIcon="calendar-outline"
      />

      <View style={styles.timeSectionHeader}>
        <Text style={styles.timeLabel}>Follow-up Time (12-Hour Format) *</Text>
      </View>

      <View style={styles.timeInputRow}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="e.g. 10:30"
            value={time12Str}
            onChangeText={setTime12Str}
            leftIcon="time-outline"
            style={{ marginBottom: 0 }}
          />
        </View>

        {/* AM / PM Toggle */}
        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
            onPress={() => setPeriod('AM')}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
            onPress={() => setPeriod('PM')}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick 12-Hour Suggestions */}
      <Text style={styles.quickLabel}>Quick Suggestions:</Text>
      <View style={styles.quickTimeRow}>
        {QUICK_12H_PRESETS.map((item) => {
          const isSelected = time12Str === item.time && period === item.period;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickTimeChip, isSelected && styles.quickTimeChipActive]}
              onPress={() => {
                setTime12Str(item.time);
                setPeriod(item.period as 'AM' | 'PM');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickTimeText, isSelected && styles.quickTimeTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Agenda & Follow-up Notes"
        placeholder="e.g. Demo presentation, price negotiation..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={styles.textArea}
      />
    </FormModal>
  );
};

const styles = StyleSheet.create({
  timeSectionHeader: {
    marginBottom: 6,
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  quickLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
    marginTop: 2,
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickTimeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quickTimeChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary,
  },
  quickTimeText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  quickTimeTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
});
