import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { IconTile } from '../../components/common/IconTile';
import { Card } from '../../components/common/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { notificationApi } from '../../api/notificationApi';
import { shiftApi } from '../../api/shiftApi';
import { usersApi } from '../../api/usersApi';
import { AdminNotification } from '../../types';

type CategoryFilter = 'ALL' | 'SIGNUPS' | 'SHIFTS' | 'ASSIGNMENTS' | 'SYSTEM';
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export const AdminNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Active filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Filter Sheet Modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempCategory, setTempCategory] = useState<CategoryFilter>('ALL');
  const [tempStatus, setTempStatus] = useState<StatusFilter>('ALL');

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await notificationApi.getAdminNotifications();
      // Filter out any obsolete PERMISSION_REQUEST notifications
      const valid = (data || []).filter((n) => n.type !== 'PERMISSION_REQUEST');
      setNotifications(valid);
    } catch (err: any) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const openFilterModal = () => {
    setTempCategory(categoryFilter);
    setTempStatus(statusFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setCategoryFilter(tempCategory);
    setStatusFilter(tempStatus);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    setTempCategory('ALL');
    setTempStatus('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setFilterModalVisible(false);
  };

  const hasActiveFilters = categoryFilter !== 'ALL' || statusFilter !== 'ALL';
  const activeFilterCount = (categoryFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0);

  const handleReviewShiftChange = async (
    item: AdminNotification,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    if (!item.referenceId) return;

    const actionText = decision === 'APPROVED' ? 'approve' : 'reject';
    Alert.alert(
      `${decision === 'APPROVED' ? 'Approve' : 'Reject'} Shift Change`,
      `Are you sure you want to ${actionText} this shift change request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision === 'APPROVED' ? 'Approve' : 'Reject',
          style: decision === 'REJECTED' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              await shiftApi.reviewShiftChangeRequest(item.referenceId!, {
                status: decision,
                adminNotes: `Processed from Admin Notifications`,
              });
              setNotifications((prev) =>
                prev.map((n) =>
                  n.id === item.id ? { ...n, status: decision, read: true } : n
                )
              );
              Alert.alert('Success', `Shift change request has been ${decision.toLowerCase()}.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to process shift change request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReviewSignup = async (
    item: AdminNotification,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    if (!item.referenceId) return;

    const actionText = decision === 'APPROVED' ? 'approve' : 'reject';
    Alert.alert(
      `${decision === 'APPROVED' ? 'Approve' : 'Reject'} User Signup`,
      `Are you sure you want to ${actionText} this user's registration request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision === 'APPROVED' ? 'Approve' : 'Reject',
          style: decision === 'REJECTED' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              if (decision === 'APPROVED') {
                await usersApi.approveSignup(item.referenceId!);
              } else {
                await usersApi.rejectSignup(item.referenceId!);
              }
              setNotifications((prev) =>
                prev.map((n) =>
                  n.id === item.id ? { ...n, status: decision, read: true } : n
                )
              );
              Alert.alert(
                'Success',
                `User signup has been ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to process signup request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Category filter
      if (
        categoryFilter === 'SIGNUPS' &&
        item.type !== 'SIGNUP_REQUEST' &&
        item.type !== 'USER_SIGNUP'
      )
        return false;
      if (categoryFilter === 'SHIFTS' && item.type !== 'SHIFT_CHANGE_REQUEST') return false;
      if (
        categoryFilter === 'ASSIGNMENTS' &&
        item.type !== 'LEAD_ASSIGNMENT' &&
        item.type !== 'LEAD_REASSIGNMENT'
      )
        return false;
      if (
        categoryFilter === 'SYSTEM' &&
        item.type !== 'SYSTEM_EVENT' &&
        item.type !== 'PROJECT_EVENT'
      )
        return false;

      // Status filter
      if (statusFilter !== 'ALL') {
        const itemStatus = item.status || (item.read ? 'READ' : 'UNREAD');
        if (itemStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [notifications, categoryFilter, statusFilter]);

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SIGNUP_REQUEST':
      case 'USER_SIGNUP':
        return { name: 'person-add', variant: 'orange' as const };
      case 'SIGNUP_APPROVED':
        return { name: 'checkmark-circle', variant: 'green' as const };
      case 'SIGNUP_REJECTED':
        return { name: 'close-circle', variant: 'purple' as const };
      case 'SHIFT_CHANGE_REQUEST':
        return { name: 'time', variant: 'purple' as const };
      case 'LEAD_ASSIGNMENT':
        return { name: 'person-add', variant: 'blue' as const };
      case 'LEAD_REASSIGNMENT':
        return { name: 'shuffle', variant: 'purple' as const };
      case 'PROJECT_EVENT':
        return { name: 'briefcase', variant: 'green' as const };
      default:
        return { name: 'notifications', variant: 'blue' as const };
    }
  };

  const renderItem = ({ item }: { item: AdminNotification }) => {
    const iconConfig = getNotificationIcon(item.type);
    const isShift = item.type === 'SHIFT_CHANGE_REQUEST';
    const isSignup = item.type === 'SIGNUP_REQUEST' || item.type === 'USER_SIGNUP';
    const isPending = item.status === 'PENDING';
    const isProcessing = processingId === item.id;

    return (
      <Card style={[styles.card, isPending && styles.cardPending]}>
        {/* Top Header: User & Request info */}
        <View style={styles.cardHeaderTop}>
          <View style={styles.cardHeaderLeft}>
            <IconTile
              name={iconConfig.name}
              variant={iconConfig.variant}
              size={36}
              iconSize={18}
            />
            <View style={styles.headerTitleCol}>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {(isShift || isSignup) && (
            <View
              style={[
                styles.statusBadge,
                item.status === 'APPROVED' || item.status === 'ACTIVE'
                  ? styles.statusApproved
                  : item.status === 'REJECTED'
                  ? styles.statusRejected
                  : styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  item.status === 'APPROVED' || item.status === 'ACTIVE'
                    ? styles.statusTextApproved
                    : item.status === 'REJECTED'
                    ? styles.statusTextRejected
                    : styles.statusTextPending,
                ]}
              >
                {item.status || 'PENDING'}
              </Text>
            </View>
          )}
        </View>

        {/* Content with proper wrapping */}
        <View style={styles.messageBox}>
          <Text style={styles.message}>{item.message}</Text>
        </View>

        {/* Action buttons for pending shift requests */}
        {isShift && isPending && (
          <View style={styles.actionsFooter}>
            {isProcessing ? (
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.processingText}>Processing request...</Text>
              </View>
            ) : (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReviewShiftChange(item, 'REJECTED')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleReviewShiftChange(item, 'APPROVED')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action buttons for pending user signup requests */}
        {isSignup && isPending && (
          <View style={styles.actionsFooter}>
            {isProcessing ? (
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.processingText}>Processing request...</Text>
              </View>
            ) : (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReviewSignup(item, 'REJECTED')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleReviewSignup(item, 'APPROVED')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderFooterInfo = () => (
    <View style={styles.infoFooterCard}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoFooterTitle}>About Admin Notifications</Text>
        <Text style={styles.infoFooterText}>
          Real-time updates regarding shift requests, lead distributions, and organizational telemetry are routed directly here.
        </Text>
      </View>
    </View>
  );

  return (
    <AmbientBackground variant="home">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <MeqHeader
          showLogo={false}
          title="Admin Notifications"
          subtitle="Shift requests & system alerts"
          onBack={() => navigation.goBack()}
          rightMode="custom"
          rightElement={
            <TouchableOpacity
              onPress={openFilterModal}
              activeOpacity={0.8}
              style={[
                styles.headerFilterBtn,
                hasActiveFilters && styles.headerFilterBtnActive,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={hasActiveFilters ? '#FFFFFF' : '#7C3AED'}
              />
              <Text
                style={[
                  styles.headerFilterBtnText,
                  hasActiveFilters && styles.headerFilterBtnTextActive,
                ]}
              >
                Filter
              </Text>
              {hasActiveFilters && (
                <View style={styles.activeFilterDot} />
              )}
            </TouchableOpacity>
          }
        />

        {loading && !refreshing ? (
          <LoadingState message="Loading notifications..." fullScreen />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            title="No Notifications"
            description={hasActiveFilters ? 'No alerts match the selected filter.' : 'All caught up! New alerts will appear here.'}
            icon="notifications-off-outline"
          />
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={renderFooterInfo}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}

        {/* Admin Notification Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Notifications"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* 1. Category Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>CATEGORY</Text>
            <View style={styles.filterChipRow}>
              {[
                { id: 'ALL' as const, label: 'All Categories' },
                { id: 'SIGNUPS' as const, label: 'User Signups' },
                { id: 'SHIFTS' as const, label: 'Shift Requests' },
                { id: 'ASSIGNMENTS' as const, label: 'Lead Assignments' },
                { id: 'SYSTEM' as const, label: 'System & Projects' },
              ].map((cat) => {
                const isSel = tempCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalChip, isSel && styles.modalChipActive]}
                    onPress={() => setTempCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2. Status Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>STATUS</Text>
            <View style={styles.filterChipRow}>
              {[
                { id: 'ALL' as const, label: 'All Statuses' },
                { id: 'PENDING' as const, label: 'Pending' },
                { id: 'APPROVED' as const, label: 'Approved' },
                { id: 'REJECTED' as const, label: 'Rejected' },
              ].map((st) => {
                const isSel = tempStatus === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.modalChip, isSel && styles.modalChipActive]}
                    onPress={() => setTempStatus(st.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </FilterSheetModal>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    position: 'relative',
  },
  headerFilterBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  headerFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  headerFilterBtnTextActive: {
    color: '#FFFFFF',
  },
  activeFilterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EC4899',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalChipActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  modalChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  modalChipTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  infoFooterCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  infoIconWrap: {
    marginTop: 1,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoFooterTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  infoFooterText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardPending: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },
  messageBox: {
    marginTop: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionsFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  processingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#d97706',
  },
  statusTextApproved: {
    color: '#10b981',
  },
  statusTextRejected: {
    color: '#ef4444',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
