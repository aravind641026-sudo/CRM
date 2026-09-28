import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { notificationApi } from '../../api/notificationApi';
import { AdminNotification } from '../../types';

export const UserNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await notificationApi.getUserNotifications();
      setNotifications(data || []);
    } catch (err: any) {
      console.warn('Failed to load user notifications:', err);
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

  const handlePressNotification = async (item: AdminNotification) => {
    // Mark as read locally and on server
    if (!item.read) {
      try {
        await notificationApi.markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }

    // Direct navigation for lead assignments
    if (item.leadId || (item.referenceType === 'Lead' && item.referenceId)) {
      const leadId = item.leadId || item.referenceId!;
      navigation.navigate('LeadDetails', {
        leadId,
        leadName: item.leadName || 'Lead Details',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to mark all notifications as read.');
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
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
      case 'LEAD_ASSIGNMENT':
      case 'LEAD_ASSIGNED':
        return { name: 'person-add', variant: 'blue' as const };
      case 'PROMOTION_APPROVED':
        return { name: 'checkmark-circle', variant: 'green' as const };
      case 'PROMOTION_REJECTED':
        return { name: 'close-circle', variant: 'red' as const };
      case 'PERMISSION_REQUEST':
        return { name: 'shield-checkmark', variant: 'orange' as const };
      default:
        return { name: 'notifications', variant: 'purple' as const };
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  const renderItem = ({ item }: { item: AdminNotification }) => {
    const iconConfig = getNotificationIcon(item.type);
    const isUnread = !item.read;
    const isLeadNotif = !!(item.leadId || (item.referenceType === 'Lead' && item.referenceId));

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => handlePressNotification(item)}
      >
        <Card style={[styles.card, isUnread && styles.cardUnread]}>
          <View style={styles.cardHeaderTop}>
            <View style={styles.cardHeaderLeft}>
              <IconTile
                name={iconConfig.name}
                variant={iconConfig.variant}
                size={38}
                iconSize={19}
              />
              <View style={styles.headerTitleCol}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.timestamp}>
                    {formatTimestamp(item.createdAt)}
                  </Text>
                  {item.projectName ? (
                    <Text style={styles.projectTag} numberOfLines={1}>
                      • {item.projectName}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.message}>{item.message}</Text>
          </View>

          {isLeadNotif && (
            <View style={styles.cardFooter}>
              <Text style={styles.actionPromptText}>Tap to view lead details</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <AmbientBackground variant="home">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <MeqHeader
        showLogo={false}
        title="Notifications"
        subtitle="Assigned leads, role updates & announcements"
        onBack={() => navigation.goBack()}
        rightElement={
          hasUnread ? (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={styles.markReadBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading && !refreshing ? (
        <LoadingState message="Loading your notifications..." fullScreen />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          description="You are all caught up! New lead assignments and updates will appear here."
          icon="notifications-off-outline"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    backgroundColor: colors.surface,
  },
  cardUnread: {
    borderColor: 'rgba(37, 99, 235, 0.35)',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '800',
    color: '#0F172A',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
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
  projectTag: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  messageBox: {
    marginTop: spacing.sm,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: spacing.sm,
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
