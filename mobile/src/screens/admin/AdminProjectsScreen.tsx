import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Input } from '../../components/common/Input';
import { FormModal } from '../../components/common/FormModal';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { DeleteConfirmationModal } from '../../components/common/DeleteConfirmationModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { projectsApi } from '../../api/projectsApi';
import { Project } from '../../types';

export const AdminProjectsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Delete Project Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'NAME'>('NEWEST');

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempStatus, setTempStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(statusFilter);
  const [tempSort, setTempSort] = useState<'NEWEST' | 'NAME'>(sortOrder);

  const openFilterModal = () => {
    setTempStatus(statusFilter);
    setTempSort(sortOrder);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setStatusFilter(tempStatus);
    setSortOrder(tempSort);
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSortOrder('NEWEST');
  };

  const hasActiveFilters = statusFilter !== 'ALL' || sortOrder !== 'NEWEST';
  const activeFilterCount = (statusFilter !== 'ALL' ? 1 : 0) + (sortOrder !== 'NEWEST' ? 1 : 0);

  // Add / Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await projectsApi.getProjects();
      setProjects(data || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects(true);
  };

  const handleOpenCreate = () => {
    setEditingProject(null);
    setProjectName('');
    setProjectDescription('');
    setProjectStatus('ACTIVE');
    setModalVisible(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setProjectName(p.name);
    setProjectDescription(p.description || '');
    setProjectStatus(p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!projectName.trim()) {
      Alert.alert('Validation Error', 'Project name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProject) {
        await projectsApi.updateProject(editingProject.id, {
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          status: projectStatus,
        });
        Alert.alert('Success', 'Project updated successfully.');
      } else {
        await projectsApi.createProject({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          status: projectStatus,
        });
        Alert.alert('Success', 'Project created successfully.');
      }
      setModalVisible(false);
      fetchProjects(true);
    } catch (err: any) {
      Alert.alert('Operation Failed', err.message || 'Unable to save project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (p: Project) => {
    const nextStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await projectsApi.toggleStatus(p.id, nextStatus);
      fetchProjects(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update project status.');
    }
  };

  const handleDelete = (p: Project) => {
    setProjectToDelete(p);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeletingProject(true);
    try {
      await projectsApi.deleteProject(projectToDelete.id);
      setDeleteModalVisible(false);
      setProjectToDelete(null);
      fetchProjects(true);
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message || 'Unable to delete project.');
    } finally {
      setDeletingProject(false);
    }
  };

  const filteredProjects = useMemo(() => {
    let list = projects;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        return (
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
        );
      });
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((p) => (p.status || 'ACTIVE') === statusFilter);
    }

    if (sortOrder === 'NAME') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [projects, searchQuery, statusFilter, sortOrder]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '12 Sep 2024';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '12 Sep 2024';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '12 Sep 2024';
    }
  };

  const getProjectVisuals = (name: string, index: number) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('shop') || lower.includes('store') || lower.includes('grocery') || lower.includes('cart')) {
      return {
        icon: 'cart' as const,
        color: '#EC4899',
        gradient: ['#FFF1F2', '#FCE7F3'] as const,
      };
    }
    if (lower.includes('sea') || lower.includes('stat') || lower.includes('analytics') || lower.includes('metric')) {
      return {
        icon: 'stats-chart' as const,
        color: '#0284C7',
        gradient: ['#F0F9FF', '#E0F2FE'] as const,
      };
    }
    if (lower.includes('qmex') || lower.includes('web') || lower.includes('global') || lower.includes('site')) {
      return {
        icon: 'globe-outline' as const,
        color: '#6366F1',
        gradient: ['#EEF2FF', '#E0E7FF'] as const,
      };
    }
    const presets = [
      { icon: 'megaphone' as const, color: '#7C3AED', gradient: ['#F5F3FF', '#EDE9FE'] as const },
      { icon: 'cart' as const, color: '#EC4899', gradient: ['#FFF1F2', '#FCE7F3'] as const },
      { icon: 'stats-chart' as const, color: '#0284C7', gradient: ['#F0F9FF', '#E0F2FE'] as const },
      { icon: 'globe-outline' as const, color: '#6366F1', gradient: ['#EEF2FF', '#E0E7FF'] as const },
    ];
    return presets[index % presets.length];
  };

  const renderProjectCard = ({ item, index }: { item: Project; index: number }) => {
    const isActive = item.status === 'ACTIVE';
    const visuals = getProjectVisuals(item.name, index);
    const leadCount = item.assignedLeadsCount ?? item.totalLeads ?? 0;
    const formattedCreated = formatDate(item.createdAt);

    return (
      <View style={styles.projectCard}>
        {/* Top Info Row */}
        <TouchableOpacity
          style={styles.cardTopTouchable}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('Main' as any, {
              screen: 'Leads',
              params: {
                screen: 'LeadsList',
                params: { projectId: item.id, projectName: item.name },
              },
            } as any)
          }
        >
          {/* Icon Box */}
          <LinearGradient
            colors={visuals.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.projectIconBox}
          >
            <Ionicons name={visuals.icon} size={24} color={visuals.color} />
          </LinearGradient>

          {/* Project Details */}
          <View style={styles.projectInfoCol}>
            <Text style={styles.projectNameText} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.projectDescText} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}

            {/* Status & Created Date Row */}
            <View style={styles.metaRow}>
              <TouchableOpacity
                style={[
                  styles.statusBadge,
                  isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                ]}
                onPress={() => handleToggleStatus(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isActive ? '#16A34A' : '#DC2626' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isActive ? '#16A34A' : '#DC2626' },
                  ]}
                >
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </TouchableOpacity>

              <View style={styles.createdDateRow}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <Text style={styles.createdDateText}>
                  Created on {formattedCreated}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Chevron */}
          <View style={styles.chevronCol}>
            <Ionicons name="chevron-forward" size={18} color="#0F172A" />
          </View>
        </TouchableOpacity>

        {/* Bottom Actions Row */}
        <View style={styles.cardBottomRow}>
          {/* View Leads Pill */}
          <TouchableOpacity
            style={styles.viewLeadsPill}
            onPress={() =>
              navigation.navigate('Main' as any, {
                screen: 'Leads',
                params: {
                  screen: 'LeadsList',
                  params: { projectId: item.id, projectName: item.name },
                },
              } as any)
            }
            activeOpacity={0.75}
          >
            <Ionicons name="people" size={15} color="#4F46E5" />
            <Text style={styles.viewLeadsPillText}>View Leads ({leadCount})</Text>
            <Ionicons name="chevron-forward" size={13} color="#4F46E5" />
          </TouchableOpacity>

          {/* Edit & Delete Action Buttons */}
          <View style={styles.actionBtnGroup}>
            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={() => handleOpenEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={17} color="#3B82F6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={() => handleDelete(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <AmbientBackground variant="admin">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Custom Screen Header matching Reference Screenshot */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Project Management</Text>
            <Text style={styles.headerSubtitle}>
              Create campaigns, toggle active status & assign leads
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addCircularBtn}
            onPress={handleOpenCreate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#6366F1', '#9333EA', '#D946EF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addCircularGradient}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search projects..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Projects"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>PROJECT STATUS</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Projects' },
                  { id: 'ACTIVE', label: 'Active Projects' },
                  { id: 'INACTIVE', label: 'Inactive Projects' },
                ] as const
              ).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.filterChip,
                    tempStatus === s.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempStatus(s.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempStatus === s.id && styles.filterChipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort Order */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>SORT BY</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'NEWEST', label: 'Newest First' },
                  { id: 'NAME', label: 'Name (A – Z)' },
                ] as const
              ).map((so) => (
                <TouchableOpacity
                  key={so.id}
                  style={[
                    styles.filterChip,
                    tempSort === so.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempSort(so.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempSort === so.id && styles.filterChipTextActive,
                    ]}
                  >
                    {so.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FilterSheetModal>

        {/* Project List */}
        {loading && !refreshing ? (
          <LoadingState message="Loading projects..." fullScreen />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No Projects Found"
            message={
              searchQuery || hasActiveFilters
                ? 'No projects match your current search and filters.'
                : 'Create your first CRM project to start organizing leads.'
            }
            actionLabel={searchQuery || hasActiveFilters ? 'Reset Filters' : 'Create Project'}
            onAction={searchQuery || hasActiveFilters ? handleResetFilters : handleOpenCreate}
          />
        ) : (
          <FlatList
            data={filteredProjects}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderProjectCard}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
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

        {/* Add / Edit Project Modal */}
        <FormModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={editingProject ? 'Edit Project' : 'New CRM Project'}
          onSave={handleSubmit}
          saveTitle="Save"
          saveLoading={submitting}
          saveVariant="primary"
          heightPercent={0.82}
          maxHeightPixels={580}
        >
          <Input
            label="Project Name *"
            placeholder="e.g. Prestige Heights Phase 2"
            value={projectName}
            onChangeText={setProjectName}
          />

          <Input
            label="Description (Optional)"
            placeholder="Campaign objective or property details"
            value={projectDescription}
            onChangeText={setProjectDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.statusToggleContainer}>
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  projectStatus === 'ACTIVE' && styles.statusOptionActive,
                ]}
                onPress={() => setProjectStatus('ACTIVE')}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    projectStatus === 'ACTIVE' && styles.statusOptionTextActive,
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  projectStatus === 'INACTIVE' && styles.statusOptionActive,
                ]}
                onPress={() => setProjectStatus('INACTIVE')}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    projectStatus === 'INACTIVE' && styles.statusOptionTextActive,
                  ]}
                >
                  Inactive
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </FormModal>

        {/* Typed Delete Project Confirmation Modal */}
        <DeleteConfirmationModal
          visible={deleteModalVisible}
          onClose={() => {
            if (!deletingProject) {
              setDeleteModalVisible(false);
              setProjectToDelete(null);
            }
          }}
          onConfirm={handleConfirmDeleteProject}
          title="Delete Project?"
          itemName={projectToDelete?.name}
          description={`Are you sure you want to permanently delete project "${projectToDelete?.name || ''}"? All leads, calls, and activities in this project will be deleted.`}
          confirmKeyword="DELETE"
          loading={deletingProject}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  addCircularBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addCircularGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 110,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  projectIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  projectInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  projectNameText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  projectDescText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  createdDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createdDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  chevronCol: {
    paddingLeft: 6,
    paddingTop: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewLeadsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 7.5,
    borderRadius: 12,
  },
  viewLeadsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
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
