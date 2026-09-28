import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { GradientView } from '../../components/common/GradientView';
import { LoadingState } from '../../components/common/LoadingState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { callApi } from '../../api/callApi';
import { Call, RootStackParamList } from '../../types';
import { GroupedCallLog, isCallMissed } from '../../utils/callGrouping';

type CallHistoryDetailRouteProp = RouteProp<RootStackParamList, 'CallHistoryDetail'>;

export const CallHistoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<CallHistoryDetailRouteProp>();

  const {
    callId,
    phoneNumber,
    leadId,
    leadName,
    groupedLog: initialGroupedLog,
    call: initialCall,
  } = route.params || {};

  const [calls, setCalls] = useState<Call[]>(
    initialCall ? [initialCall] : (initialGroupedLog?.allCalls || [])
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [leadInfo, setLeadInfo] = useState<{
    name?: string;
    phone?: string;
    projectName?: string;
    assignedUser?: string;
    followUpDate?: string;
    followUpStatus?: string;
  }>({
    name: leadName || initialCall?.leadName || initialGroupedLog?.leadName,
    phone: phoneNumber || initialCall?.leadPhone || (initialCall as any)?.phoneNumber || initialGroupedLog?.phoneNumber,
    projectName: initialCall?.projectName || initialGroupedLog?.projectName,
    assignedUser: initialCall?.userName || initialCall?.user?.name || initialGroupedLog?.assignedUserName,
    followUpDate: initialCall?.followUpDate || initialGroupedLog?.followUpDate,
  });

  const loadCallHistory = useCallback(async (isRefresh = false) => {
    if (!isRefresh && calls.length === 0) setLoading(true);
    try {
      if (leadId) {
        const leadCalls = await callApi.getCallsForLead(leadId);
        if (leadCalls && leadCalls.length > 0) {
          let merged = [...leadCalls];
          if (initialCall && !merged.some((c) => c.id === initialCall.id)) {
            merged.unshift(initialCall);
          }
          setCalls(merged);
          const first = (callId ? merged.find((c) => c.id === callId) : undefined) || initialCall || merged[0];
          setLeadInfo((prev) => ({
            ...prev,
            name: first.leadName || prev.name,
            phone: first.leadPhone || prev.phone,
            projectName: first.projectName || prev.projectName,
            assignedUser: first.userName || first.user?.name || prev.assignedUser,
            followUpDate: first.followUpDate || prev.followUpDate,
          }));
        }
      } else if (phoneNumber) {
        // Search calls matching this phone number
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
        const res = await callApi.getCalls({ size: 100 });
        const matching = (res.content || []).filter((c) => {
          const cPhone = (c.leadPhone || (c as any).phoneNumber || (c as any).customerPhone || '').replace(/[^0-9]/g, '');
          const cLast10 = cPhone.length >= 10 ? cPhone.slice(-10) : cPhone;
          return cLast10 === last10 || (cleanPhone && cPhone.includes(cleanPhone)) || (callId && c.id === callId);
        });
        let merged = matching;
        if (initialCall && !merged.some((c) => c.id === initialCall.id)) {
          merged.unshift(initialCall);
        }
        if (merged.length > 0) {
          setCalls(merged);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh call history details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leadId, phoneNumber, callId, initialCall, calls.length]);

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCallHistory(true);
  };

  const handleCall = () => {
    const raw = leadInfo.phone || phoneNumber;
    if (raw) {
      const clean = raw.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`);
    }
  };

  const handleWhatsApp = () => {
    const raw = leadInfo.phone || phoneNumber;
    if (raw) {
      const clean = raw.replace(/[^0-9]/g, '');
      const waNumber = clean.length === 10 ? `91${clean}` : clean;
      Linking.openURL(`https://wa.me/${waNumber}`);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds == null || seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remSecs = seconds % 60;
    return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Sort calls descending (newest first)
  const sortedCalls = [...calls].sort((a, b) => {
    const tA = new Date(a.startTime || a.startedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.startTime || b.startedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });

  // Calculate stats
  const totalCalls = sortedCalls.length;
  let answeredCalls = 0;
  let missedCalls = 0;
  let totalDuration = 0;

  for (const c of sortedCalls) {
    totalDuration += c.durationSeconds || 0;
    if (isCallMissed(c)) {
      missedCalls++;
    } else {
      answeredCalls++;
    }
  }

  const avgDuration = answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0;
  const latestCall = sortedCalls[0];
  const oldestCall = sortedCalls[sortedCalls.length - 1];

  const selectedCall =
    (callId ? sortedCalls.find((c) => c.id === callId) : undefined) ||
    initialCall ||
    (sortedCalls.length > 0 ? sortedCalls[0] : undefined);

  const displayName = leadInfo.name || leadInfo.phone || phoneNumber || 'Call Details';
  const displayPhone = leadInfo.phone || phoneNumber || 'No Phone Number';

  return (
    <AmbientBackground variant="dial">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Header
        title="Call History"
        subtitle={leadInfo.name ? leadInfo.name : displayPhone}
        onBack={() => navigation.goBack()}
        rightAction={
          leadId ? (
            <TouchableOpacity
              style={styles.headerLeadBtn}
              onPress={() => navigation.navigate('LeadDetails', { leadId, leadName: leadInfo.name })}
            >
              <Text style={styles.headerLeadBtnText}>View Lead</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* 1. Lead / Contact Header Card */}
        <View style={styles.contactCard}>
          <View style={styles.contactTopRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.contactDetails}>
              <Text style={styles.contactName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.contactPhone}>{displayPhone}</Text>

              <View style={styles.contactMetaRow}>
                {leadInfo.projectName ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="folder-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.metaPillText} numberOfLines={1}>
                      {leadInfo.projectName}
                    </Text>
                  </View>
                ) : null}

                {leadInfo.assignedUser ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="person-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.metaPillText} numberOfLines={1}>
                      {leadInfo.assignedUser}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Action buttons (Call, WhatsApp, Lead) */}
          <View style={styles.contactActionButtons}>
            <TouchableOpacity style={styles.actionBtnCall} onPress={handleCall} activeOpacity={0.8}>
              <Ionicons name="call" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnTextCall}>Call Number</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnWhatsApp} onPress={handleWhatsApp} activeOpacity={0.8}>
              <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
              <Text style={styles.actionBtnTextWhatsApp}>WhatsApp</Text>
            </TouchableOpacity>

            {leadId && (
              <TouchableOpacity
                style={styles.actionBtnLead}
                onPress={() => navigation.navigate('LeadDetails', { leadId, leadName: leadInfo.name })}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.actionBtnTextLead}>CRM Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {leadInfo.followUpDate ? (
            <View style={styles.followUpBanner}>
              <Ionicons name="alarm-outline" size={14} color={colors.warning} />
              <Text style={styles.followUpBannerText}>
                Scheduled Follow-up:{' '}
                <Text style={styles.followUpBannerDate}>{formatDateTime(leadInfo.followUpDate)}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* 2. Call Summary Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Call Summary</Text>
          <Text style={styles.sectionSubtitle}>{totalCalls} total interaction{totalCalls === 1 ? '' : 's'}</Text>
        </View>

        {/* KPI / Summary Cards Grid (Total Calls, Answered, Missed, Total Duration) */}
        <View style={styles.summaryGrid}>
          {/* Card 1: Total Calls */}
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{totalCalls}</Text>
            <Text style={styles.statLabel}>Total Calls</Text>
          </View>

          {/* Card 2: Answered */}
          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.success }]}>{answeredCalls}</Text>
            <Text style={styles.statLabel}>Answered</Text>
          </View>

          {/* Card 3: Missed / Unanswered */}
          <View style={[styles.statCard, { borderLeftColor: '#DC2626' }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
            </View>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>{missedCalls}</Text>
            <Text style={styles.statLabel}>Missed / Unanswered</Text>
          </View>

          {/* Card 4: Total Duration */}
          <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="time-outline" size={16} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
            <Text style={styles.statLabel}>Total Duration</Text>
          </View>
        </View>

        {/* 3. Individual Call History Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Individual Call History</Text>
          <Text style={styles.sectionSubtitle}>
            {sortedCalls.length} record{sortedCalls.length === 1 ? '' : 's'}
          </Text>
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading call history..." />
        ) : sortedCalls.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Individual Records Found</Text>
            <Text style={styles.emptySub}>Call records for this number will appear here.</Text>
          </View>
        ) : (
          sortedCalls.map((call, index) => {
            const callNumber = sortedCalls.length - index;
            const isMissed = isCallMissed(call);
            const isSelected = call.id === selectedCall?.id;
            const callTime = formatDateTime(call.startTime || call.startedAt || call.createdAt);
            const caller = call.userName || call.user?.name || leadInfo.assignedUser || 'CRM Agent';
            const durationText = formatDuration(call.durationSeconds);
            const direction = call.callDirection || 'OUTBOUND';
            const isIncoming = direction.toUpperCase() === 'INBOUND';

            return (
              <View
                key={call.id || index}
                style={[
                  styles.historyCard,
                  isSelected && styles.historyCardSelected,
                ]}
              >
                {/* Header Row: Call # & Date */}
                <View style={styles.historyCardHeader}>
                  <View style={styles.historyCardHeaderLeft}>
                    <View
                      style={[
                        styles.historyIconBox,
                        {
                          backgroundColor: isMissed
                            ? '#FEE2E2'
                            : isIncoming
                            ? '#EFF6FF'
                            : colors.successLight,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          isMissed
                            ? 'close-circle'
                            : isIncoming
                            ? 'arrow-down'
                            : 'arrow-up'
                        }
                        size={15}
                        color={
                          isMissed
                            ? '#DC2626'
                            : isIncoming
                            ? colors.primary
                            : colors.success
                        }
                      />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.callNumberText}>Call #{callNumber}</Text>
                        {isSelected && (
                          <View style={styles.selectedPill}>
                            <Text style={styles.selectedPillText}>Selected</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.callDateText}>{callTime}</Text>
                    </View>
                  </View>

                  <Badge
                    label={isMissed || (call.callStatus || '').toUpperCase() === 'MISSED' ? 'MISSED' : (call.callStatus || 'CONNECTED')}
                    status={isMissed || (call.callStatus || '').toUpperCase() === 'MISSED' ? 'MISSED' : (call.callStatus || 'CONNECTED')}
                    variant={isMissed || (call.callStatus || '').toUpperCase() === 'MISSED' ? 'danger' : undefined}
                  />
                </View>

                {/* Details Row: Caller, Direction, Duration */}
                <View style={styles.historyDetailsGrid}>
                  <View style={styles.historyDetailItem}>
                    <Text style={styles.detailItemKey}>Caller / User</Text>
                    <Text style={styles.detailItemVal} numberOfLines={1}>
                      {caller}
                    </Text>
                  </View>

                  <View style={styles.historyDetailItem}>
                    <Text style={styles.detailItemKey}>Direction</Text>
                    <Text style={styles.detailItemVal}>{isIncoming ? 'Inbound' : 'Outbound'}</Text>
                  </View>

                  <View style={styles.historyDetailItem}>
                    <Text style={styles.detailItemKey}>Duration</Text>
                    <Text style={[styles.detailItemVal, { fontWeight: '700', color: isMissed ? '#DC2626' : colors.textPrimary }]}>
                      {durationText}
                    </Text>
                  </View>

                  {call.businessOutcome ? (
                    <View style={styles.historyDetailItem}>
                      <Text style={styles.detailItemKey}>Outcome</Text>
                      <Text style={styles.detailItemVal} numberOfLines={1}>
                        {call.businessOutcome}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Notes if available */}
                {call.notes ? (
                  <View style={styles.callNotesBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.callNotesText}>{call.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  headerLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 2,
  },
  headerLeadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  selectedCallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedCallTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedCallIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  selectedCallIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  selectedCallMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectedCallTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  selectedCallTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  outcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  outcomeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  outcomeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  historyCardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FAF5FF',
  },
  selectedPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#DDD6FE',
  },
  selectedPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  contactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  contactPhone: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  contactMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  contactActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.callGreen,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnTextCall: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 6,
  },
  actionBtnTextWhatsApp: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  actionBtnTextLead: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  followUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
  },
  followUpBannerText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  followUpBannerDate: {
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minWidth: 95,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    borderLeftWidth: 3.5,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statValueSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  callDateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  historyDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
  },
  historyDetailItem: {
    flex: 1,
    minWidth: 80,
  },
  detailItemKey: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailItemVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  callNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  callNotesText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
