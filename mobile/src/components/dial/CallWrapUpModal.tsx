import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { callApi } from '../../api/callApi';
import { Call, CallEventPayload } from '../../types';

interface CallWrapUpModalProps {
  visible: boolean;
  leadId?: number;
  leadName?: string;
  phoneNumber: string;
  telephonyCallId: string;
  initialDurationSeconds: number;
  onClose: () => void;
  onCompleted: (call: Call) => void;
}

// Missed call optional technical reasons
const UNANSWERED_REASONS = [
  { id: 'MISSED', label: 'No Answer / Ring Out' },
  { id: 'REJECTED', label: 'Busy / Rejected' },
  { id: 'FAILED', label: 'Network Failed' },
] as const;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CallWrapUpModal: React.FC<CallWrapUpModalProps> = ({
  visible,
  leadId,
  leadName,
  phoneNumber,
  telephonyCallId,
  initialDurationSeconds,
  onClose,
  onCompleted,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Answered state
  const [didAnswer, setDidAnswer] = useState<boolean>(initialDurationSeconds >= 10);
  const [durationSeconds, setDurationSeconds] = useState<number>(Math.max(1, initialDurationSeconds));
  const [unansweredReason, setUnansweredReason] = useState<string>('MISSED');
  const [notes, setNotes] = useState<string>('');

  // Duration Edit Modal State
  const [editDurationModalVisible, setEditDurationModalVisible] = useState<boolean>(false);
  const [editMinutes, setEditMinutes] = useState<string>('00');
  const [editSeconds, setEditSeconds] = useState<string>('00');

  // Follow-up state (Action only, NOT a status)
  const [showFollowUp, setShowFollowUp] = useState<boolean>(false);

  // Follow-up Custom Date & Time state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default tomorrow
    return d;
  });
  const [timeHour, setTimeHour] = useState<string>('10');
  const [timeMinute, setTimeMinute] = useState<string>('30');
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>('AM');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<boolean>(false);
  const [showCustomTimePicker, setShowCustomTimePicker] = useState<boolean>(false);
  const [customDateInput, setCustomDateInput] = useState<string>('');
  const [followUpNote, setFollowUpNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const defaultAnswered = initialDurationSeconds >= 10;
    setDidAnswer(defaultAnswered);
    const initialSec = Math.max(1, initialDurationSeconds);
    setDurationSeconds(initialSec);
    setUnansweredReason('MISSED');
    setShowFollowUp(false);
    setShowCustomDatePicker(false);
    setShowCustomTimePicker(false);
    setEditDurationModalVisible(false);

    const defaultTomorrow = new Date();
    defaultTomorrow.setDate(defaultTomorrow.getDate() + 1);
    setSelectedDate(defaultTomorrow);
    setTimeHour('10');
    setTimeMinute('30');
    setTimePeriod('AM');
    setCustomDateInput(defaultTomorrow.toISOString().split('T')[0]);
    setFollowUpNote('');
    setNotes('');
  }, [initialDurationSeconds, visible]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const formatDateDisplay = (d: Date) => {
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatTimeDisplay = () => {
    const h = timeHour.padStart(2, '0');
    const m = timeMinute.padStart(2, '0');
    return `${h}:${m} ${timePeriod}`;
  };

  // Strictly 4 Call Statuses:
  // 1. PROSPECT: Answered + duration > 300s (> 5m)
  // 2. CONNECTED: Answered + duration >= 30s && <= 300s
  // 3. JUNK: Answered + duration < 30s
  // 4. MISSED: Not answered
  const getStatusBadgeConfig = () => {
    if (!didAnswer || durationSeconds <= 0) {
      return {
        status: 'MISSED',
        icon: 'call' as const,
        gradient: ['#EF4444', '#DC2626'] as [string, string],
      };
    }
    if (durationSeconds < 30) {
      return {
        status: 'JUNK',
        icon: 'time' as const,
        gradient: ['#F59E0B', '#EA580C'] as [string, string],
      };
    }
    if (durationSeconds <= 300) {
      return {
        status: 'CONNECTED',
        icon: 'call' as const,
        gradient: ['#00D09C', '#059669'] as [string, string],
      };
    }
    return {
      status: 'PROSPECT',
      icon: 'star' as const,
      gradient: ['#8B5CF6', '#6D28D9'] as [string, string],
    };
  };

  const statusBadge = getStatusBadgeConfig();

  const handleOpenEditDuration = () => {
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    setEditMinutes(mins.toString().padStart(2, '0'));
    setEditSeconds(secs.toString().padStart(2, '0'));
    setEditDurationModalVisible(true);
  };

  const handleSaveEditedDuration = () => {
    let m = parseInt(editMinutes, 10);
    if (isNaN(m) || m < 0) m = 0;
    let s = parseInt(editSeconds, 10);
    if (isNaN(s) || s < 0) s = 0;
    if (s > 59) s = 59;

    const totalSecs = Math.max(1, m * 60 + s);
    setDurationSeconds(totalSecs);
    setEditDurationModalVisible(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      let followUpDate: string | undefined = undefined;
      if (showFollowUp) {
        let h = parseInt(timeHour, 10);
        if (isNaN(h)) h = 10;
        let m = parseInt(timeMinute, 10);
        if (isNaN(m)) m = 0;

        if (timePeriod === 'PM' && h < 12) h += 12;
        if (timePeriod === 'AM' && h === 12) h = 0;

        const d = new Date(selectedDate);
        d.setHours(h, m, 0, 0);
        followUpDate = d.toISOString();
      }

      const payload: CallEventPayload = {
        eventType: didAnswer ? 'CALL_ENDED' : 'CALL_MISSED',
        telephonyCallId,
        leadId,
        customerPhone: phoneNumber,
        durationSeconds: didAnswer ? Math.max(1, durationSeconds) : 0,
        isConnected: didAnswer,
        technicalStatus: didAnswer ? 'CONNECTED' : unansweredReason,
        businessClassification: undefined,
        notes: notes.trim() || undefined,
        followUpRequired: showFollowUp,
        followUpDate: showFollowUp ? followUpDate : undefined,
        followUpNotes: showFollowUp
          ? followUpNote.trim() || `Follow-up scheduled for ${formatDateDisplay(selectedDate)} at ${formatTimeDisplay()}`
          : undefined,
      };

      const result = await callApi.sendCallEvent(payload);
      onCompleted(result);
    } catch (err: any) {
      console.warn('Failed to submit call wrap-up event:', err);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDateSelect = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setSelectedDate(target);
    setCustomDateInput(target.toISOString().split('T')[0]);
    setShowCustomDatePicker(false);
  };

  const applyCustomDate = (text: string) => {
    setCustomDateInput(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed >= today) {
        setSelectedDate(parsed);
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheetContainer, { maxHeight: screenHeight * 0.88 }]}>
          {/* Top Pill Handle */}
          <View style={styles.handle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={didAnswer ? ['#00D09C', '#06B6D4'] : ['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.callIconCircle}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.headerTitleCol}>
                <Text style={styles.customerCallLabel}>CUSTOMER CALL</Text>
                <Text style={styles.phoneHeadline} numberOfLines={1}>
                  {phoneNumber}
                </Text>
              </View>
            </View>

            {/* Top Right Status Badge */}
            <LinearGradient
              colors={statusBadge.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerStatusBadge}
            >
              <Ionicons name={statusBadge.icon} size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.headerStatusBadgeText}>{statusBadge.status}</Text>
            </LinearGradient>
          </View>

          {/* Scrollable Body - Naturally wraps content without forced empty space */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Question: Did the customer answer? */}
            <Text style={styles.fieldSectionTitle}>Did the customer answer?</Text>
            <View style={styles.answerRow}>
              {/* Answered Button */}
              <TouchableOpacity
                style={[
                  styles.answerChoiceBtn,
                  didAnswer ? styles.answerChoiceBtnAnsweredActive : styles.answerChoiceBtnInactive,
                ]}
                onPress={() => setDidAnswer(true)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.answerIconCircle,
                    didAnswer ? styles.answerIconCircleGreenActive : styles.answerIconCircleMuted,
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={didAnswer ? '#FFFFFF' : '#94A3B8'}
                  />
                </View>
                <Text
                  style={[
                    styles.answerChoiceBtnText,
                    didAnswer ? styles.answerChoiceBtnTextGreen : styles.answerChoiceBtnTextMuted,
                  ]}
                >
                  Answered
                </Text>
              </TouchableOpacity>

              {/* Not Answered Button */}
              <TouchableOpacity
                style={[
                  styles.answerChoiceBtn,
                  !didAnswer ? styles.answerChoiceBtnUnansweredActive : styles.answerChoiceBtnInactive,
                ]}
                onPress={() => setDidAnswer(false)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.answerIconCircle,
                    !didAnswer ? styles.answerIconCircleRedActive : styles.answerIconCircleMuted,
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={15}
                    color={!didAnswer ? '#FFFFFF' : '#94A3B8'}
                  />
                </View>
                <Text
                  style={[
                    styles.answerChoiceBtnText,
                    !didAnswer ? styles.answerChoiceBtnTextRed : styles.answerChoiceBtnTextMuted,
                  ]}
                >
                  Not Answered
                </Text>
              </TouchableOpacity>
            </View>

            {/* ANSWERED STATE: Conversation Duration with Edit Icon */}
            {didAnswer && (
              <View style={styles.durationSection}>
                <Text style={styles.fieldSectionTitle}>Conversation Duration</Text>
                <View style={styles.durationInputContainer}>
                  <View style={styles.durationLeftGroup}>
                    <Ionicons name="time-outline" size={20} color="#6366F1" style={{ marginRight: 10 }} />
                    <Text style={styles.durationDisplayText}>{formatDuration(durationSeconds)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editDurationBtn}
                    onPress={handleOpenEditDuration}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={17} color="#6366F1" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* UNANSWERED STATE: Select Reason (Optional) */}
            {!didAnswer && (
              <View style={styles.reasonSection}>
                <Text style={styles.fieldSectionTitle}>Select Reason (Optional)</Text>
                <View style={styles.reasonPillsWrap}>
                  {UNANSWERED_REASONS.map((reason) => {
                    const isSelected = unansweredReason === reason.id;
                    return (
                      <TouchableOpacity
                        key={reason.id}
                        style={[
                          styles.reasonPill,
                          isSelected ? styles.reasonPillActive : styles.reasonPillInactive,
                        ]}
                        onPress={() => setUnansweredReason(reason.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={reason.id === 'FAILED' ? 'cloud-offline-outline' : 'close-circle-outline'}
                          size={16}
                          color={isSelected ? '#EF4444' : '#94A3B8'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.reasonPillText,
                            isSelected ? styles.reasonPillTextActive : styles.reasonPillTextInactive,
                          ]}
                        >
                          {reason.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Schedule Follow-up (Action Only, NOT a Status) */}
            <View style={styles.followUpCardSection}>
              <TouchableOpacity
                style={[styles.followUpCard, showFollowUp && styles.followUpCardExpanded]}
                onPress={() => setShowFollowUp(!showFollowUp)}
                activeOpacity={0.8}
              >
                <View style={styles.followUpCardLeft}>
                  <View style={[styles.followUpCalendarTile, showFollowUp && styles.followUpCalendarTileActive]}>
                    <Ionicons name="calendar" size={18} color={showFollowUp ? '#6366F1' : '#7C3AED'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.followUpCardTitle, showFollowUp && styles.followUpCardTitleActive]}>
                      {showFollowUp ? 'Follow-up Scheduled' : 'Schedule Follow-up'}
                    </Text>
                    <Text style={styles.followUpCardSub}>
                      {showFollowUp
                        ? `${formatDateDisplay(selectedDate)} • ${formatTimeDisplay()}`
                        : 'Set reminder date & time for next call'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={showFollowUp ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={showFollowUp ? '#6366F1' : '#94A3B8'}
                />
              </TouchableOpacity>

              {/* Follow-up expansion panel with Custom Date & Custom Time */}
              {showFollowUp && (
                <View style={styles.followUpDropdownPanel}>
                  {/* Date Selection */}
                  <Text style={styles.followUpMiniLabel}>FOLLOW-UP DATE</Text>
                  <TouchableOpacity
                    style={styles.customPickerInputRow}
                    onPress={() => setShowCustomDatePicker(!showCustomDatePicker)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.customPickerLeft}>
                      <Ionicons name="calendar-outline" size={17} color="#6366F1" style={{ marginRight: 8 }} />
                      <Text style={styles.customPickerSelectedValue}>{formatDateDisplay(selectedDate)}</Text>
                    </View>
                    <Ionicons
                      name={showCustomDatePicker ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>

                  {/* Date Quick Shortcuts & Custom Input */}
                  <View style={styles.quickDaysRow}>
                    {[
                      { label: 'Today', days: 0 },
                      { label: 'Tomorrow', days: 1 },
                      { label: 'In 2 Days', days: 2 },
                      { label: 'In 1 Week', days: 7 },
                    ].map((item) => {
                      const target = new Date();
                      target.setDate(target.getDate() + item.days);
                      const isSel = selectedDate.toDateString() === target.toDateString();
                      return (
                        <TouchableOpacity
                          key={item.days}
                          style={[styles.quickDayPill, isSel && styles.quickDayPillActive]}
                          onPress={() => handleQuickDateSelect(item.days)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.quickDayPillText, isSel && styles.quickDayPillTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {showCustomDatePicker && (
                    <View style={styles.customDateInputContainer}>
                      <Text style={styles.customInputHelperText}>Enter Custom Date (YYYY-MM-DD):</Text>
                      <TextInput
                        style={styles.customDateTextInput}
                        placeholder="e.g. 2026-09-28"
                        placeholderTextColor="#94A3B8"
                        value={customDateInput}
                        onChangeText={applyCustomDate}
                        maxLength={10}
                      />
                    </View>
                  )}

                  {/* Time Selection */}
                  <Text style={[styles.followUpMiniLabel, { marginTop: 14 }]}>FOLLOW-UP TIME</Text>
                  <TouchableOpacity
                    style={styles.customPickerInputRow}
                    onPress={() => setShowCustomTimePicker(!showCustomTimePicker)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.customPickerLeft}>
                      <Ionicons name="time-outline" size={17} color="#6366F1" style={{ marginRight: 8 }} />
                      <Text style={styles.customPickerSelectedValue}>{formatTimeDisplay()}</Text>
                    </View>
                    <Ionicons
                      name={showCustomTimePicker ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>

                  {/* Time Presets */}
                  <View style={styles.quickDaysRow}>
                    {[
                      { h: '10', m: '00', p: 'AM' as const, label: '10:00 AM' },
                      { h: '11', m: '30', p: 'AM' as const, label: '11:30 AM' },
                      { h: '02', m: '00', p: 'PM' as const, label: '02:00 PM' },
                      { h: '04', m: '30', p: 'PM' as const, label: '04:30 PM' },
                    ].map((slot) => {
                      const isTimeSel =
                        parseInt(timeHour, 10) === parseInt(slot.h, 10) &&
                        parseInt(timeMinute, 10) === parseInt(slot.m, 10) &&
                        timePeriod === slot.p;
                      return (
                        <TouchableOpacity
                          key={slot.label}
                          style={[styles.quickTimePill, isTimeSel && styles.quickTimePillActive]}
                          onPress={() => {
                            setTimeHour(slot.h);
                            setTimeMinute(slot.m);
                            setTimePeriod(slot.p);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.quickTimePillText, isTimeSel && styles.quickTimePillTextActive]}>
                            {slot.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Time Picker Row (Hour : Minute + AM/PM) */}
                  {showCustomTimePicker && (
                    <View style={styles.customTimeEditRow}>
                      <View style={styles.timeDigitsWrapper}>
                        <TextInput
                          style={styles.timeDigitInput}
                          value={timeHour}
                          onChangeText={(txt) => {
                            const val = txt.replace(/[^0-9]/g, '');
                            if (val === '' || (parseInt(val, 10) >= 1 && parseInt(val, 10) <= 12)) {
                              setTimeHour(val);
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="10"
                        />
                        <Text style={styles.timeColonText}>:</Text>
                        <TextInput
                          style={styles.timeDigitInput}
                          value={timeMinute}
                          onChangeText={(txt) => {
                            const val = txt.replace(/[^0-9]/g, '');
                            if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                              setTimeMinute(val);
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="30"
                        />
                      </View>

                      {/* AM / PM Toggle */}
                      <View style={styles.periodToggleBox}>
                        <TouchableOpacity
                          style={[styles.periodBtn, timePeriod === 'AM' && styles.periodBtnActive]}
                          onPress={() => setTimePeriod('AM')}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.periodBtnText, timePeriod === 'AM' && styles.periodBtnTextActive]}>
                            AM
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.periodBtn, timePeriod === 'PM' && styles.periodBtnActive]}
                          onPress={() => setTimePeriod('PM')}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.periodBtnText, timePeriod === 'PM' && styles.periodBtnTextActive]}>
                            PM
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <TextInput
                    style={styles.followUpNoteInput}
                    placeholder="Optional follow-up note (e.g. Call after quote review)..."
                    placeholderTextColor="#94A3B8"
                    value={followUpNote}
                    onChangeText={setFollowUpNote}
                  />
                </View>
              )}
            </View>

            {/* CALL NOTES (OPTIONAL) */}
            <View style={styles.notesSection}>
              <View style={styles.notesHeaderRow}>
                <Text style={styles.notesHeaderLabel}>CALL NOTES (OPTIONAL)</Text>
                <Text style={styles.notesCharLimit}>{notes.length}/300</Text>
              </View>
              <TextInput
                style={styles.notesInputField}
                placeholder="Add key highlights or context from this call..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                maxLength={300}
              />
            </View>
          </ScrollView>

          {/* Bottom Action Buttons (Always cleanly positioned) */}
          <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.discardBtnText}>Discard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryActionBtnWrapper}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {didAnswer ? (
                <LinearGradient
                  colors={['#6366F1', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryActionGradient}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <View style={styles.actionBtnCircleIconWhite}>
                        <Ionicons name="checkmark" size={13} color="#6366F1" />
                      </View>
                      <Text style={styles.primaryActionBtnText}>Save & Sync</Text>
                    </>
                  )}
                </LinearGradient>
              ) : (
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryActionGradient}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <View style={styles.actionBtnCircleIconWhite}>
                        <Ionicons name="close" size={13} color="#DC2626" />
                      </View>
                      <Text style={styles.primaryActionBtnText}>Save as Missed Call</Text>
                    </>
                  )}
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Small Popup Modal: Edit Call Duration */}
        <Modal
          visible={editDurationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditDurationModalVisible(false)}
        >
          <View style={styles.editDurationBackdrop}>
            <View style={styles.editDurationCard}>
              <View style={styles.editDurationHeader}>
                <View style={styles.editDurationIconBox}>
                  <Ionicons name="time" size={18} color="#6366F1" />
                </View>
                <Text style={styles.editDurationTitle}>Edit Call Duration</Text>
              </View>

              <Text style={styles.editDurationSubtitle}>
                Manually adjust the conversation time for accurate status classification
              </Text>

              <View style={styles.durationPickersWrapper}>
                {/* Minutes Input */}
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerColHeader}>MIN</Text>
                  <TextInput
                    style={styles.pickerNumInput}
                    value={editMinutes}
                    onChangeText={(txt) => {
                      const clean = txt.replace(/[^0-9]/g, '');
                      setEditMinutes(clean.slice(0, 3));
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="00"
                    selectTextOnFocus
                  />
                </View>

                <Text style={styles.pickerSeparatorText}>:</Text>

                {/* Seconds Input */}
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerColHeader}>SEC</Text>
                  <TextInput
                    style={styles.pickerNumInput}
                    value={editSeconds}
                    onChangeText={(txt) => {
                      const clean = txt.replace(/[^0-9]/g, '');
                      const num = parseInt(clean, 10);
                      if (clean === '' || (!isNaN(num) && num <= 59)) {
                        setEditSeconds(clean.slice(0, 2));
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="00"
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.editDurationActionsRow}>
                <TouchableOpacity
                  style={styles.editDurationCancelBtn}
                  onPress={() => setEditDurationModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editDurationCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editDurationSaveBtn}
                  onPress={handleSaveEditedDuration}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#6366F1', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.editDurationSaveGradient}
                  >
                    <Text style={styles.editDurationSaveText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  callIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  customerCallLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  phoneHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
    letterSpacing: -0.2,
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerStatusBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  scrollView: {
    width: '100%',
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  fieldSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  answerChoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
  },
  answerChoiceBtnInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  answerChoiceBtnAnsweredActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  answerChoiceBtnUnansweredActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  answerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerIconCircleGreenActive: {
    backgroundColor: '#10B981',
  },
  answerIconCircleRedActive: {
    backgroundColor: '#EF4444',
  },
  answerIconCircleMuted: {
    backgroundColor: '#E2E8F0',
  },
  answerChoiceBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  answerChoiceBtnTextGreen: {
    color: '#10B981',
  },
  answerChoiceBtnTextRed: {
    color: '#EF4444',
  },
  answerChoiceBtnTextMuted: {
    color: '#94A3B8',
  },
  durationSection: {
    marginBottom: 14,
  },
  durationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  durationLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationDisplayText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  editDurationBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonSection: {
    marginBottom: 14,
  },
  reasonPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  reasonPillActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  reasonPillInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasonPillTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
  reasonPillTextInactive: {
    color: '#94A3B8',
  },
  followUpCardSection: {
    marginBottom: 14,
  },
  followUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  followUpCardExpanded: {
    borderColor: '#C7D2FE',
    backgroundColor: '#F5F3FF',
  },
  followUpCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  followUpCalendarTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpCalendarTileActive: {
    backgroundColor: '#EEF2FF',
  },
  followUpCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  followUpCardTitleActive: {
    color: '#4F46E5',
  },
  followUpCardSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  followUpDropdownPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 8,
  },
  followUpMiniLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  customPickerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  customPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customPickerSelectedValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  quickDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickDayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDayPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  quickDayPillText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  quickDayPillTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  customDateInputContainer: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customInputHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  customDateTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12.5,
    color: '#0F172A',
  },
  quickTimePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTimePillActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  quickTimePillText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  quickTimePillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  customTimeEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeDigitsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDigitInput: {
    width: 44,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeColonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#64748B',
  },
  periodToggleBox: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodBtnActive: {
    backgroundColor: '#6366F1',
  },
  periodBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  followUpNoteInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    marginTop: 10,
  },
  notesSection: {
    marginBottom: 8,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notesHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  notesCharLimit: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  notesInputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 12.5,
    color: '#0F172A',
    minHeight: 58,
    textAlignVertical: 'top',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  primaryActionBtnWrapper: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  actionBtnCircleIconWhite: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Edit Duration Small Modal
  editDurationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  editDurationCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  editDurationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  editDurationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDurationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  editDurationSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
  },
  durationPickersWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  pickerNumInput: {
    width: 64,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  pickerSeparatorText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#64748B',
    marginTop: 14,
  },
  editDurationActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editDurationCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDurationCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  editDurationSaveBtn: {
    flex: 1.2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  editDurationSaveGradient: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDurationSaveText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
