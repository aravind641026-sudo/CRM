import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { salesApi } from '../../api/salesApi';
import { Sale, RootStackParamList } from '../../types';

export const ConvertedLeadsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter States
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedAgent, setSelectedAgent] = useState<string>('ALL');
  const [dealRange, setDealRange] = useState<'ALL' | 'UNDER_50K' | '50K_TO_2L' | 'OVER_2L'>('ALL');
  const [datePeriod, setDatePeriod] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');

  // Filter Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempProject, setTempProject] = useState<string>(selectedProject);
  const [tempAgent, setTempAgent] = useState<string>(selectedAgent);
  const [tempDealRange, setTempDealRange] = useState(dealRange);
  const [tempDatePeriod, setTempDatePeriod] = useState(datePeriod);

  const openFilterModal = () => {
    setTempProject(selectedProject);
    setTempAgent(selectedAgent);
    setTempDealRange(dealRange);
    setTempDatePeriod(datePeriod);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setSelectedProject(tempProject);
    setSelectedAgent(tempAgent);
    setDealRange(tempDealRange);
    setDatePeriod(tempDatePeriod);
  };

  const handleResetFilters = () => {
    setSelectedProject('ALL');
    setSelectedAgent('ALL');
    setDealRange('ALL');
    setDatePeriod('ALL');
  };

  const hasActiveFilters =
    selectedProject !== 'ALL' ||
    selectedAgent !== 'ALL' ||
    dealRange !== 'ALL' ||
    datePeriod !== 'ALL';

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProject !== 'ALL') count++;
    if (selectedAgent !== 'ALL') count++;
    if (dealRange !== 'ALL') count++;
    if (datePeriod !== 'ALL') count++;
    return count;
  }, [selectedProject, selectedAgent, dealRange, datePeriod]);

  // Unique Projects & Agents extracted from loaded sales
  const uniqueProjects = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.projectName) set.add(s.projectName);
    });
    return Array.from(set);
  }, [sales]);

  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      const name = s.assignedAgentName || s.userName;
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [sales]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await salesApi.getAllSales();
      setSales(data || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load converted leads.');
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

  const filteredSales = useMemo(() => {
    let list = sales;
    const now = new Date();

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const leadName = (s.leadName || '').toLowerCase();
        const phone = (s.leadPhone || '').toLowerCase();
        const project = (s.projectName || '').toLowerCase();
        const agent = (s.assignedAgentName || s.userName || '').toLowerCase();
        const id = String(s.leadId || s.id);
        return (
          leadName.includes(q) ||
          phone.includes(q) ||
          project.includes(q) ||
          agent.includes(q) ||
          id.includes(q)
        );
      });
    }

    // 2. Project Filter
    if (selectedProject !== 'ALL') {
      list = list.filter((s) => s.projectName === selectedProject);
    }

    // 3. Agent Filter
    if (selectedAgent !== 'ALL') {
      list = list.filter((s) => (s.assignedAgentName || s.userName) === selectedAgent);
    }

    // 4. Deal Value Filter
    if (dealRange === 'UNDER_50K') {
      list = list.filter((s) => (Number(s.dealValue) || 0) < 50000);
    } else if (dealRange === '50K_TO_2L') {
      list = list.filter((s) => {
        const val = Number(s.dealValue) || 0;
        return val >= 50000 && val <= 200000;
      });
    } else if (dealRange === 'OVER_2L') {
      list = list.filter((s) => (Number(s.dealValue) || 0) > 20000);
    }

    // 5. Date Period Filter
    if (datePeriod === 'TODAY') {
      const todayDateStr = now.toISOString().slice(0, 10);
      list = list.filter((s) => (s.convertedAt || s.createdAt || '').slice(0, 10) === todayDateStr);
    } else if (datePeriod === 'MONTH') {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      list = list.filter((s) => {
        const d = new Date(s.convertedAt || s.createdAt || '');
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    }

    return list;
  }, [sales, searchQuery, selectedProject, selectedAgent, dealRange, datePeriod]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (Number(s.dealValue) || 0), 0);
  }, [filteredSales]);

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoStr.slice(0, 16);
    }
  };

  const handleCall = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const renderItem = ({ item }: { item: Sale }) => {
    const agentName = item.assignedAgentName || item.userName || 'Assigned Agent';
    const agentInitial = (agentName[0] || 'A').toUpperCase();

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (item.leadId) {
            navigation.navigate('LeadDetails', {
              leadId: item.leadId,
              leadName: item.leadName,
            });
          }
        }}
      >
        <Card style={styles.card}>
          {/* Header Row: Lead Name + Status */}
          <View style={styles.cardHeader}>
            <View style={styles.leadInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.leadName}>{item.leadName || 'Converted Customer'}</Text>
                <Badge label="WON" status="CONVERTED" />
              </View>

              {item.projectName ? (
                <View style={styles.projectPill}>
                  <Ionicons name="folder-outline" size={12} color={colors.primary} />
                  <Text style={styles.projectText}>{item.projectName}</Text>
                </View>
              ) : null}
            </View>

            <Badge
              label={item.status || 'CONVERTED'}
              variant="success"
            />
          </View>

          {/* Contact & Deal Value Row */}
          <View style={styles.metricsRow}>
            {item.leadPhone ? (
              <TouchableOpacity
                style={styles.phoneBtn}
                onPress={() => handleCall(item.leadPhone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={12} color={colors.success} />
                <Text style={styles.phoneText}>{item.leadPhone}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.dealBadge}>
              <Text style={styles.dealLabel}>Deal Value</Text>
              <Text style={styles.dealValue}>{formatCurrency(Number(item.dealValue) || 0)}</Text>
            </View>
          </View>

          {/* Notes Preview if available */}
          {item.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          ) : null}

          {/* Footer: Agent info + Timestamp */}
          <View style={styles.cardFooter}>
            <View style={styles.agentRow}>
              <View style={styles.agentAvatar}>
                <Text style={styles.agentInitial}>{agentInitial}</Text>
              </View>
              <View>
                <Text style={styles.agentLabel}>Closed By</Text>
                <Text style={styles.agentName}>{agentName}</Text>
              </View>
            </View>

            <View style={styles.timeCol}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.timeText}>{formatDateTime(item.convertedAt || item.createdAt)}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <MeqHeader
          showLogo={false}
          title="Converted Leads"
          subtitle={`${sales.length} Closed Deals Won`}
          onBack={() => navigation.goBack()}
        />

        {/* KPI Stats Ribbon */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Converted</Text>
            <Text style={styles.kpiValue}>{filteredSales.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Closed Value</Text>
            <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{formatCurrency(totalRevenue)}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Deal</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0)}
            </Text>
          </View>
        </View>

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search by name, phone, project, agent..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Converted Leads"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Period Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>DATE PERIOD</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Time' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'MONTH', label: 'This Month' },
                ] as const
              ).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.filterChip,
                    tempDatePeriod === p.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempDatePeriod(p.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempDatePeriod === p.id && styles.filterChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Deal Value Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>DEAL VALUE RANGE</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Values' },
                  { id: 'UNDER_50K', label: '< ₹50K' },
                  { id: '50K_TO_2L', label: '₹50K – ₹2 Lakhs' },
                  { id: 'OVER_2L', label: '> ₹2 Lakhs' },
                ] as const
              ).map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.filterChip,
                    tempDealRange === d.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempDealRange(d.id as any)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempDealRange === d.id && styles.filterChipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Project Filter */}
          {uniqueProjects.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterSectionTitle}>PROJECT</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    tempProject === 'ALL' && styles.filterChipActive,
                  ]}
                  onPress={() => setTempProject('ALL')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempProject === 'ALL' && styles.filterChipTextActive,
                    ]}
                  >
                    All Projects
                  </Text>
                </TouchableOpacity>
                {uniqueProjects.map((proj) => (
                  <TouchableOpacity
                    key={proj}
                    style={[
                      styles.filterChip,
                      tempProject === proj && styles.filterChipActive,
                    ]}
                    onPress={() => setTempProject(proj)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        tempProject === proj && styles.filterChipTextActive,
                      ]}
                    >
                      {proj}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Agent Filter */}
          {uniqueAgents.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterSectionTitle}>SALES AGENT</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    tempAgent === 'ALL' && styles.filterChipActive,
                  ]}
                  onPress={() => setTempAgent('ALL')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempAgent === 'ALL' && styles.filterChipTextActive,
                    ]}
                  >
                    All Agents
                  </Text>
                </TouchableOpacity>
                {uniqueAgents.map((agent) => (
                  <TouchableOpacity
                    key={agent}
                    style={[
                      styles.filterChip,
                      tempAgent === agent && styles.filterChipActive,
                    ]}
                    onPress={() => setTempAgent(agent)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        tempAgent === agent && styles.filterChipTextActive,
                      ]}
                    >
                      {agent}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </FilterSheetModal>

        {/* List Body */}
        {loading && !refreshing ? (
          <LoadingState message="Loading converted leads..." fullScreen />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} fullScreen />
        ) : (
          <FlatList
            data={filteredSales}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
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
            ListEmptyComponent={
              <EmptyState
                title={searchQuery || hasActiveFilters ? 'No matching leads' : 'No converted leads yet'}
                description={
                  searchQuery || hasActiveFilters
                    ? 'Try refining your search keyword or clearing the filters.'
                    : 'Leads converted into sales by your team will appear here.'
                }
                icon="trophy-outline"
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
  kpiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  idBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  idText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  projectText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  phoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  dealBadge: {
    alignItems: 'flex-end',
  },
  dealLabel: {
    fontSize: 9.5,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dealValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notesText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  agentLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '500',
  },
  agentName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
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
