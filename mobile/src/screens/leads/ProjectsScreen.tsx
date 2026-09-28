import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { MeqHeader } from '../../components/common/MeqHeader';
import { GradientView } from '../../components/common/GradientView';
import { IconTile } from '../../components/common/IconTile';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { AnimatedCard } from '../../components/common/AnimatedCard';
import { AnimatedProgressBar } from '../../components/common/AnimatedProgressBar';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { useAuth } from '../../context/AuthContext';
import { leadApi } from '../../api/leadApi';
import { Project, Lead } from '../../types';

const ICON_VARIANTS: Array<'blue' | 'purple' | 'orange' | 'green'> = [
  'blue',
  'purple',
  'orange',
  'green',
];

const PROJECT_ICONS = ['briefcase', 'business', 'cart', 'people'];

export const ProjectsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();

  // 0: Projects, 1: My Projects (Admin only)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Filters & Sorting state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME_ASC' | 'LEADS_DESC' | 'LEADS_ASC'>('NAME_ASC');
  const [tempStatus, setTempStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [tempSortBy, setTempSortBy] = useState<'NAME_ASC' | 'LEADS_DESC' | 'LEADS_ASC'>('NAME_ASC');

  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(56);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        if (isAdmin) {
          // Fetch active projects and current Admin's assigned leads in parallel
          const [activeProjRes, myLeadsRes] = await Promise.allSettled([
            leadApi.getActiveProjects(),
            leadApi.getLeads({ assignedToMe: true, size: 200 }),
          ]);

          if (activeProjRes.status === 'fulfilled') {
            setAllProjects(activeProjRes.value || []);
          }
          if (myLeadsRes.status === 'fulfilled') {
            setMyLeads(myLeadsRes.value.content || []);
          }
        } else {
          // User role: fetch active projects assigned to user
          const data = await leadApi.getActiveProjects();
          setAllProjects(data || []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load projects');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin]
  );

  useFocusEffect(
    useCallback(() => {
      setAnimKey((prev) => prev + 1);
      fetchData(true);
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Map of project ID to Admin's assigned lead count in that project
  const myAssignedLeadCountByProject = useMemo(() => {
    const map: Record<number, number> = {};
    myLeads.forEach((lead) => {
      if (lead.projectId) {
        map[lead.projectId] = (map[lead.projectId] || 0) + 1;
      }
    });
    return map;
  }, [myLeads]);

  // Lead count calculation for each project card
  const getLeadCountForProject = useCallback(
    (project: Project): number => {
      if (isAdmin && activeSegmentIndex === 1) {
        // In "My Projects" tab for Admin: return exact count of leads assigned to that Admin
        return myAssignedLeadCountByProject[project.id] ?? 0;
      }
      // In "Projects" tab for Admin or User: return project's total/assigned leads count
      return project.assignedLeadsCount ?? project.totalLeads ?? 0;
    },
    [isAdmin, activeSegmentIndex, myAssignedLeadCountByProject]
  );

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let list = [...allProjects];

    if (statusFilter !== 'ALL') {
      list = list.filter((p) => (statusFilter === 'ACTIVE' ? (p.status || 'ACTIVE') === 'ACTIVE' : p.status === 'INACTIVE'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (sortBy === 'NAME_ASC') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'LEADS_DESC') {
      list.sort((a, b) => getLeadCountForProject(b) - getLeadCountForProject(a));
    } else if (sortBy === 'LEADS_ASC') {
      list.sort((a, b) => getLeadCountForProject(a) - getLeadCountForProject(b));
    }

    return list;
  }, [allProjects, searchQuery, statusFilter, sortBy, getLeadCountForProject]);

  const hasActiveFilters = statusFilter !== 'ALL' || sortBy !== 'NAME_ASC';

  const openFilterModal = () => {
    setTempStatus(statusFilter);
    setTempSortBy(sortBy);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setStatusFilter(tempStatus);
    setSortBy(tempSortBy);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSortBy('NAME_ASC');
    setTempStatus('ALL');
    setTempSortBy('NAME_ASC');
    setFilterModalVisible(false);
  };

  const handleSelectProject = (project: Project) => {
    if (isAdmin && activeSegmentIndex === 1) {
      // In "My Projects" tab: open project leads with Admin's assigned leads filter
      navigation.navigate('LeadsList', {
        mode: 'MY_PROJECT_LEADS',
        projectId: project.id,
        projectName: project.name,
        assignedToMe: true,
      });
    } else {
      // In "Projects" tab: open project leads
      navigation.navigate('LeadsList', {
        mode: 'PROJECT',
        projectId: project.id,
        projectName: project.name,
        assignedToMe: !isAdmin,
      });
    }
  };

  const handlePressNew = () => {
    if (isAdmin) {
      navigation.navigate('AdminProjects');
    }
  };

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Top Header with "+ New" Gradient Pill Button (Admin only) */}
        <MeqHeader
          rightElement={
            isAdmin ? (
              <TouchableOpacity activeOpacity={0.8} onPress={handlePressNew}>
                <GradientView
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.newButton}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.newButtonText}>New</Text>
                </GradientView>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search projects..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={
              (statusFilter !== 'ALL' ? 1 : 0) + (sortBy !== 'NAME_ASC' ? 1 : 0)
            }
          />
        </Animated.View>

        <FlatList
          key={animKey}
          data={filteredProjects}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
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
          ListHeaderComponent={
            <View>
              {/* Screen Title Block */}
              <AnimatedCard delay={50} style={styles.titleSection}>
                <Text style={styles.screenHeading}>Leads</Text>
                <Text style={styles.screenSubheading}>
                  {isAdmin
                    ? activeSegmentIndex === 1
                      ? 'Projects with leads assigned to you'
                      : 'Manage assigned leads & campaign pipelines'
                    : 'Projects with your assigned leads'}
                </Text>
              </AnimatedCard>

              {/* Segmented Control Tabs (Admin: Projects | My Projects; User: No tabs) */}
              {isAdmin && (
                <AnimatedCard delay={100} style={styles.segmentWrapper}>
                  <SegmentedControl
                    tabs={['Projects', 'My Projects']}
                    selectedIndex={activeSegmentIndex}
                    onChange={(idx) => {
                      setActiveSegmentIndex(idx);
                    }}
                  />
                </AnimatedCard>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const variant = ICON_VARIANTS[index % ICON_VARIANTS.length];
            const iconName = PROJECT_ICONS[index % PROJECT_ICONS.length];
            const leadsCount = getLeadCountForProject(item);
            const progress = Math.min(100, leadsCount > 0 ? Math.round((leadsCount / 10) * 100) : 6);

            return (
              <AnimatedCard delay={220 + index * 50} style={styles.cardWrapper}>
                <TouchableOpacity
                  style={styles.projectCard}
                  activeOpacity={0.85}
                  onPress={() => handleSelectProject(item)}
                >
                  <View style={styles.cardHeader}>
                    <IconTile
                      name={iconName}
                      size={46}
                      iconSize={22}
                      variant={variant}
                    />

                    <View style={styles.projectInfo}>
                      <View style={styles.projectNameRow}>
                        <Text style={styles.projectName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.statusPill}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusPillText}>
                            {item.status || 'ACTIVE'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.projectSubtitle}>
                        {leadsCount} {leadsCount === 1 ? 'lead' : 'leads'}
                      </Text>

                      {/* Progress Bar under lead count matching reference image */}
                      <AnimatedProgressBar
                        percentage={progress}
                        height={5}
                        style={styles.cardProgressBar}
                      />
                    </View>
                  </View>

                  {/* View Link Arrow */}
                  <View style={styles.viewRow}>
                    <Text style={styles.viewText}>View</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </AnimatedCard>
            );
          }}
          ListEmptyComponent={
            loading && !refreshing ? (
              <LoadingState message="Loading projects..." />
            ) : error ? (
              <ErrorState message={error} onRetry={() => fetchData(true)} />
            ) : (
              <EmptyState
                icon="briefcase-outline"
                title={isAdmin && activeSegmentIndex === 1 ? 'No Assigned Leads' : 'No Projects Found'}
                description={
                  isAdmin && activeSegmentIndex === 1
                    ? 'You currently have no leads assigned to your account in any project.'
                    : 'No projects match your current search criteria.'
                }
              />
            )
          }
        />

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Projects"
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          applyText="Apply Filter"
          resetText="Clear / Reset"
        >
          {/* Status Section */}
          <View style={styles.sheetSection}>
            <Text style={styles.sheetSectionTitle}>STATUS</Text>
            <View style={styles.optionsWrap}>
              {[
                { key: 'ALL', label: 'All Projects' },
                { key: 'ACTIVE', label: 'Active' },
                { key: 'INACTIVE', label: 'Inactive' },
              ].map((opt) => {
                const isSel = tempStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sheetOptionChip, isSel && styles.sheetOptionChipActive]}
                    onPress={() => setTempStatus(opt.key as any)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.sheetOptionChipText,
                        isSel && styles.sheetOptionChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSel && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color="#7C3AED"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sort By Section */}
          <View style={styles.sheetSection}>
            <Text style={styles.sheetSectionTitle}>SORT BY</Text>
            <View style={styles.optionsWrap}>
              {[
                { key: 'NAME_ASC', label: 'Name (A to Z)' },
                { key: 'LEADS_DESC', label: 'Most Leads' },
                { key: 'LEADS_ASC', label: 'Fewest Leads' },
              ].map((opt) => {
                const isSel = tempSortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sheetOptionChip, isSel && styles.sheetOptionChipActive]}
                    onPress={() => setTempSortBy(opt.key as any)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.sheetOptionChipText,
                        isSel && styles.sheetOptionChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSel && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color="#7C3AED"
                        style={{ marginLeft: 4 }}
                      />
                    )}
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
    backgroundColor: colors.background,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenHeading: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenSubheading: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  segmentWrapper: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainerUser: {
    marginTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.9)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  projectInfo: {
    flex: 1,
    marginLeft: 14,
  },
  projectNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  projectSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  cardProgressBar: {
    marginTop: 8,
    width: '75%',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.3,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: -8,
  },
  viewText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  sheetSection: {
    gap: 8,
  },
  sheetSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  sheetOptionChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  sheetOptionChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  sheetOptionChipTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});
