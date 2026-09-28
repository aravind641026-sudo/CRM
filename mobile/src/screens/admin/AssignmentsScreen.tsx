import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Keyboard,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { GradientView } from '../../components/common/GradientView';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { FormModal } from '../../components/common/FormModal';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { leadApi } from '../../api/leadApi';
import { usersApi } from '../../api/usersApi';
import { Lead, User } from '../../types';

export const AssignmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const bulkScrollViewRef = useRef<ScrollView>(null);
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterMode, setFilterMode] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [selectedAgentIdFilter, setSelectedAgentIdFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempMode, setTempMode] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>(filterMode);
  const [tempAgentIdFilter, setTempAgentIdFilter] = useState<number | null>(selectedAgentIdFilter);

  const openFilterModal = () => {
    setTempMode(filterMode);
    setTempAgentIdFilter(selectedAgentIdFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setFilterMode(tempMode);
    setSelectedAgentIdFilter(tempAgentIdFilter);
    setSelectedLeadIds([]);
  };

  const handleResetFilters = () => {
    setFilterMode('ALL');
    setSelectedAgentIdFilter(null);
    setSelectedLeadIds([]);
  };

  const hasActiveFilters = filterMode !== 'ALL' || selectedAgentIdFilter !== null;
  const activeFilterCount = (filterMode !== 'ALL' ? 1 : 0) + (selectedAgentIdFilter !== null ? 1 : 0);

  // Multi-Selection State for Bulk Assignment
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);

  // Bulk Assignment Modal State
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkAgentId, setBulkAgentId] = useState<number | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Single Reassignment Modal State
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [leadsRes, usersRes] = await Promise.all([
        leadApi.getLeads({ size: 100 }),
        usersApi.getUsers({ size: 100 }),
      ]);
      setLeads(leadsRes.content || []);
      setAgents((usersRes.content || []).filter((u) => u.status === 'ACTIVE'));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const isLeadAssigned = (l: Lead) => {
    return !!(l.currentOwnerName || l.currentOwnerId || l.currentOwner || l.assignedTo);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone.includes(searchQuery);

      const assigned = isLeadAssigned(l);
      if (filterMode === 'UNASSIGNED' && assigned) {
        return false;
      }
      if (filterMode === 'ASSIGNED' && !assigned) {
        return false;
      }

      if (selectedAgentIdFilter !== null) {
        const ownerId = l.currentOwnerId || l.currentOwner?.id || l.assignedTo?.id;
        if (ownerId !== selectedAgentIdFilter) {
          return false;
        }
      }

      return matchesSearch;
    });
  }, [leads, searchQuery, filterMode, selectedAgentIdFilter]);

  // Multi-selection helpers
  const toggleSelectLead = (id: number) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const visibleLeadIds = filteredLeads.map((l) => l.id);
  const isAllSelected =
    visibleLeadIds.length > 0 &&
    visibleLeadIds.every((id) => selectedLeadIds.includes(id));
  const isSomeSelected =
    selectedLeadIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLeadIds((prev) =>
        prev.filter((id) => !visibleLeadIds.includes(id))
      );
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...visibleLeadIds])));
    }
  };

  // Single Reassignment handlers
  const handleOpenReassign = (lead: Lead) => {
    setSelectedLead(lead);
    const initialAgentId =
      lead.currentOwnerId ||
      lead.currentOwner?.id ||
      lead.assignedTo?.id ||
      (agents[0]?.id ?? null);
    setSelectedAgentId(initialAgentId);
    setReassignReason('');
    setReassignModalVisible(true);
  };

  const handleCloseReassign = () => {
    Keyboard.dismiss();
    setReassignModalVisible(false);
  };

  const handleConfirmReassign = async () => {
    if (!selectedLead || !selectedAgentId) {
      Alert.alert('Selection Required', 'Please select an agent to assign the lead to.');
      return;
    }

    setSubmitting(true);
    try {
      await leadApi.reassignLead(selectedLead.id, selectedAgentId, reassignReason.trim() || undefined);
      Alert.alert('Success', `Lead reassigned successfully.`);
      handleCloseReassign();
      loadData(true);
    } catch (err: any) {
      Alert.alert('Reassignment Failed', err.message || 'Unable to reassign lead.');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Assignment handlers
  const handleOpenBulkAssign = () => {
    if (selectedLeadIds.length === 0) return;
    setBulkAgentId(null);
    setBulkModalVisible(true);
  };

  const handleCloseBulkAssign = () => {
    setBulkModalVisible(false);
    setBulkAgentId(null);
  };

  const handleConfirmBulkAssign = () => {
    if (selectedLeadIds.length === 0 || !bulkAgentId) {
      Alert.alert('Selection Required', 'Please select a user to assign the leads to.');
      return;
    }
    const targetAgent = agents.find((a) => a.id === bulkAgentId);
    const agentName = targetAgent?.name || 'the selected user';
    const count = selectedLeadIds.length;

    Alert.alert(
      'Confirm Assignment',
      `Assign ${count} selected lead${count > 1 ? 's' : ''} to ${agentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          style: 'default',
          onPress: async () => {
            setBulkSubmitting(true);
            try {
              await leadApi.bulkAssignLeads(selectedLeadIds, bulkAgentId);
              Alert.alert('Success', `✓ ${count} lead${count > 1 ? 's' : ''} assigned to ${agentName} successfully.`);
              setBulkModalVisible(false);
              setBulkAgentId(null);
              setSelectedLeadIds([]);
              loadData(true);
            } catch (err: any) {
              const errorMsg =
                err?.response?.data?.message || err?.message || 'Unable to assign leads.';
              Alert.alert('Assignment Failed', errorMsg);
            } finally {
              setBulkSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderLeadCard = ({ item }: { item: Lead }) => {
    const ownerName = item.currentOwnerName || item.currentOwner?.name || item.assignedTo?.name;
    const isSelected = selectedLeadIds.includes(item.id);

    return (
      <Card style={[styles.leadCard, isSelected && styles.leadCardSelected]}>
        <View style={styles.leadCardRow}>
          {/* Checkbox for Multi-Select */}
          <TouchableOpacity
            style={styles.checkboxTouchable}
            onPress={() => toggleSelectLead(item.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={22}
              color={isSelected ? colors.primary : '#94A3B8'}
            />
          </TouchableOpacity>

          <View style={styles.leadCardBody}>
            <View style={styles.leadCardTop}>
              <View style={styles.leadInfo}>
                <Text style={styles.leadName}>{item.name}</Text>
                <Text style={styles.leadPhone}>{item.phone}</Text>
                {item.project?.name && (
                  <Text style={styles.projectText}>Project: {item.project.name}</Text>
                )}
              </View>
              <Badge label={item.status} status={item.status} />
            </View>

            <View style={styles.ownerRow}>
              <View style={styles.ownerBadge}>
                <Ionicons
                  name={ownerName ? 'person-circle-outline' : 'alert-circle-outline'}
                  size={15}
                  color={ownerName ? colors.primary : colors.warning}
                />
                <Text style={styles.ownerText}>
                  Owner: {ownerName || 'Unassigned'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.reassignBtn}
                onPress={() => handleOpenReassign(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={14} color="#ffffff" />
                <Text style={styles.reassignBtnText}>
                  {ownerName ? 'Reassign' : 'Assign'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <AmbientBackground variant="admin">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <MeqHeader
          showLogo={false}
          title="Lead Assignments"
          subtitle="Distribute & reassign leads across sales agents"
          onBack={() => navigation.goBack()}
        />

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search leads by name or phone..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Select All Row */}
        {filteredLeads.length > 0 && (
          <View style={styles.selectAllRow}>
            <TouchableOpacity
              style={styles.selectAllTouchable}
              onPress={handleToggleSelectAll}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  isAllSelected
                    ? 'checkbox'
                    : isSomeSelected
                    ? 'remove-circle'
                    : 'square-outline'
                }
                size={20}
                color={isAllSelected || isSomeSelected ? colors.primary : '#94A3B8'}
              />
              <Text style={styles.selectAllText}>
                Select All ({filteredLeads.length})
              </Text>
            </TouchableOpacity>

            {selectedLeadIds.length > 0 && (
              <View style={styles.selectedCountPill}>
                <Text style={styles.selectedCountPillText}>
                  {selectedLeadIds.length} selected
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Assignments"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Assignment Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>ASSIGNMENT STATUS</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: `All Leads (${leads.length})` },
                  { id: 'UNASSIGNED', label: `Unassigned (${leads.filter((l) => !isLeadAssigned(l)).length})` },
                  { id: 'ASSIGNED', label: `Assigned (${leads.filter((l) => isLeadAssigned(l)).length})` },
                ] as const
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.filterChip,
                    tempMode === m.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempMode(m.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempMode === m.id && styles.filterChipTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filter by Agent */}
          {agents.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterSectionTitle}>ASSIGNED AGENT</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    tempAgentIdFilter === null && styles.filterChipActive,
                  ]}
                  onPress={() => setTempAgentIdFilter(null)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempAgentIdFilter === null && styles.filterChipTextActive,
                    ]}
                  >
                    All Agents
                  </Text>
                </TouchableOpacity>
                {agents.map((agent) => (
                  <TouchableOpacity
                    key={agent.id}
                    style={[
                      styles.filterChip,
                      tempAgentIdFilter === agent.id && styles.filterChipActive,
                    ]}
                    onPress={() => setTempAgentIdFilter(agent.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        tempAgentIdFilter === agent.id && styles.filterChipTextActive,
                      ]}
                    >
                      {agent.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </FilterSheetModal>

        {loading && !refreshing ? (
          <LoadingState message="Loading lead assignments..." fullScreen />
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No Leads Found"
            message={
              filterMode === 'UNASSIGNED'
                ? 'All leads are currently assigned to sales agents!'
                : 'No leads matched your search query or active filters.'
            }
          />
        ) : (
          <FlatList
            data={filteredLeads}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderLeadCard}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + (selectedLeadIds.length > 0 ? 120 : 90) },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
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

        {/* Floating Bulk Action Bar */}
        {selectedLeadIds.length > 0 && (
          <View style={[styles.bulkActionBar, { bottom: Math.max(insets.bottom + 12, 16) }]}>
            <View style={styles.bulkActionLeft}>
              <Text style={styles.bulkActionCount}>
                {selectedLeadIds.length} Lead{selectedLeadIds.length > 1 ? 's' : ''} Selected
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bulkAssignBtn}
              onPress={handleOpenBulkAssign}
              activeOpacity={0.85}
            >
              <GradientView
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bulkAssignGradient}
              >
                <Ionicons name="person-add" size={16} color="#FFFFFF" />
                <Text style={styles.bulkAssignBtnText}>Assign Selected</Text>
              </GradientView>
            </TouchableOpacity>
          </View>
        )}

        {/* Bulk Assign Modal */}
        <FormModal
          visible={bulkModalVisible}
          onClose={handleCloseBulkAssign}
          title="Reassign Selected Leads"
          onSave={handleConfirmBulkAssign}
          saveTitle="Assign"
          saveLoading={bulkSubmitting}
          saveDisabled={!bulkAgentId}
          saveVariant="primary"
          heightPercent={0.78}
          maxHeightPixels={540}
          scrollRef={bulkScrollViewRef}
        >
          <Text style={styles.fieldLabel}>
            Select User * ({agents.length})
          </Text>

          {agents.map((ag) => (
            <TouchableOpacity
              key={ag.id}
              style={[
                styles.agentOption,
                bulkAgentId === ag.id && styles.agentOptionActive,
              ]}
              onPress={() => setBulkAgentId(ag.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={bulkAgentId === ag.id ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={bulkAgentId === ag.id ? colors.primary : colors.textMuted}
              />
              <View style={styles.agentOptionInfo}>
                <Text
                  style={[
                    styles.agentOptionName,
                    bulkAgentId === ag.id && styles.agentOptionNameActive,
                  ]}
                >
                  {ag.name}
                </Text>
                <Text style={styles.agentOptionEmail}>{ag.email}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </FormModal>

        {/* Single Reassign Lead Modal */}
        <FormModal
          visible={reassignModalVisible}
          onClose={handleCloseReassign}
          title="Reassign Lead"
          onSave={handleConfirmReassign}
          saveTitle="Save"
          saveLoading={submitting}
          saveVariant="primary"
          heightPercent={0.82}
          maxHeightPixels={580}
          scrollRef={scrollViewRef}
        >
          {selectedLead && (
            <View style={styles.leadSummaryCard}>
              <Text style={styles.leadSummaryName}>{selectedLead.name}</Text>
              <Text style={styles.leadSummaryPhone}>{selectedLead.phone}</Text>
              <Text style={styles.leadSummaryCurrent}>
                Current Owner:{' '}
                {selectedLead.currentOwner?.name || selectedLead.assignedTo?.name || 'Unassigned'}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>
            Select Target Sales Agent * {agents.length > 0 && `(${agents.length})`}
          </Text>

          {agents.map((ag) => (
            <TouchableOpacity
              key={ag.id}
              style={[
                styles.agentOption,
                selectedAgentId === ag.id && styles.agentOptionActive,
              ]}
              onPress={() => setSelectedAgentId(ag.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedAgentId === ag.id ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selectedAgentId === ag.id ? colors.primary : colors.textMuted}
              />
              <View style={styles.agentOptionInfo}>
                <Text
                  style={[
                    styles.agentOptionName,
                    selectedAgentId === ag.id && styles.agentOptionNameActive,
                  ]}
                >
                  {ag.name}
                </Text>
                <Text style={styles.agentOptionEmail}>{ag.email}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={{ marginTop: spacing.sm }}>
            <Input
              label="Reassignment Reason (Optional)"
              placeholder="e.g. Workload balancing, language preference"
              value={reassignReason}
              onChangeText={setReassignReason}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />
          </View>
        </FormModal>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  selectAllTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedCountPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  selectedCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  leadCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  leadCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(238, 242, 255, 0.85)',
  },
  leadCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTouchable: {
    marginRight: 10,
    marginTop: 2,
  },
  leadCardBody: {
    flex: 1,
  },
  leadCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  leadPhone: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  projectText: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  ownerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.borderRadius.sm,
  },
  reassignBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  // Floating Bulk Action Bar
  bulkActionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderColor: 'rgba(224, 231, 255, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 100,
  },
  bulkActionLeft: {
    flex: 1,
  },
  bulkActionCount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  bulkAssignBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  bulkAssignGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  bulkAssignBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modals
  leadSummaryCard: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leadSummaryName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  leadSummaryPhone: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  leadSummaryCurrent: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  agentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: spacing.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    backgroundColor: colors.surface,
  },
  agentOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  agentOptionInfo: {
    marginLeft: 10,
    flex: 1,
  },
  agentOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  agentOptionNameActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  agentOptionEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
