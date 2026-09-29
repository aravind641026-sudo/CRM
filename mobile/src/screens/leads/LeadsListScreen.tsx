import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  TextInput,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { GradientView } from '../../components/common/GradientView';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { FormModal } from '../../components/common/FormModal';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { LogCallModal } from '../../components/leads/LogCallModal';
import { DeleteConfirmationModal } from '../../components/common/DeleteConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { leadApi } from '../../api/leadApi';
import { projectsApi } from '../../api/projectsApi';
import { usersApi } from '../../api/usersApi';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { Lead, Project, User } from '../../types';
import { openSystemDialer } from '../../utils/phoneDialer';

const FILTER_STATUS_OPTIONS = [
  { key: 'NEW', label: 'New', dot: '#94A3B8' },
  { key: 'IN_PROGRESS', label: 'In Progress', dot: '#38BDF8' },
  { key: 'CONVERTED', label: 'Converted', dot: '#22C55E' },
  { key: 'NOT_INTERESTED', label: 'Not Interested', dot: '#F43F5E' },
];

export const LeadsListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isAdmin, user } = useAuth();
  const isMyLeadsMode =
    route.params?.mode === 'MY_LEADS' ||
    route.params?.mode === 'MY_PROJECT_LEADS' ||
    route.params?.assignedToMe === true;

  const [projectId, setProjectId] = useState<number | undefined>(route.params?.projectId);
  const [projectName, setProjectName] = useState<string>(route.params?.projectName || 'All Leads');

  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bulkScrollViewRef = useRef<ScrollView>(null);

  // Filter Bottom Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Multi-selection for Admin on NEW tab
  const [selectedNewLeadIds, setSelectedNewLeadIds] = useState<number[]>([]);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkAgentId, setBulkAgentId] = useState<number | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Project Bottom Sheet Modal
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // Status Counts
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: leads.length };
    leads.forEach((l) => {
      if (l.status) {
        counts[l.status] = (counts[l.status] || 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  // Add Lead Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadProject, setNewLeadProject] = useState<number | null>(null);
  const [newLeadAgent, setNewLeadAgent] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick Log Call Modal
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<Lead | null>(null);

  // Delete Lead Confirmation Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);

  useEffect(() => {
    const fetchProj = !isAdmin ? leadApi.getActiveProjects() : projectsApi.getProjects();
    fetchProj.then((projs) => {
      setProjects(projs || []);
      if (projs && projs.length > 0 && !projectId && route.params?.projectId) {
        setProjectId(route.params.projectId);
      }
    }).catch(console.warn);

    if (isAdmin) {
      usersApi.getUsers({ size: 100 }).then((res) => {
        setAgents((res.content || []).filter((u) => u.status === 'ACTIVE'));
      }).catch(console.warn);
    }
  }, [isAdmin, projectId, route.params?.projectId]);

  useEffect(() => {
    if (route.params?.projectId !== undefined) {
      setProjectId(route.params.projectId);
    }
    if (route.params?.projectName) {
      setProjectName(route.params.projectName);
    }
    if (route.params?.status) {
      setSelectedStatus(route.params.status);
    }
  }, [route.params?.projectId, route.params?.projectName, route.params?.status, route.params?.mode]);

  const fetchLeads = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const targetProjectId = route.params?.projectId !== undefined ? route.params.projectId : projectId;
        const res = await leadApi.getLeads({
          projectId: targetProjectId,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchQuery.trim() || undefined,
          assignedToMe: !isAdmin || isMyLeadsMode ? true : undefined,
          size: 200,
        });
        setLeads(res.content || []);
      } catch (err: any) {
        console.warn('Failed to fetch leads:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId, selectedStatus, searchQuery, isMyLeadsMode, isAdmin, route.params?.projectId]
  );

  useFocusEffect(
    useCallback(() => {
      if (route.params?.projectId !== undefined) {
        setProjectId(route.params.projectId);
      }
      if (route.params?.projectName) {
        setProjectName(route.params.projectName);
      }
      if (route.params?.status) {
        setSelectedStatus(route.params.status);
      }
      fetchLeads(true);
    }, [route.params?.projectId, route.params?.projectName, route.params?.status, fetchLeads])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads(true);
  };

  const handleOpenAddLead = () => {
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadEmail('');
    setNewLeadCity('');
    setNewLeadProject(projectId || (projects[0]?.id ?? null));
    setNewLeadAgent(null);
    setAddModalVisible(true);
  };

  const handleCreateLead = async () => {
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      Alert.alert('Validation Error', 'Lead name and phone number are required.');
      return;
    }
    if (!newLeadProject) {
      Alert.alert('Validation Error', 'Please select a project for this lead.');
      return;
    }

    setSubmitting(true);
    try {
      await leadApi.createLead({
        name: newLeadName.trim(),
        phone: newLeadPhone.trim(),
        email: newLeadEmail.trim() || undefined,
        city: newLeadCity.trim() || undefined,
        projectId: newLeadProject,
        assignedUserId: newLeadAgent || undefined,
      });
      Alert.alert('Success', 'Lead created successfully.');
      setAddModalVisible(false);
      fetchLeads(true);
    } catch (err: any) {
      Alert.alert('Failed to Create Lead', err.message || 'Unable to save lead.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLead = (lead: Lead) => {
    setLeadToDelete(lead);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteLead = async () => {
    if (!leadToDelete) return;
    setDeletingLead(true);
    try {
      await leadApi.deleteLead(leadToDelete.id);
      setDeleteModalVisible(false);
      setLeadToDelete(null);
      fetchLeads(true);
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message || 'Unable to delete lead.');
    } finally {
      setDeletingLead(false);
    }
  };

  const handleOpenLead = (lead: Lead) => {
    navigation.navigate('LeadDetails', {
      leadId: lead.id,
      leadName: lead.name,
    });
  };

  const handleQuickCall = (phone?: string) => {
    openSystemDialer(phone);
  };

  const getLeadStatusConfig = (status?: string) => {
    const st = (status || 'NEW').toUpperCase();
    switch (st) {
      case 'CONVERTED':
        return {
          label: 'CONVERTED',
          textColor: '#10B981',
          dotColor: '#10B981',
          bgColor: '#DCFCE7',
          barColor: '#10B981',
          gradient: ['#10B981', '#059669'],
        };
      case 'IN_PROGRESS':
        return {
          label: 'IN PROGRESS',
          textColor: '#2563EB',
          dotColor: '#2563EB',
          bgColor: '#EFF6FF',
          barColor: '#3B82F6',
          gradient: ['#6366F1', '#4F46E5'],
        };
      case 'CONTACTED':
        return {
          label: 'CONTACTED',
          textColor: '#2563EB',
          dotColor: '#2563EB',
          bgColor: '#EFF6FF',
          barColor: '#3B82F6',
          gradient: ['#6366F1', '#4F46E5'],
        };
      case 'FOLLOW_UP':
        return {
          label: 'FOLLOW UP',
          textColor: '#D97706',
          dotColor: '#D97706',
          bgColor: '#FEF3C7',
          barColor: '#F59E0B',
          gradient: ['#F59E0B', '#D97706'],
        };
      case 'NOT_INTERESTED':
      case 'CLOSED':
        return {
          label: 'NOT INTERESTED',
          textColor: '#DC2626',
          dotColor: '#DC2626',
          bgColor: '#FEE2E2',
          barColor: '#EF4444',
          gradient: ['#EF4444', '#DC2626'],
        };
      case 'NEW':
      default:
        return {
          label: 'NEW',
          textColor: '#64748B',
          dotColor: '#64748B',
          bgColor: '#F1F5F9',
          barColor: '#94A3B8',
          gradient: ['#818CF8', '#6366F1'],
        };
    }
  };

  const renderLeadCard = useCallback(({ item }: { item: Lead }) => {
    const ownerName = item.currentOwner?.name || item.assignedTo?.name || 'Unassigned';
    const projectNameStr = item.project?.name || item.projectName || projectName || 'CRM Project';
    const statusCfg = getLeadStatusConfig(item.status);
    const initial = (item.name || 'L').charAt(0).toUpperCase();
    const isNewTabAdmin = isAdmin && selectedStatus === 'NEW';
    const isSelected = selectedNewLeadIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.referenceLeadCard,
          isSelected && styles.leadCardSelected,
        ]}
        activeOpacity={0.82}
        onPress={() => {
          if (isNewTabAdmin && selectedNewLeadIds.length > 0) {
            if (isSelected) {
              setSelectedNewLeadIds((prev) => prev.filter((id) => id !== item.id));
            } else {
              setSelectedNewLeadIds((prev) => [...prev, item.id]);
            }
          } else {
            handleOpenLead(item);
          }
        }}
      >
        {/* Left vertical accent color strip */}
        <View style={[styles.cardLeftAccentBar, { backgroundColor: statusCfg.barColor }]} />

        <View style={styles.cardMainInner}>
          {/* Top Row: (Optional Checkbox) + Avatar + Info + Status Pill + Arrow */}
          <View style={styles.cardTopRow}>
            {isNewTabAdmin && (
              <TouchableOpacity
                style={styles.leadCheckboxTouchable}
                onPress={() => {
                  if (isSelected) {
                    setSelectedNewLeadIds((prev) => prev.filter((id) => id !== item.id));
                  } else {
                    setSelectedNewLeadIds((prev) => [...prev, item.id]);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isSelected ? colors.primary : '#94A3B8'}
                />
              </TouchableOpacity>
            )}

            {/* Avatar Squircle */}
            <LinearGradient
              colors={statusCfg.gradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardAvatarSquare}
            >
              <Text style={styles.cardAvatarText}>{initial}</Text>
            </LinearGradient>

            {/* Name & Phone */}
            <View style={styles.cardInfoCol}>
              <Text style={styles.cardLeadName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.cardPhoneRow}>
                <Ionicons name="call" size={13} color="#64748B" style={{ marginRight: 5 }} />
                <Text style={styles.cardPhoneText}>{item.phone || '-'}</Text>
              </View>
            </View>

            {/* Status Badge Pill */}
            <View style={[styles.cardStatusPill, { backgroundColor: statusCfg.bgColor }]}>
              <View style={[styles.cardStatusDot, { backgroundColor: statusCfg.dotColor }]} />
              <Text style={[styles.cardStatusText, { color: statusCfg.textColor }]}>
                {statusCfg.label}
              </Text>
            </View>

            {/* Right Arrow */}
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" style={{ marginLeft: 6 }} />
          </View>

          {/* Bottom Row: Project pill + Assigned pill */}
          <View style={styles.cardBottomRow}>
            {/* Project Pill */}
            <View style={styles.cardMetaPill}>
              <Ionicons name="folder" size={13} color="#6366F1" style={{ marginRight: 5 }} />
              <Text style={styles.cardMetaPillLabel}>
                Project: <Text style={styles.cardMetaPillValue}>{projectNameStr}</Text>
              </Text>
            </View>

            {/* Assigned Pill */}
            <View style={styles.cardMetaPill}>
              <Ionicons name="person" size={13} color="#6366F1" style={{ marginRight: 5 }} />
              <Text style={styles.cardMetaPillLabel}>
                Assigned: <Text style={styles.cardMetaPillValue}>{ownerName}</Text>
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isAdmin, selectedStatus, selectedNewLeadIds, projectName, handleOpenLead]);

  const handleSelectProject = useCallback((selectedProj?: Project) => {
    const newId = selectedProj?.id;
    const newName = selectedProj?.name || (!isAdmin ? 'My Leads' : 'All Leads');

    setProjectId(newId);
    setProjectName(newName);
    setProjectModalVisible(false);
    setProjectSearch('');
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedNewLeadIds([]);
    setLeads([]);
    setLoading(true);

    navigation.setParams({
      projectId: newId,
      projectName: newName,
      mode: undefined,
    });

    leadApi
      .getLeads({
        projectId: newId,
        status: undefined,
        search: undefined,
        assignedToMe: !isAdmin || isMyLeadsMode ? true : undefined,
        size: 200,
      })
      .then((res) => {
        setLeads(res.content || []);
      })
      .catch((err) => {
        console.warn('Failed to fetch leads for switched project:', err);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [isAdmin, isMyLeadsMode, navigation]);

  const filteredLeads = React.useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase().trim();
    return leads.filter((l) => {
      const nameMatch = l.name ? l.name.toLowerCase().includes(q) : false;
      const phoneMatch = l.phone ? l.phone.toLowerCase().includes(q) : false;
      const emailMatch = l.email ? l.email.toLowerCase().includes(q) : false;
      const cityMatch = l.city ? l.city.toLowerCase().includes(q) : false;
      return nameMatch || phoneMatch || emailMatch || cityMatch;
    });
  }, [leads, searchQuery]);

  const renderEmptyComponent = useCallback(() => {
    if (loading && !refreshing) return null;
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="people-outline"
          title={searchQuery || selectedStatus !== 'ALL' ? 'No Leads Found' : 'No Leads Available'}
          description={
            searchQuery || selectedStatus !== 'ALL'
              ? 'No leads match the selected filters or search.'
              : 'No leads available in this project.'
          }
          actionTitle={searchQuery || selectedStatus !== 'ALL' ? 'Clear Filters' : isAdmin ? 'Add Lead' : undefined}
          onAction={
            searchQuery || selectedStatus !== 'ALL'
              ? () => {
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }
              : isAdmin
              ? handleOpenAddLead
              : undefined
          }
          style={styles.emptyStateStyle}
        />
      </View>
    );
  }, [loading, refreshing, searchQuery, selectedStatus, isAdmin]);

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <MeqHeader
        showLogo={false}
        title={projectName}
        subtitle={
          projectId !== undefined
            ? 'Dedicated project campaign & pipeline'
            : isAdmin
            ? 'Complete organization leads directory & pipeline'
            : 'Assigned customer leads'
        }
        onBack={
          projectId !== undefined
            ? () => {
                if (route.params?.projectId) {
                  navigation.goBack();
                } else {
                  handleSelectProject(undefined);
                }
              }
            : () => navigation.goBack()
        }
        rightElement={
          isAdmin ? (
            <TouchableOpacity
              style={styles.addLeadBtn}
              onPress={handleOpenAddLead}
              activeOpacity={0.7}
            >
              <GradientView
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addLeadGradient}
              >
                <Ionicons name="person-add" size={15} color="#ffffff" />
              </GradientView>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Persistent Stable Header Section (Project Context Banner + Search Bar + Filter Button) */}
      <View style={styles.listHeaderWrapper}>
        {/* 1. Project Selector / Dedicated Context */}
        {projectId !== undefined ? (
          <View style={styles.projectContextBanner}>
            <View style={styles.projectContextInfo}>
              <View style={styles.projectContextIconCircle}>
                <Ionicons name="folder" size={18} color="#6366F1" />
              </View>
              <View style={styles.projectContextTextCol}>
                <Text style={styles.projectContextTitle} numberOfLines={1}>
                  {projectName}
                </Text>
                <Text style={styles.projectContextSubtitle}>
                  {leads.length} Leads • {leads.filter((l) => l.status === 'FOLLOW_UP').length} Follow-ups • {leads.filter((l) => l.businessOutcome === 'INTERESTED').length} Interested
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.switchProjectBtn}
              onPress={() => setProjectModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.switchProjectBtnText}>Switch</Text>
              <Ionicons name="chevron-down" size={13} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.projectSelectorRow}>
            <Text style={styles.projectSelectorLabel}>Project</Text>
            <TouchableOpacity
              style={styles.projectDropdownBtn}
              onPress={() => setProjectModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.projectDropdownLeft}>
                <Ionicons name="briefcase-outline" size={14} color={colors.primary} />
                <Text style={styles.projectDropdownText} numberOfLines={1}>
                  {!isAdmin ? 'My Projects' : 'All Projects'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* 2. Modern Rounded Search Bar with Filter Button Beside It */}
        <View style={styles.searchRowContainer}>
          <View
            style={[
              styles.searchContainer,
              isSearchFocused && styles.searchContainerFocused,
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={isSearchFocused ? '#7C3AED' : '#94A3B8'}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, phone or email..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={17} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              selectedStatus !== 'ALL' && styles.filterBtnActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={selectedStatus !== 'ALL' ? '#FFFFFF' : '#64748B'}
            />
            {selectedStatus !== 'ALL' && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        {/* 3. Select All Strip for Admin on NEW Tab */}
        {isAdmin && selectedStatus === 'NEW' && filteredLeads.length > 0 && (
          <View style={styles.newSelectAllRow}>
            <TouchableOpacity
              style={styles.newSelectAllTouchable}
              onPress={() => {
                const allIds = filteredLeads.map((l) => l.id);
                const allSelected = allIds.length > 0 && allIds.every((id) => selectedNewLeadIds.includes(id));
                if (allSelected) {
                  setSelectedNewLeadIds([]);
                } else {
                  setSelectedNewLeadIds(allIds);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  filteredLeads.length > 0 && filteredLeads.every((l) => selectedNewLeadIds.includes(l.id))
                    ? 'checkbox'
                    : selectedNewLeadIds.length > 0
                    ? 'remove-circle'
                    : 'square-outline'
                }
                size={20}
                color={selectedNewLeadIds.length > 0 ? colors.primary : '#94A3B8'}
              />
              <Text style={styles.newSelectAllText}>
                Select All ({filteredLeads.length})
              </Text>
            </TouchableOpacity>

            {selectedNewLeadIds.length > 0 && (
              <View style={styles.newSelectedPill}>
                <Text style={styles.newSelectedPillText}>
                  {selectedNewLeadIds.length} selected
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Main Smooth Leads FlatList with Native Single-Source-of-Truth Scrolling */}
      {loading && !refreshing && leads.length === 0 ? (
        <LoadingState message="Loading leads..." fullScreen />
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderLeadCard}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (selectedNewLeadIds.length > 0 ? 130 : 90) },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
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

      {/* Floating Bulk Action Bar for NEW tab */}
      {isAdmin && selectedStatus === 'NEW' && selectedNewLeadIds.length > 0 && (
        <View style={[styles.bulkActionBar, { bottom: Math.max(insets.bottom + 12, 16) }]}>
          <View style={styles.bulkActionLeft}>
            <Text style={styles.bulkActionCount}>
              {selectedNewLeadIds.length} Lead{selectedNewLeadIds.length > 1 ? 's' : ''} Selected
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bulkAssignBtn}
            onPress={() => {
              setBulkAgentId(null);
              setBulkModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <GradientView
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bulkAssignGradient}
            >
              <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
              <Text style={styles.bulkAssignBtnText}>Reassign</Text>
            </GradientView>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk Reassign Modal for NEW tab */}
      <FormModal
        visible={bulkModalVisible}
        onClose={() => {
          setBulkModalVisible(false);
          setBulkAgentId(null);
        }}
        title="Reassign Selected Leads"
        onSave={() => {
          if (selectedNewLeadIds.length === 0 || !bulkAgentId) {
            Alert.alert('Selection Required', 'Please select a user to assign the leads to.');
            return;
          }
          const targetAgent = agents.find((a) => a.id === bulkAgentId);
          const agentName = targetAgent?.name || 'the selected user';
          const count = selectedNewLeadIds.length;

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
                    await leadApi.bulkAssignLeads(selectedNewLeadIds, bulkAgentId);
                    Alert.alert('Success', `✓ ${count} lead${count > 1 ? 's' : ''} assigned to ${agentName} successfully.`);
                    setBulkModalVisible(false);
                    setBulkAgentId(null);
                    setSelectedNewLeadIds([]);
                    fetchLeads(true);
                  } catch (err: any) {
                    const errorMsg =
                      err?.response?.data?.message || err?.message || 'Unable to reassign leads.';
                    Alert.alert('Assignment Failed', errorMsg);
                  } finally {
                    setBulkSubmitting(false);
                  }
                },
              },
            ]
          );
        }}
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

        {agents.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>No active users available.</Text>
          </View>
        ) : (
          agents.map((ag) => {
            const isSelected = bulkAgentId === ag.id;
            return (
              <TouchableOpacity
                key={ag.id}
                style={[
                  styles.agentOption,
                  isSelected && styles.agentOptionActive,
                ]}
                onPress={() => setBulkAgentId(ag.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <View style={styles.agentOptionInfo}>
                  <Text
                    style={[
                      styles.agentOptionName,
                      isSelected && styles.agentOptionNameActive,
                    ]}
                  >
                    {ag.name}
                  </Text>
                  <Text style={styles.agentOptionEmail}>{ag.email || ag.role || 'Active'}</Text>
                </View>
                {isSelected && (
                  <View style={styles.userSelectedBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </FormModal>

      {/* Quick Log Call Modal */}
      {selectedLeadForCall && (
        <LogCallModal
          visible={!!selectedLeadForCall}
          leadId={selectedLeadForCall.id}
          leadName={selectedLeadForCall.name}
          leadPhone={selectedLeadForCall.phone}
          onClose={() => setSelectedLeadForCall(null)}
          onCallLogged={() => {
            fetchLeads(true);
          }}
        />
      )}

      {/* Add Lead Modal */}
      <FormModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title="Add New Lead"
        onSave={handleCreateLead}
        saveTitle="Save"
        saveLoading={submitting}
        saveVariant="primary"
        heightPercent={0.85}
        maxHeightPixels={620}
      >
        <Input
          label="Customer Name *"
          placeholder="e.g. John Doe"
          value={newLeadName}
          onChangeText={setNewLeadName}
        />

        <Input
          label="Phone Number *"
          placeholder="+91 98765 43210"
          value={newLeadPhone}
          onChangeText={setNewLeadPhone}
          keyboardType="phone-pad"
        />

        <Input
          label="Email Address"
          placeholder="john@example.com"
          value={newLeadEmail}
          onChangeText={setNewLeadEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="City / Location"
          placeholder="e.g. Mumbai"
          value={newLeadCity}
          onChangeText={setNewLeadCity}
        />

        {/* Project Selector */}
        <Text style={styles.fieldLabel}>Select Project *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.modalProjectPicker}
        >
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.modalProjPill,
                newLeadProject === p.id && styles.modalProjPillActive,
              ]}
              onPress={() => setNewLeadProject(p.id)}
            >
              <Text
                style={[
                  styles.modalProjPillText,
                  newLeadProject === p.id && styles.modalProjPillTextActive,
                ]}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Agent Assign (Admin only) */}
        {isAdmin && agents.length > 0 && (
          <View style={{ marginTop: spacing.xs }}>
            <Text style={styles.fieldLabel}>Assign To Agent (Optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.modalProjectPicker}
            >
              <TouchableOpacity
                style={[
                  styles.modalProjPill,
                  newLeadAgent === null && styles.modalProjPillActive,
                ]}
                onPress={() => setNewLeadAgent(null)}
              >
                <Text
                  style={[
                    styles.modalProjPillText,
                    newLeadAgent === null && styles.modalProjPillTextActive,
                  ]}
                >
                  Unassigned
                </Text>
              </TouchableOpacity>
              {agents.map((ag) => (
                <TouchableOpacity
                  key={ag.id}
                  style={[
                    styles.modalProjPill,
                    newLeadAgent === ag.id && styles.modalProjPillActive,
                  ]}
                  onPress={() => setNewLeadAgent(ag.id)}
                >
                  <Text
                    style={[
                      styles.modalProjPillText,
                      newLeadAgent === ag.id && styles.modalProjPillTextActive,
                    ]}
                  >
                    {ag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </FormModal>

      {/* Project Bottom Sheet Modal */}
      <Modal
        visible={projectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProjectModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => setProjectModalVisible(false)}
          />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Project</Text>
              <TouchableOpacity
                onPress={() => setProjectModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {projects.length > 4 && (
              <View style={styles.sheetSearchBox}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search projects..."
                  placeholderTextColor={colors.textMuted}
                  value={projectSearch}
                  onChangeText={setProjectSearch}
                />
                {projectSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProjectSearch('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              style={styles.sheetList}
              contentContainerStyle={styles.sheetListContent}
              showsVerticalScrollIndicator={false}
            >
              {/* All Projects Option */}
              <TouchableOpacity
                style={[
                  styles.sheetItem,
                  projectId === undefined && styles.sheetItemActive,
                ]}
                onPress={() => {
                  handleSelectProject(undefined);
                }}
              >
                <View style={styles.sheetItemLeft}>
                  <Ionicons
                    name={projectId === undefined ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={projectId === undefined ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.sheetItemText,
                      projectId === undefined && styles.sheetItemTextActive,
                    ]}
                  >
                    {!isAdmin ? 'All My Leads' : 'All Projects'}
                  </Text>
                </View>
                <Badge
                  label={
                    !isAdmin
                      ? `${projects.reduce((sum, p) => sum + (p.assignedLeadsCount ?? p.totalLeads ?? 0), 0)} leads`
                      : 'All'
                  }
                  variant="neutral"
                />
              </TouchableOpacity>

              {/* Individual Projects */}
              {projects
                .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                .map((p) => {
                  const isSelected = projectId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                      onPress={() => {
                        handleSelectProject(p);
                      }}
                    >
                      <View style={styles.sheetItemLeft}>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={isSelected ? colors.primary : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.sheetItemText,
                            isSelected && styles.sheetItemTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </View>
                      <Text style={styles.sheetCountText}>
                        {(p.assignedLeadsCount ?? p.totalLeads ?? 0)} leads
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filter by Status Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.filterSheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.filterSheetTitleRow}>
                <Ionicons name="funnel-outline" size={17} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={styles.sheetTitle}>Filter by Status</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {FILTER_STATUS_OPTIONS.map((item) => {
                const isSelected = selectedStatus === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.filterOptionItem,
                      isSelected && styles.filterOptionItemActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedStatus('ALL');
                      } else {
                        setSelectedStatus(item.key);
                      }
                      setSelectedNewLeadIds([]);
                      setFilterModalVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.filterOptionLeft}>
                      <View style={[styles.filterStatusDot, { backgroundColor: item.dot }]} />
                      <Text
                        style={[
                          styles.filterOptionText,
                          isSelected && styles.filterOptionTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>

                    <View style={[styles.filterRadioOuter, isSelected && styles.filterRadioOuterActive]}>
                      {isSelected ? (
                        <View style={styles.filterRadioInner} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Clear / Reset Filter Button */}
            {selectedStatus !== 'ALL' && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSelectedStatus('ALL');
                  setSelectedNewLeadIds([]);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={15} color="#EF4444" />
                <Text style={styles.resetFilterBtnText}>Reset / Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Typed Delete Lead Confirmation Modal */}
      <DeleteConfirmationModal
        visible={deleteModalVisible}
        onClose={() => {
          if (!deletingLead) {
            setDeleteModalVisible(false);
            setLeadToDelete(null);
          }
        }}
        onConfirm={handleConfirmDeleteLead}
        title="Delete Lead?"
        itemName={leadToDelete?.name}
        description={`Are you sure you want to delete lead "${leadToDelete?.name || ''}"? This action cannot be undone.`}
        confirmKeyword="DELETE"
        loading={deletingLead}
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
  addLeadBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addLeadGradient: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderWrapper: {
    paddingBottom: 4,
  },
  // Dedicated Project Context Banner
  projectContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  projectContextInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  projectContextIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  projectContextTextCol: {
    flex: 1,
  },
  projectContextTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  projectContextSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  switchProjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    marginLeft: 8,
  },
  switchProjectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  // Compact Project Selector Row
  projectSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 0,
    marginTop: 2,
    marginBottom: 8,
  },
  projectSelectorLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  projectDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 160,
    maxWidth: 240,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  projectDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  projectDropdownText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  // Reference Lead Card Styles
  referenceLeadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
  },
  cardLeftAccentBar: {
    width: 4.5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardMainInner: {
    flex: 1,
    padding: 13,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatarSquare: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  cardAvatarText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  cardLeadName: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  cardPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPhoneText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  cardStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  cardStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  cardMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    flexShrink: 1,
  },
  cardMetaPillLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardMetaPillValue: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '700',
  },
  // Modern Rounded Search Bar with Filter Button
  searchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginTop: 0,
    marginBottom: 10,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchContainerFocused: {
    borderColor: '#C084FC',
    backgroundColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
    fontWeight: '500',
  },
  clearSearchBtn: {
    padding: 2,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  filterBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  emptyStateStyle: {
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 110,
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
  leadCardWithCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leadCheckboxTouchable: {
    marginRight: 10,
    marginTop: 2,
  },
  newSelectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginBottom: 8,
  },
  newSelectAllTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newSelectAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  newSelectedPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  newSelectedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
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
  },
  agentOptionEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  userSelectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  leadHeader: {
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
    marginTop: 1,
  },
  leadEmail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  badgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
  },
  projectText: {
    fontSize: 11,
    color: colors.primary,
  },
  ownerText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  unassignedText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  callActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  logActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logActionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  detailsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsActionText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalScrollBody: {
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalProjectPicker: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  modalProjPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalProjPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  modalProjPillText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  modalProjPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexShrink: 0,
  },
  modalActionBtn: {
    flex: 1,
  },
  // Bottom Sheet Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  bottomSheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 38,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: 6,
    paddingVertical: 0,
  },
  sheetList: {
    maxHeight: 360,
  },
  sheetListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  sheetItemActive: {
    backgroundColor: colors.primaryLight,
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sheetItemText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  sheetItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sheetCountText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  myLeadCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  myLeadCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myLeadTextCol: {
    flex: 1,
    marginRight: 10,
  },
  myLeadName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  myLeadProject: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  myLeadCallsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  myLeadCallsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  viewOnlyBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
    marginBottom: 3,
  },
  viewOnlyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  // Filter Bottom Sheet Styles
  filterSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  filterSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterOptionsList: {
    marginTop: 12,
    gap: 10,
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  filterOptionItemActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#A855F7',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterOptionText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#334155',
  },
  filterOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  filterRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRadioOuterActive: {
    borderColor: '#7C3AED',
  },
  filterRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetFilterBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#EF4444',
  },
});
