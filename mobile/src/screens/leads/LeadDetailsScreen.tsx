import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { LogCallModal } from '../../components/leads/LogCallModal';
import { FollowUpModal } from '../../components/leads/FollowUpModal';
import { ConvertSaleModal } from '../../components/leads/ConvertSaleModal';
import { EditLeadModal } from '../../components/leads/EditLeadModal';
import { leadApi } from '../../api/leadApi';
import { callApi } from '../../api/callApi';
import { followUpApi } from '../../api/followUpApi';
import { usersApi } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { openSystemDialer } from '../../utils/phoneDialer';
import {
  LeadDetailResponse,
  Call,
  FollowUp,
  User,
  Project,
  LeadAssignment,
  Sale,
  LeadTimelineItem,
} from '../../types';

type ActiveSubTab = 'FOLLOWUPS' | 'STATUS';

// The 4 Core Statuses
export type CoreLeadStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'NOT_INTERESTED';

export const LeadDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const leadId = route.params?.leadId;
  const { isAdmin, user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('FOLLOWUPS');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [logCallVisible, setLogCallVisible] = useState(false);
  const [followUpVisible, setFollowUpVisible] = useState(false);
  const [convertVisible, setConvertVisible] = useState(false);
  const [editLeadVisible, setEditLeadVisible] = useState(false);

  // Delete Lead Confirmation States (Admin Only)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Status Selector & Confirmation Modal States
  const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CoreLeadStatus | null>(null);
  const [statusConfirmVisible, setStatusConfirmVisible] = useState(false);
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Agents list for assignment / display
  const [agents, setAgents] = useState<User[]>([]);

  const activeCallRef = useRef<{
    telephonyCallId: string;
    leadId?: number;
    leadName?: string;
    phoneNumber: string;
    startTime: number;
  } | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);

  // AppState listener for in-call return auto-detection
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        activeCallRef.current
      ) {
        const elapsed = Math.max(0, Math.round((Date.now() - activeCallRef.current.startTime) / 1000));
        const callData = activeCallRef.current;
        activeCallRef.current = null;

        callApi
          .sendCallEvent({
            eventType: 'CALL_ENDED',
            telephonyCallId: callData.telephonyCallId,
            leadId: callData.leadId,
            customerPhone: callData.phoneNumber,
            durationSeconds: elapsed,
            technicalStatus: elapsed > 0 ? 'CONNECTED' : 'MISSED',
          })
          .catch((err) => console.warn('Call end event error:', err))
          .finally(() => {
            loadData(true);
          });
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const [leadData, callsData, timelineData, activeProjects, activeUsers] = await Promise.all([
          leadApi.getLeadDetails(leadId),
          callApi.getCallsForLead(leadId).catch(() => []),
          callApi.getLeadTimeline(leadId).catch(() => []),
          leadApi.getActiveProjects().catch(() => []),
          usersApi.getActiveUsers().catch(() => []),
        ]);
        setLead(leadData);
        setCalls(callsData || []);
        setTimeline(timelineData || []);
        setFollowUps(leadData.followUps || []);
        setProjects(activeProjects || []);
        setAgents(activeUsers || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load lead details');
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

  // Dial Native Call
  const handleCallCustomer = () => {
    if (!lead?.phone) {
      Alert.alert('No Number', 'Customer does not have a valid phone number.');
      return;
    }
    const cleanPhone = lead.phone.trim();
    const telephonyCallId = 'mob-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    activeCallRef.current = {
      telephonyCallId,
      leadId: lead.id,
      leadName: lead.name,
      phoneNumber: cleanPhone,
      startTime: Date.now(),
    };

    callApi
      .sendCallEvent({
        eventType: 'CALL_INITIATED',
        telephonyCallId,
        leadId: lead.id,
        customerPhone: cleanPhone,
      })
      .catch((err) => console.warn('Initiate call event failed:', err));

    openSystemDialer(cleanPhone);
  };

  const handleOpenWhatsApp = () => {
    if (!lead?.phone) {
      Alert.alert('No Number', 'Customer does not have a valid phone number.');
      return;
    }
    const clean = lead.phone.replace(/[^0-9]/g, '');
    const waNumber = clean.length === 10 ? `91${clean}` : clean;
    Linking.openURL(`https://wa.me/${waNumber}`);
  };

  const handleOpenEmail = () => {
    if (!lead?.email) {
      Alert.alert('No Email', 'No email address registered for this customer.');
      return;
    }
    Linking.openURL(`mailto:${lead.email.trim()}`);
  };

  const handleOpenMaps = () => {
    const loc = lead?.city || lead?.address || lead?.state;
    if (!loc) {
      Alert.alert('No Location', 'No address or location provided for this lead.');
      return;
    }
    const query = encodeURIComponent(loc);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  // Delete Lead Handler (Admin Only - Requires typing DELETE)
  const handleConfirmDeleteLead = async () => {
    if (!isAdmin) {
      showError('Unauthorized', 'Only Administrators can delete leads.');
      return;
    }

    if (deleteInputText.trim() !== 'DELETE') {
      showWarning('Invalid Confirmation', 'Please type DELETE exactly in uppercase to confirm.');
      return;
    }

    setDeleting(true);
    try {
      await leadApi.deleteLead(leadId);
      setDeleteModalVisible(false);
      setDeleteInputText('');
      showSuccess('Lead Deleted', `Lead "${lead?.name || 'Lead'}" was deleted permanently.`);
      navigation.goBack();
    } catch (e: any) {
      showError('Delete Failed', e.message || 'Failed to delete lead.');
    } finally {
      setDeleting(false);
    }
  };

  // Date Format Helpers
  const formatFullDate12Hour = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const m = minutes.toString().padStart(2, '0');
      return `${day} ${month} ${year} • ${h12}:${m} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <LoadingState message="Loading lead profile..." fullScreen />
      </SafeAreaView>
    );
  }

  if (error || !lead) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <ErrorState message={error || 'Lead not found'} onRetry={() => loadData()} fullScreen />
      </SafeAreaView>
    );
  }

  const assignedOwner = lead.currentOwner || lead.assignedTo;
  const assignments: LeadAssignment[] = lead.assignmentHistory || lead.assignments || [];

  // Normalized Current Status derived strictly from lead record
  const rawStatus = (lead.status || 'NEW').toUpperCase();
  const currentStatus: CoreLeadStatus =
    rawStatus === 'CONVERTED'
      ? 'CONVERTED'
      : rawStatus === 'NOT_INTERESTED'
      ? 'NOT_INTERESTED'
      : rawStatus === 'IN_PROGRESS' || rawStatus === 'CONTACTED' || rawStatus === 'FOLLOW_UP'
      ? 'IN_PROGRESS'
      : 'NEW';

  // Available statuses for current user role (NEW is Admin-only)
  const availableStatuses: CoreLeadStatus[] = isAdmin
    ? ['NEW', 'IN_PROGRESS', 'CONVERTED', 'NOT_INTERESTED']
    : ['IN_PROGRESS', 'CONVERTED', 'NOT_INTERESTED'];

  // Status Change Validation & Confirmation Flow
  const handleInitiateStatusChange = (targetStatus: CoreLeadStatus) => {
    setStatusSelectorVisible(false);

    if (targetStatus === currentStatus) {
      return;
    }

    // Role check: Normal users cannot change to NEW
    if (!isAdmin && targetStatus === 'NEW') {
      Alert.alert('Permission Denied', 'Only Administrators can change lead status to New.');
      return;
    }

    if (targetStatus === 'IN_PROGRESS') {
      const hasAssignee = assignedOwner?.name || assignments.some((a) => a.isActive);
      if (!hasAssignee) {
        if (isAdmin) {
          Alert.alert(
            'Assignment Required',
            'Assign this lead to a sales executive before changing status to In Progress.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Assign Lead',
                onPress: () => setEditLeadVisible(true),
              },
            ]
          );
        } else {
          Alert.alert(
            'Assignment Required',
            'This lead must be assigned by an Admin before changing status to In Progress.'
          );
        }
        return;
      }
    }

    if (targetStatus === 'CONVERTED') {
      setConvertVisible(true);
      return;
    }

    setPendingStatus(targetStatus);
    setStatusNotes('');
    setStatusConfirmVisible(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatus) return;

    setUpdatingStatus(true);
    const targetStatus = pendingStatus;
    try {
      await leadApi.updateLeadStatus(leadId, targetStatus, statusNotes.trim() || undefined);
      
      // Immediately update local state so UI updates instantaneously without any lag
      setLead((prev) => {
        if (!prev) return prev;
        const isNew = targetStatus === 'NEW';
        return {
          ...prev,
          status: targetStatus,
          businessOutcome: targetStatus === 'NOT_INTERESTED' ? 'NOT_INTERESTED' : isNew ? undefined : prev.businessOutcome,
          currentOwner: isNew ? undefined : prev.currentOwner,
          assignedTo: isNew ? undefined : prev.assignedTo,
        };
      });

      setStatusConfirmVisible(false);
      setPendingStatus(null);
      setStatusNotes('');
      Alert.alert('Status Updated', `Lead status changed to ${targetStatus.replace('_', ' ')}.`);
      loadData(true);
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const avatarInitial = (lead.name || 'L').charAt(0).toUpperCase();

  // Status Color Helper
  const getStatusColor = (st: CoreLeadStatus) => {
    switch (st) {
      case 'IN_PROGRESS':
        return '#2563EB';
      case 'CONVERTED':
        return '#16A34A';
      case 'NOT_INTERESTED':
        return '#DC2626';
      case 'NEW':
      default:
        return '#64748B';
    }
  };

  const getStatusBg = (st: CoreLeadStatus) => {
    switch (st) {
      case 'IN_PROGRESS':
        return '#EFF6FF';
      case 'CONVERTED':
        return '#DCFCE7';
      case 'NOT_INTERESTED':
        return '#FEE2E2';
      case 'NEW':
      default:
        return '#F1F5F9';
    }
  };

  const getStatusLabel = (st: CoreLeadStatus) => {
    switch (st) {
      case 'IN_PROGRESS':
        return 'IN PROGRESS';
      case 'CONVERTED':
        return 'CONVERTED';
      case 'NOT_INTERESTED':
        return 'NOT INTERESTED';
      case 'NEW':
      default:
        return 'NEW';
    }
  };

  // Find most recent follow-up
  const sortedFollowUps = [...followUps].sort(
    (a, b) => new Date(b.scheduledTime || b.createdAt || '').getTime() - new Date(a.scheduledTime || a.createdAt || '').getTime()
  );
  const recentFollowUp = sortedFollowUps.length > 0 ? sortedFollowUps[0] : null;

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* ================================================================ */}
        {/* 1. TOP HEADER: Back, Title: Lead Details, Edit Button (Admin Only) */}
        {/* ================================================================ */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>

          <Text style={styles.headerTitleText}>Lead Details</Text>

          {/* Edit Button rendered ONLY for Admins */}
          {isAdmin ? (
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => setEditLeadVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-sharp" size={17} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>

        {/* Scrollable Main Content */}
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ================================================================ */}
          {/* 2. LARGE HERO GRADIENT LEAD CARD (Status Pinned Top-Right)       */}
          {/* ================================================================ */}
          <LinearGradient
            colors={['#0284C7', '#4F46E5', '#9333EA', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroLeadCard}
          >
            {/* Top Area: Avatar + Lead Info (Left/Center) & Status Badge (Pinned Top-Right) */}
            <View style={styles.heroTopRow}>
              {/* Circular Avatar */}
              <View style={styles.heroAvatarCircle}>
                <Text style={styles.heroAvatarInitial}>{avatarInitial}</Text>
              </View>

              {/* Name & Project (Flex: 1 so long names wrap/truncate cleanly without colliding) */}
              <View style={styles.heroNameCol}>
                <Text style={styles.heroLeadNameText} numberOfLines={2}>
                  {lead.name}
                </Text>
                <Text style={styles.heroProjectSubtitleText} numberOfLines={1}>
                  Project : {lead.project?.name || 'QmexSea'}
                </Text>
              </View>

              {/* Current Status Pill Badge - Fixed Top-Right */}
              <TouchableOpacity
                style={styles.heroStatusBadgePill}
                onPress={() => setStatusSelectorVisible(true)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.heroStatusDot,
                    { backgroundColor: getStatusColor(currentStatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.heroStatusBadgeText,
                    { color: getStatusColor(currentStatus) },
                  ]}
                >
                  {getStatusLabel(currentStatus)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Nested Translucent Glass Contact Card */}
            <View style={styles.heroGlassBox}>
              {/* Large Phone Number */}
              <TouchableOpacity
                onPress={handleCallCustomer}
                activeOpacity={0.8}
              >
                <Text style={styles.heroPhoneNumberText}>{lead.phone || '946464949'}</Text>
              </TouchableOpacity>

              {/* Email & Location with Divider */}
              <View style={styles.heroContactSubRow}>
                <TouchableOpacity
                  style={styles.heroContactSubItem}
                  onPress={handleOpenEmail}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mail" size={13} color="#FFFFFF" />
                  <Text style={styles.heroContactSubText} numberOfLines={1}>
                    {lead.email || 'ahha@gmail.com'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.heroContactDivider} />

                <TouchableOpacity
                  style={styles.heroContactSubItem}
                  onPress={handleOpenMaps}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-sharp" size={13} color="#FFFFFF" />
                  <Text style={styles.heroContactSubText} numberOfLines={1}>
                    {lead.city || lead.state || lead.address || 'Coimbatore'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* Quick Action Bar: Call, WhatsApp, Log Call */}
          <View style={styles.quickActionBar}>
            <TouchableOpacity
              style={styles.quickActionCallBtn}
              onPress={handleCallCustomer}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickActionCallGradient}
              >
                <Ionicons name="call" size={17} color="#FFFFFF" />
                <Text style={styles.quickActionCallText}>Call Lead</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtnSecondary}
              onPress={handleOpenWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
              <Text style={styles.quickActionBtnSecondaryText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtnSecondary}
              onPress={() => setLogCallVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="clipboard-outline" size={17} color="#2563EB" />
              <Text style={styles.quickActionBtnSecondaryText}>Log Call</Text>
            </TouchableOpacity>
          </View>

          {/* ================================================================ */}
          {/* 3. TABS CARD: Follow-ups | Status                                */}
          {/* ================================================================ */}
          <View style={styles.tabsMainCard}>
            {/* Tab Headers */}
            <View style={styles.tabHeadersRow}>
              <TouchableOpacity
                style={styles.tabHeaderItem}
                onPress={() => setActiveTab('FOLLOWUPS')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabHeaderText,
                    activeTab === 'FOLLOWUPS' && styles.tabHeaderTextActive,
                  ]}
                >
                  Follow-ups
                </Text>
                {activeTab === 'FOLLOWUPS' && <View style={styles.tabActiveIndicatorPink} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabHeaderItem}
                onPress={() => setActiveTab('STATUS')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabHeaderText,
                    activeTab === 'STATUS' && styles.tabHeaderTextActive,
                  ]}
                >
                  Status
                </Text>
                {activeTab === 'STATUS' && <View style={styles.tabActiveIndicatorPink} />}
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT: Follow-ups */}
            {activeTab === 'FOLLOWUPS' && (
              <View style={styles.tabBodySection}>
                <View style={styles.tabSectionHeaderRow}>
                  <Text style={styles.tabSectionHeaderTitle}>FOLLOW-UPS</Text>
                  <TouchableOpacity
                    style={styles.addFollowUpPillBtn}
                    onPress={() => setFollowUpVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={15} color="#FFFFFF" />
                    <Text style={styles.addFollowUpPillText}>Add Follow-up</Text>
                  </TouchableOpacity>
                </View>

                {recentFollowUp ? (
                  <View style={styles.recentFollowUpCard}>
                    <View style={styles.recentFollowUpIconSquare}>
                      <Ionicons name="calendar" size={18} color="#EA580C" />
                    </View>

                    <View style={styles.recentFollowUpBody}>
                      <Text style={styles.recentFollowUpTitle}>Recent Follow-up</Text>
                      <Text style={styles.recentFollowUpDate}>
                        {formatFullDate12Hour(recentFollowUp.scheduledTime || recentFollowUp.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.followUpStatusBadgeGold}>
                      <Text style={styles.followUpStatusBadgeTextGold}>
                        {recentFollowUp.status || 'Scheduled'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.recentFollowUpCard}>
                    <View style={styles.recentFollowUpIconSquare}>
                      <Ionicons name="calendar" size={18} color="#EA580C" />
                    </View>

                    <View style={styles.recentFollowUpBody}>
                      <Text style={styles.recentFollowUpTitle}>Recent Follow-up</Text>
                      <Text style={styles.recentFollowUpDate}>
                        {formatFullDate12Hour(lead.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.followUpStatusBadgeGold}>
                      <Text style={styles.followUpStatusBadgeTextGold}>Scheduled</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB CONTENT: Status */}
            {activeTab === 'STATUS' && (
              <View style={styles.tabBodySection}>
                <View style={styles.tabSectionHeaderRow}>
                  <Text style={styles.tabSectionHeaderTitle}>CURRENT PIPELINE STATUS</Text>
                  <TouchableOpacity
                    style={styles.changeStatusSmallBtn}
                    onPress={() => setStatusSelectorVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changeStatusSmallText}>Change</Text>
                    <Ionicons name="chevron-down" size={12} color="#2563EB" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pipelineChipsRow}>
                  {availableStatuses.map((st) => {
                    const isActive = currentStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.pipelineChip,
                          isActive && [
                            styles.pipelineChipActive,
                            { borderColor: getStatusColor(st), backgroundColor: getStatusBg(st) },
                          ],
                        ]}
                        onPress={() => handleInitiateStatusChange(st)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.pipelineChipDot,
                            { backgroundColor: isActive ? getStatusColor(st) : '#94A3B8' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.pipelineChipText,
                            isActive && { color: getStatusColor(st), fontWeight: '800' },
                          ]}
                        >
                          {st === 'IN_PROGRESS'
                            ? 'In Progress'
                            : st === 'NOT_INTERESTED'
                            ? 'Not Interested'
                            : st === 'CONVERTED'
                            ? 'Converted'
                            : 'New'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ================================================================ */}
          {/* 4. LEAD ACTIVITY SECTION                                        */}
          {/* ================================================================ */}
          <View style={styles.activitySection}>
            <Text style={styles.sectionHeaderTitle}>LEAD ACTIVITY</Text>

            <View style={styles.activityCardsList}>
              {/* 1. Timeline */}
              <TouchableOpacity
                style={styles.activityItemCard}
                onPress={() =>
                  navigation.navigate('LeadTimeline', {
                    leadId: lead.id,
                    leadName: lead.name,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={[styles.activityIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="time" size={18} color="#2563EB" />
                </View>

                <View style={styles.activityCardInfo}>
                  <Text style={styles.activityCardTitle}>Timeline</Text>
                  <Text style={styles.activityCardSubtitle}>
                    {timeline.length || 8} audit event{timeline.length === 1 ? '' : 's'} recorded
                  </Text>
                </View>

                <View style={styles.activityChevronCircle}>
                  <Ionicons name="chevron-forward" size={15} color="#64748B" />
                </View>
              </TouchableOpacity>

              {/* 2. Call History */}
              <TouchableOpacity
                style={styles.activityItemCard}
                onPress={() =>
                  navigation.navigate('CallHistoryDetail', {
                    leadId: lead.id,
                    leadName: lead.name,
                    phoneNumber: lead.phone,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={[styles.activityIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="call" size={18} color="#16A34A" />
                </View>

                <View style={styles.activityCardInfo}>
                  <Text style={styles.activityCardTitle}>Call History</Text>
                  <Text style={styles.activityCardSubtitle}>
                    {calls.length || 4} call record{calls.length === 1 ? '' : 's'} for this lead
                  </Text>
                </View>

                <View style={styles.activityChevronCircle}>
                  <Ionicons name="chevron-forward" size={15} color="#64748B" />
                </View>
              </TouchableOpacity>

              {/* 3. Follow-ups */}
              <TouchableOpacity
                style={styles.activityItemCard}
                onPress={() =>
                  navigation.navigate('LeadFollowUps', {
                    leadId: lead.id,
                    leadName: lead.name,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={[styles.activityIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="calendar" size={18} color="#D97706" />
                </View>

                <View style={styles.activityCardInfo}>
                  <Text style={styles.activityCardTitle}>Follow-ups</Text>
                  <Text style={styles.activityCardSubtitle}>
                    {followUps.length || 1} follow-up record{followUps.length === 1 ? '' : 's'}
                  </Text>
                </View>

                <View style={styles.activityChevronCircle}>
                  <Ionicons name="chevron-forward" size={15} color="#64748B" />
                </View>
              </TouchableOpacity>

              {/* 4. Assignments */}
              <TouchableOpacity
                style={styles.activityItemCard}
                onPress={() =>
                  navigation.navigate('LeadAssignments', {
                    leadId: lead.id,
                    leadName: lead.name,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={[styles.activityIconCircle, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="people" size={18} color="#7C3AED" />
                </View>

                <View style={styles.activityCardInfo}>
                  <Text style={styles.activityCardTitle}>Assignments</Text>
                  <Text style={styles.activityCardSubtitle}>
                    {assignedOwner?.name ? `Assigned to ${assignedOwner.name}` : 'Currently Unassigned'}
                  </Text>
                </View>

                <View style={styles.activityChevronCircle}>
                  <Ionicons name="chevron-forward" size={15} color="#64748B" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ================================================================ */}
          {/* 5. DANGER ZONE: DELETE LEAD (ADMIN ONLY - SUBTLE AT BOTTOM)      */}
          {/* ================================================================ */}
          {isAdmin && (
            <View style={styles.deleteLeadContainer}>
              <TouchableOpacity
                style={styles.deleteLeadBtnCompact}
                onPress={() => {
                  setDeleteInputText('');
                  setDeleteModalVisible(true);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={styles.deleteLeadBtnText}>Delete Lead</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ================================================================ */}
        {/* MODAL 1: FULL EDIT LEAD MODAL (ADMIN ONLY)                       */}
        {/* ================================================================ */}
        {isAdmin && (
          <EditLeadModal
            visible={editLeadVisible}
            lead={lead}
            agents={agents}
            projects={projects}
            isAdmin={isAdmin}
            onClose={() => setEditLeadVisible(false)}
            onSaved={() => loadData(true)}
          />
        )}

        {/* ================================================================ */}
        {/* MODAL 2: DELETE CONFIRMATION MODAL (TYPE "DELETE" TO CONFIRM)    */}
        {/* ================================================================ */}
        {isAdmin && (
          <Modal
            visible={deleteModalVisible}
            animationType="fade"
            transparent
            onRequestClose={() => setDeleteModalVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.deleteModalTitleRow}>
                    <View style={styles.deleteModalWarningBadge}>
                      <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    </View>
                    <Text style={styles.deleteModalTitle}>Delete this lead?</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.deleteWarningText}>
                  This action cannot be undone. All call history, timeline audit logs, and follow-up records for <Text style={{ fontWeight: '800' }}>{lead.name}</Text> will be permanently removed.
                </Text>

                <View style={styles.deleteInputBox}>
                  <Text style={styles.deleteInputPrompt}>
                    Type <Text style={styles.deleteCodePrompt}>DELETE</Text> to confirm:
                  </Text>
                  <TextInput
                    style={styles.deleteTextInput}
                    placeholder="Type DELETE"
                    value={deleteInputText}
                    onChangeText={setDeleteInputText}
                    autoCapitalize="characters"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setDeleteModalVisible(false)}
                    disabled={deleting}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.confirmDeleteBtn,
                      deleteInputText !== 'DELETE' && styles.confirmDeleteBtnDisabled,
                    ]}
                    onPress={handleConfirmDeleteLead}
                    disabled={deleteInputText !== 'DELETE' || deleting}
                    activeOpacity={0.85}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ================================================================ */}
        {/* MODAL 3: STATUS SELECTOR                                         */}
        {/* ================================================================ */}
        <Modal
          visible={statusSelectorVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setStatusSelectorVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Select Lead Status</Text>
                <TouchableOpacity onPress={() => setStatusSelectorVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Choose one of the 4 core pipeline statuses:
              </Text>

              <View style={{ gap: 8 }}>
                {/* NEW (Admin Only) */}
                {isAdmin && (
                  <TouchableOpacity
                    style={[
                      styles.statusModalOption,
                      currentStatus === 'NEW' && styles.statusModalOptionActive,
                    ]}
                    onPress={() => handleInitiateStatusChange('NEW')}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#94A3B8' }]} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.statusOptionTitle}>NEW</Text>
                      <Text style={styles.statusOptionSub}>Unassigned</Text>
                    </View>
                    {currentStatus === 'NEW' && (
                      <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                )}

                {/* IN PROGRESS */}
                <TouchableOpacity
                  style={[
                    styles.statusModalOption,
                    currentStatus === 'IN_PROGRESS' && styles.statusModalOptionActive,
                  ]}
                  onPress={() => handleInitiateStatusChange('IN_PROGRESS')}
                >
                  <View style={[styles.statusDot, { backgroundColor: '#38BDF8' }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.statusOptionTitle}>IN PROGRESS</Text>
                    <Text style={styles.statusOptionSub}>Assigned and in active outreach</Text>
                  </View>
                  {currentStatus === 'IN_PROGRESS' && (
                    <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                  )}
                </TouchableOpacity>

                {/* CONVERTED */}
                <TouchableOpacity
                  style={[
                    styles.statusModalOption,
                    currentStatus === 'CONVERTED' && styles.statusModalOptionActive,
                  ]}
                  onPress={() => handleInitiateStatusChange('CONVERTED')}
                >
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.statusOptionTitle}>CONVERTED</Text>
                    <Text style={styles.statusOptionSub}>Successfully converted into a sale</Text>
                  </View>
                  {currentStatus === 'CONVERTED' && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </TouchableOpacity>

                {/* NOT INTERESTED */}
                <TouchableOpacity
                  style={[
                    styles.statusModalOption,
                    currentStatus === 'NOT_INTERESTED' && styles.statusModalOptionActive,
                  ]}
                  onPress={() => handleInitiateStatusChange('NOT_INTERESTED')}
                >
                  <View style={[styles.statusDot, { backgroundColor: '#F43F5E' }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.statusOptionTitle}>NOT INTERESTED</Text>
                    <Text style={styles.statusOptionSub}>Customer is not interested</Text>
                  </View>
                  {currentStatus === 'NOT_INTERESTED' && (
                    <Ionicons name="checkmark-circle" size={18} color="#F43F5E" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ================================================================ */}
        {/* MODAL 4: STATUS CONFIRMATION MODAL                               */}
        {/* ================================================================ */}
        <Modal
          visible={statusConfirmVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setStatusConfirmVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Change Status?</Text>
                <TouchableOpacity onPress={() => setStatusConfirmVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.statusChangeVisualBox}>
                <Text style={styles.statusChangeFrom}>{currentStatus.replace('_', ' ')}</Text>
                <Ionicons name="arrow-forward" size={16} color="#6366F1" />
                <Text style={styles.statusChangeTo}>{pendingStatus?.replace('_', ' ')}</Text>
              </View>

              <Text style={styles.statusConfirmMessage}>
                {pendingStatus === 'NEW'
                  ? 'Changing status to NEW will automatically set this lead to Unassigned. Are you sure you want to proceed?'
                  : pendingStatus === 'NOT_INTERESTED'
                  ? 'Are you sure you want to mark this lead as Not Interested?'
                  : `Are you sure you want to change status to ${pendingStatus?.replace('_', ' ')}?`}
              </Text>

              <Text style={styles.inputLabel}>Reason / Remarks (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Budget constraints, unassigned for review..."
                value={statusNotes}
                onChangeText={setStatusNotes}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setStatusConfirmVisible(false)}
                  disabled={updatingStatus}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirmStatusChange}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 5: Log Call Modal */}
        <LogCallModal
          visible={logCallVisible}
          leadId={lead.id}
          leadName={lead.name}
          leadPhone={lead.phone}
          onClose={() => setLogCallVisible(false)}
          onCallLogged={() => loadData(true)}
        />

        {/* MODAL 6: FollowUp Modal */}
        <FollowUpModal
          visible={followUpVisible}
          leadId={lead.id}
          leadName={lead.name}
          onClose={() => setFollowUpVisible(false)}
          onScheduled={() => loadData(true)}
        />

        {/* MODAL 7: Convert to Sale Modal */}
        <ConvertSaleModal
          visible={convertVisible}
          leadId={lead.id}
          leadName={lead.name}
          onClose={() => setConvertVisible(false)}
          onConverted={() => loadData(true)}
        />
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // 1. TOP HEADER
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 16,
  },
  // 2. MAIN HERO LEAD CARD
  heroLeadCard: {
    borderRadius: 26,
    padding: 18,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroAvatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroAvatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroNameCol: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  heroLeadNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  heroProjectSubtitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 3,
  },
  heroStatusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroStatusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // NESTED FROSTED GLASS BOX
  heroGlassBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
  },
  heroPhoneNumberText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  heroContactSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroContactSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroContactSubText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  heroContactDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginHorizontal: 12,
  },
  // 3. TABS CARD
  tabsMainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabHeadersRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  tabHeaderItem: {
    marginRight: 24,
    paddingBottom: 8,
    position: 'relative',
  },
  tabHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  tabHeaderTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  tabActiveIndicatorPink: {
    position: 'absolute',
    bottom: -1.5,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#EC4899',
  },
  tabBodySection: {
    gap: 12,
  },
  tabSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabSectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  addFollowUpPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00C853',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  addFollowUpPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recentFollowUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  recentFollowUpIconSquare: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentFollowUpBody: {
    flex: 1,
  },
  recentFollowUpTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentFollowUpDate: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  followUpStatusBadgeGold: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  followUpStatusBadgeTextGold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  changeStatusSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeStatusSmallText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  pipelineChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pipelineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pipelineChipActive: {
    borderWidth: 1.5,
  },
  pipelineChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipelineChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  // 4. LEAD ACTIVITY SECTION
  activitySection: {
    gap: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
  activityCardsList: {
    gap: 8,
  },
  activityItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardInfo: {
    flex: 1,
  },
  activityCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  activityCardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  activityChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 5. DELETE LEAD BUTTON (ADMIN ONLY - COMPACT AT BOTTOM)
  deleteLeadContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  deleteLeadBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  deleteLeadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  // DELETE MODAL STYLES
  deleteModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteModalWarningBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  deleteWarningText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  deleteInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  deleteInputPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  deleteCodePrompt: {
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.8,
  },
  deleteTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  confirmDeleteBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // GENERAL MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusModalOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  statusOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusChangeVisualBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 12,
    marginVertical: 10,
  },
  statusChangeFrom: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  statusChangeTo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  statusConfirmMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  quickActionCallBtn: {
    flex: 1.4,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionCallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  quickActionCallText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
