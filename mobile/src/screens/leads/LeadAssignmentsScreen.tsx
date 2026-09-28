import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
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
import { usersApi } from '../../api/usersApi';
import { RootStackParamList, LeadDetailResponse, User } from '../../types';
import { useAuth } from '../../context/AuthContext';

type LeadAssignmentsRouteProp = RouteProp<RootStackParamList, 'LeadAssignments'>;

export const LeadAssignmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LeadAssignmentsRouteProp>();
  const insets = useSafeAreaInsets();
  const { user, isAdmin } = useAuth();
  const { leadId, leadName: initialLeadName } = route.params || {};

  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reassign Modal
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

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
        const [leadData, usersData] = await Promise.all([
          leadApi.getLeadDetails(leadId),
          isAdmin ? usersApi.getActiveUsers().catch(() => []) : Promise.resolve([]),
        ]);
        setLead(leadData);
        setAgents(usersData || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load assignment details');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leadId, isAdmin]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleConfirmReassign = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators are authorized to reassign leads.');
      return;
    }
    if (!selectedAgentId) {
      Alert.alert('Select Agent', 'Please select an executive to assign this lead to.');
      return;
    }
    setReassigning(true);
    try {
      await leadApi.reassignLead(leadId, selectedAgentId, reassignReason || undefined);
      Alert.alert('Success', 'Lead successfully reassigned.');
      setReassignModalVisible(false);
      setReassignReason('');
      loadData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reassign lead');
    } finally {
      setReassigning(false);
    }
  };

  const displayName = lead?.name || initialLeadName || 'Lead Assignments';
  const currentOwner = lead?.assignedTo || lead?.currentOwner;
  const assignmentsHistory = lead?.assignmentHistory || lead?.assignments || [];

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Header
          title="Assignments"
          subtitle={displayName}
          onBack={() => navigation.goBack()}
          rightAction={
            isAdmin ? (
              <TouchableOpacity
                style={styles.reassignTopBtn}
                onPress={() => {
                  setSelectedAgentId(currentOwner?.id || null);
                  setReassignModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
                <Text style={styles.reassignTopBtnText}>Reassign</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {loading && !refreshing ? (
          <LoadingState message="Loading assignments..." fullScreen />
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
            {/* 1. CURRENT ASSIGNED EXECUTIVE CARD */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Currently Assigned To</Text>
            </View>

            <View style={styles.currentOwnerCard}>
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerAvatarText}>
                  {currentOwner?.name ? currentOwner.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>

              <View style={styles.ownerInfo}>
                <Text style={styles.ownerName}>
                  {currentOwner ? currentOwner.name : 'Unassigned'}
                </Text>
                <Text style={styles.ownerRole}>
                  {currentOwner ? (currentOwner as any).role || 'Sales Executive' : 'Awaiting assignment'}
                </Text>

                {currentOwner?.phone ? (
                  <View style={styles.ownerMetaRow}>
                    <Ionicons name="call-outline" size={13} color="#64748B" />
                    <Text style={styles.ownerMetaText}>{currentOwner.phone}</Text>
                  </View>
                ) : null}

                {currentOwner?.email ? (
                  <View style={styles.ownerMetaRow}>
                    <Ionicons name="mail-outline" size={13} color="#64748B" />
                    <Text style={styles.ownerMetaText}>{currentOwner.email}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. ASSIGNMENT HISTORY SECTION */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={styles.sectionTitle}>Assignment History</Text>
              <Text style={styles.sectionSubtitle}>
                {assignmentsHistory.length} record{assignmentsHistory.length === 1 ? '' : 's'}
              </Text>
            </View>

            {assignmentsHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={38} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Previous Reassignments</Text>
                <Text style={styles.emptySub}>
                  This lead has not been reassigned between team members yet.
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {assignmentsHistory.map((item, index) => {
                  const assignedDate = item.assignedAt || (item as any).createdAt || '';
                  const reasonText = item.reason || (item as any).notes;
                  return (
                    <View key={item.id || index} style={styles.historyCard}>
                      <View style={styles.historyCardTop}>
                        <View style={styles.historyAvatarMini}>
                          <Ionicons name="person" size={14} color="#4F46E5" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyAgentName}>
                            {item.userName || (item as any).assignedToName || 'Executive'}
                          </Text>
                          <Text style={styles.historyDateText}>
                            {formatDateOnly(assignedDate)} • {format12Hour(assignedDate)}
                          </Text>
                        </View>
                      </View>

                      {reasonText ? (
                        <View style={styles.reasonBox}>
                          <Text style={styles.reasonKey}>Reason:</Text>
                          <Text style={styles.reasonVal}>{reasonText}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* REASSIGN MODAL */}
        <Modal
          visible={reassignModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReassignModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Reassign Lead</Text>
                  <Text style={styles.modalSubtitle}>Transfer ownership to another executive</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setReassignModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.pickerLabel}>SELECT EXECUTIVE</Text>
              <ScrollView style={styles.agentListScroll} showsVerticalScrollIndicator={false}>
                {agents.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  return (
                    <TouchableOpacity
                      key={agent.id}
                      style={[styles.agentOption, isSelected && styles.agentOptionSelected]}
                      onPress={() => setSelectedAgentId(agent.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.agentAvatarMini}>
                        <Text style={styles.agentAvatarText}>
                          {agent.name ? agent.name.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.agentName, isSelected && styles.agentNameSelected]}>
                          {agent.name}
                        </Text>
                        <Text style={styles.agentRole}>{agent.role || 'Sales Executive'}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                      ) : (
                        <View style={styles.unselectedCircle} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.pickerLabel, { marginTop: 12 }]}>REASON (OPTIONAL)</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Why is this lead being reassigned?"
                placeholderTextColor="#94A3B8"
                value={reassignReason}
                onChangeText={setReassignReason}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setReassignModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmReassign}
                  disabled={reassigning || !selectedAgentId}
                  activeOpacity={0.8}
                >
                  {reassigning ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Confirm Reassign</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  reassignTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  reassignTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  currentOwnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  ownerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  ownerAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4F46E5',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  ownerRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  ownerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  ownerMetaText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyAvatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyAgentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyDateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reasonBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 4,
  },
  reasonKey: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  reasonVal: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  agentListScroll: {
    maxHeight: 180,
  },
  agentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  agentOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  agentAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  agentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  agentNameSelected: {
    color: '#4F46E5',
  },
  agentRole: {
    fontSize: 11,
    color: '#64748B',
  },
  unselectedCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 13,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    minWidth: 120,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
