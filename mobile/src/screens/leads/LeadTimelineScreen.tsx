import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { leadApi } from '../../api/leadApi';
import { callApi } from '../../api/callApi';
import { RootStackParamList, LeadDetailResponse, LeadTimelineItem } from '../../types';

type LeadTimelineRouteProp = RouteProp<RootStackParamList, 'LeadTimeline'>;

interface ProcessedTimelineEvent {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  userName: string;
  timeStr: string;
  dateStr: string;
  rawDate: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}

export const LeadTimelineScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LeadTimelineRouteProp>();
  const insets = useSafeAreaInsets();
  const { leadId, leadName: initialLeadName } = route.params || {};

  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const [leadData, timelineData] = await Promise.all([
          leadApi.getLeadDetails(leadId),
          callApi.getLeadTimeline(leadId).catch(() => []),
        ]);
        setLead(leadData);
        setTimeline(timelineData || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load timeline');
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

  // Compile timeline items
  const allTimelineItems: ProcessedTimelineEvent[] = [];

  (timeline || []).forEach((item) => {
    const rawTs = item.timestamp || (item as any).createdAt || '';
    let iconName: keyof typeof Ionicons.glyphMap = 'information-circle';
    let iconBg = '#F1F5F9';
    let iconColor = '#64748B';

    const t = (item.type || '').toUpperCase();
    if (t === 'CALL') {
      iconName = 'call';
      iconBg = '#DCFCE7';
      iconColor = '#16A34A';
    } else if (t === 'FOLLOW_UP') {
      iconName = 'calendar';
      iconBg = '#FEF3C7';
      iconColor = '#D97706';
    } else if (t === 'STATUS_CHANGE') {
      iconName = 'swap-horizontal';
      iconBg = '#EDE9FE';
      iconColor = '#7C3AED';
    } else if (t === 'ASSIGNMENT') {
      iconName = 'person-add';
      iconBg = '#EFF6FF';
      iconColor = '#2563EB';
    } else if (t === 'CONVERT' || t === 'CONVERTED') {
      iconName = 'trophy';
      iconBg = '#DCFCE7';
      iconColor = '#10B981';
    } else if (t === 'LEAD_CREATED') {
      iconName = 'add-circle';
      iconBg = '#E0E7FF';
      iconColor = '#4F46E5';
    } else if (t === 'NOTE') {
      iconName = 'document-text';
      iconBg = '#F3F4F6';
      iconColor = '#4B5563';
    }

    allTimelineItems.push({
      id: `backend-${item.id}-${item.type}`,
      type: (item.type as any) || 'AUDIT',
      title: item.title || 'Lead Activity',
      subtitle: item.notes || item.businessClassification || item.followUpStatus || '',
      userName: item.userName || 'System',
      timeStr: format12Hour(rawTs),
      dateStr: formatDateOnly(rawTs),
      rawDate: rawTs,
      icon: iconName,
      iconBg,
      iconColor,
    });
  });

  if (lead && lead.createdAt && !allTimelineItems.some((t) => t.type === 'LEAD_CREATED')) {
    allTimelineItems.push({
      id: `created-${lead.id}`,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      subtitle: `Imported / Created in ${lead.project?.name || 'CRM'}`,
      userName: 'System',
      timeStr: format12Hour(lead.createdAt),
      dateStr: formatDateOnly(lead.createdAt),
      rawDate: lead.createdAt,
      icon: 'add-circle',
      iconBg: '#E0E7FF',
      iconColor: '#4F46E5',
    });
  }

  // Sort descending (latest event first)
  allTimelineItems.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

  const displayName = lead?.name || initialLeadName || 'Lead Activity History';

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Header
          title="Timeline"
          subtitle={displayName}
          onBack={() => navigation.goBack()}
        />

        {loading && !refreshing ? (
          <LoadingState message="Loading timeline events..." fullScreen />
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
            {/* Header Summary Banner */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="time" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Audit & Activity History</Text>
                <Text style={styles.summarySubtitle}>
                  {allTimelineItems.length} total event{allTimelineItems.length === 1 ? '' : 's'} recorded
                </Text>
              </View>
            </View>

            {/* Timeline Stream */}
            {allTimelineItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Timeline Events</Text>
                <Text style={styles.emptySub}>Activity events for this lead will appear here.</Text>
              </View>
            ) : (
              <View style={styles.timelineCard}>
                {allTimelineItems.map((item, index) => {
                  const isLast = index === allTimelineItems.length - 1;
                  return (
                    <View key={item.id || index} style={styles.timelineRow}>
                      <View style={styles.guideCol}>
                        <View style={[styles.eventDot, { backgroundColor: item.iconColor }]} />
                        {!isLast && <View style={styles.guideLine} />}
                      </View>

                      <View style={styles.eventContent}>
                        <View style={styles.eventTopRow}>
                          <Text style={styles.userNameText}>{item.userName}</Text>
                          <Text style={styles.eventTimeText}>
                            {item.dateStr} • {item.timeStr}
                          </Text>
                        </View>

                        <Text style={styles.eventTitleText}>{item.title}</Text>
                        {item.subtitle ? (
                          <Text style={styles.eventSubText}>{item.subtitle}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
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
    backgroundColor: '#EFF6FF',
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
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  guideCol: {
    width: 22,
    alignItems: 'center',
    marginRight: 10,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  guideLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: -4,
  },
  eventContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 0.8,
    borderColor: '#F1F5F9',
  },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  eventTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  eventTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventSubText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 17,
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
  },
});
