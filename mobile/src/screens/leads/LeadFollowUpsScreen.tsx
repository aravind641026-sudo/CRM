import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { FollowUpModal } from '../../components/leads/FollowUpModal';
import { leadApi } from '../../api/leadApi';
import { followUpApi } from '../../api/followUpApi';
import { RootStackParamList, LeadDetailResponse, FollowUp } from '../../types';

type LeadFollowUpsRouteProp = RouteProp<RootStackParamList, 'LeadFollowUps'>;

export const LeadFollowUpsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LeadFollowUpsRouteProp>();
  const insets = useSafeAreaInsets();
  const { leadId, leadName: initialLeadName } = route.params || {};

  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);

  const format12Hour = (raw?: string | null) => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const formatDateOnly = (raw?: string | null) => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const leadData = await leadApi.getLeadDetails(leadId);
        setLead(leadData);
        setFollowUps(leadData.followUps || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load follow-ups');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leadId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleCompleteFollowUp = async (id: number) => {
    try {
      await followUpApi.toggleStatus(id, 'COMPLETED');
      Alert.alert('Success', 'Follow-up marked as completed.');
      loadData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete follow-up');
    }
  };

  const handleCancelFollowUp = async (id: number) => {
    Alert.alert('Cancel Follow-up', 'Are you sure you want to cancel this follow-up?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await followUpApi.toggleStatus(id, 'CANCELLED');
            loadData(true);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel follow-up');
          }
        },
      },
    ]);
  };

  const displayName = lead?.name || initialLeadName || 'Lead Follow-ups';

  // Sort follow-ups (pending/upcoming first, then descending by scheduled time)
  const sortedFollowUps = [...followUps].sort((a, b) => {
    const tA = new Date(a.scheduledTime || 0).getTime();
    const tB = new Date(b.scheduledTime || 0).getTime();
    return tB - tA;
  });

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Header
          title="Follow-ups"
          subtitle={displayName}
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setFollowUpModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Schedule</Text>
            </TouchableOpacity>
          }
        />

        {loading && !refreshing ? (
          <LoadingState message="Loading follow-up records..." fullScreen />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} fullScreen />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
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
            {/* Summary Stats Banner */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="alarm" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Follow-up Records</Text>
                <Text style={styles.summarySubtitle}>
                  {sortedFollowUps.length} total follow-up{sortedFollowUps.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            {/* List */}
            {sortedFollowUps.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Follow-ups Scheduled</Text>
                <Text style={styles.emptySub}>
                  Keep your prospect engaged by scheduling a follow-up call.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setFollowUpModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Schedule Follow-up</Text>
                </TouchableOpacity>
              </View>
            ) : (
              sortedFollowUps.map((item) => {
                const statusKey = (item.status || 'PENDING').toUpperCase();
                const isPending = statusKey === 'PENDING' || statusKey === 'SCHEDULED';
                const isCompleted = statusKey === 'COMPLETED';

                return (
                  <View key={item.id} style={styles.card}>
                    {/* Top Row: Date/Time + Status Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.timeBlock}>
                        <Ionicons
                          name="time-outline"
                          size={15}
                          color={isPending ? '#D97706' : '#64748B'}
                        />
                        <Text style={styles.dateText}>
                          {formatDateOnly(item.scheduledTime)} • {format12Hour(item.scheduledTime)}
                        </Text>
                      </View>

                      <Badge
                        label={item.status || 'PENDING'}
                        status={item.status || 'PENDING'}
                        variant={isCompleted ? 'success' : isPending ? 'warning' : 'neutral'}
                      />
                    </View>

                    {/* Notes */}
                    {item.notes ? (
                      <View style={styles.notesBox}>
                        <Ionicons name="chatbubble-outline" size={13} color="#64748B" />
                        <Text style={styles.notesText}>{item.notes}</Text>
                      </View>
                    ) : null}

                    {/* Bottom Actions if pending */}
                    {isPending && (
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.completeBtn}
                          onPress={() => handleCompleteFollowUp(item.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
                          <Text style={styles.completeBtnText}>Mark Complete</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancelFollowUp(item.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Modal to schedule new follow up */}
        {lead && (
          <FollowUpModal
            visible={followUpModalVisible}
            onClose={() => setFollowUpModalVisible(false)}
            leadId={lead.id}
            leadName={lead.name}
            onScheduled={() => {
              setFollowUpModalVisible(false);
              loadData(true);
            }}
          />
        )}
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
    padding: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    borderWidth: 0.8,
    borderColor: '#86EFAC',
  },
  completeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    borderWidth: 0.8,
    borderColor: '#FECACA',
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  emptyAddBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
