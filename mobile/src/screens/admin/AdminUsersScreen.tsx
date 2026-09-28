import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Button } from '../../components/common/Button';
import { FormModal } from '../../components/common/FormModal';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { DeleteConfirmationModal } from '../../components/common/DeleteConfirmationModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { usersApi } from '../../api/usersApi';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types';

export const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const { showSuccess, showError, showInfo, showWarning } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Delete User Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ROLE_ADMIN' | 'ROLE_USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempRole, setTempRole] = useState<'ALL' | 'ROLE_ADMIN' | 'ROLE_USER'>(roleFilter);
  const [tempStatus, setTempStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(statusFilter);
  const [tempShift, setTempShift] = useState<string>(shiftFilter);

  const openFilterModal = () => {
    setTempRole(roleFilter);
    setTempStatus(statusFilter);
    setTempShift(shiftFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setRoleFilter(tempRole);
    setStatusFilter(tempStatus);
    setShiftFilter(tempShift);
  };

  const handleResetFilters = () => {
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setShiftFilter('ALL');
  };

  const hasActiveFilters = roleFilter !== 'ALL' || statusFilter !== 'ALL' || shiftFilter !== 'ALL';
  const activeFilterCount = (roleFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0) + (shiftFilter !== 'ALL' ? 1 : 0);

  // Create Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ROLE_USER' | 'ROLE_ADMIN'>('ROLE_USER');
  const [newShift, setNewShift] = useState<string>('SHIFT_1000_1900');
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'ROLE_USER' | 'ROLE_ADMIN'>('ROLE_USER');
  const [editShift, setEditShift] = useState<string>('SHIFT_1000_1900');

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await usersApi.getUsers({
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        search: searchQuery.trim() || undefined,
        size: 50,
      });
      let list = res.content || [];
      if (statusFilter !== 'ALL') {
        list = list.filter((u) => u.status === statusFilter);
      }
      if (shiftFilter !== 'ALL') {
        list = list.filter((u) => u.shift === shiftFilter);
      }
      setUsers(list);
    } catch (err: any) {
      showError('Failed to Fetch Users', err.message || 'Unable to retrieve user list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter, shiftFilter, searchQuery, showError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers(true);
  };

  const handleOpenCreate = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
    setNewRole('ROLE_USER');
    setNewShift('SHIFT_1000_1900');
    setCreateModalVisible(true);
  };

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      showWarning('Required Fields', 'Name, email, and password are required.');
      return;
    }
    if (newPassword.length < 6) {
      showWarning('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.createUser({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        phone: newPhone.trim() || undefined,
        password: newPassword,
        role: newRole,
        shift: newShift,
      });
      showSuccess('User Created', `User "${newName.trim()}" was created successfully.`);
      setCreateModalVisible(false);
      fetchUsers(true);
    } catch (err: any) {
      showError('Create User Failed', err.message || 'Unable to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPhone(user.phone || '');
    setEditRole(user.role === 'ROLE_ADMIN' ? 'ROLE_ADMIN' : 'ROLE_USER');
    setEditShift(user.shift || 'SHIFT_1000_1900');
    setEditModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editName.trim()) {
      showWarning('Validation Error', 'User name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.updateUser(editingUser.id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        role: editRole,
        shift: editShift,
      });
      showSuccess('Profile Updated', `User "${editName.trim()}" profile updated.`);
      setEditModalVisible(false);
      fetchUsers(true);
    } catch (err: any) {
      showError('Update Failed', err.message || 'Unable to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.toggleStatus(user.id, nextStatus);
      showInfo('Status Changed', `User "${user.name}" is now ${nextStatus.toLowerCase()}.`);
      fetchUsers(true);
    } catch (err: any) {
      showError('Status Update Failed', err.message || 'Failed to update user status.');
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const targetName = userToDelete.name;
    setDeletingUser(true);
    try {
      const responseMessage = await usersApi.deleteUser(userToDelete.id);
      setDeleteModalVisible(false);
      setUserToDelete(null);
      fetchUsers(true);
      showSuccess(
        'User Deleted',
        responseMessage || `User "${targetName}" was permanently removed.`
      );
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Unable to delete user.');
    } finally {
      setDeletingUser(false);
    }
  };

  const renderUserCard = ({ item }: { item: User }) => {
    const isActive = item.status === 'ACTIVE';
    const isAdmin = item.role === 'ROLE_ADMIN';

    return (
      <Card style={styles.userCard}>
        <TouchableOpacity
          style={styles.userCardTop}
          onPress={() => navigation.navigate('AttendanceHistory', { userId: item.id, userName: item.name })}
          activeOpacity={0.7}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.roleBadge,
                  isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser,
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    isAdmin ? styles.roleTextAdmin : styles.roleTextUser,
                  ]}
                >
                  {isAdmin ? 'ADMIN' : 'USER'}
                </Text>
              </View>
            </View>

            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
            {item.phone ? (
              <Text style={styles.userPhone} numberOfLines={1}>
                {item.phone}
              </Text>
            ) : null}

            <View style={styles.shiftBadge}>
              <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.shiftBadgeText}>{item.shiftDisplayName || '10:00 AM – 07:00 PM'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ alignSelf: 'center', marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.userCardFooter}>
          <TouchableOpacity
            style={[
              styles.statusToggleBtn,
              isActive ? styles.statusBtnActive : styles.statusBtnInactive,
            ]}
            onPress={() => handleToggleStatus(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={isActive ? '#10b981' : '#ef4444'}
            />
            <Text
              style={[
                styles.statusToggleText,
                { color: isActive ? '#10b981' : '#ef4444' },
              ]}
            >
              {item.status}
            </Text>
          </TouchableOpacity>

          <View style={styles.userActionBtns}>
            <TouchableOpacity
              style={styles.attendanceBtn}
              onPress={() => navigation.navigate('AttendanceHistory', { userId: item.id, userName: item.name })}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <Text style={styles.attendanceBtnText}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleOpenEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteUserBtn}
              onPress={() => handleDeleteUser(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={13} color={colors.danger} />
              <Text style={styles.deleteUserBtnText}>Delete</Text>
            </TouchableOpacity>
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
          title="User Management"
          subtitle="Manage employees, admin privileges & permissions"
          onBack={() => navigation.goBack()}
          rightElement={
            <TouchableOpacity
              style={styles.addUserHeaderBtn}
              onPress={handleOpenCreate}
              activeOpacity={0.7}
            >
              <GradientView
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addUserGradient}
              >
                <Ionicons name="person-add" size={16} color="#ffffff" />
              </GradientView>
            </TouchableOpacity>
          }
        />

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search users by name, email, phone..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Users"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Role Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>USER ROLE</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Roles' },
                  { id: 'ROLE_USER', label: 'Sales Agents' },
                  { id: 'ROLE_ADMIN', label: 'Administrators' },
                ] as const
              ).map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.filterChip,
                    tempRole === r.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempRole(r.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempRole === r.id && styles.filterChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>ACCOUNT STATUS</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Status' },
                  { id: 'ACTIVE', label: 'Active Users' },
                  { id: 'INACTIVE', label: 'Inactive Users' },
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

          {/* Shift Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>WORKING SHIFT</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Shifts' },
                  { id: 'SHIFT_1000_1900', label: '10:00 AM – 07:00 PM' },
                  { id: 'SHIFT_0900_1800', label: '09:00 AM – 06:00 PM' },
                ] as const
              ).map((sh) => (
                <TouchableOpacity
                  key={sh.id}
                  style={[
                    styles.filterChip,
                    tempShift === sh.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempShift(sh.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempShift === sh.id && styles.filterChipTextActive,
                    ]}
                  >
                    {sh.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FilterSheetModal>

      {loading && !refreshing ? (
        <LoadingState message="Loading users..." fullScreen />
      ) : users.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Users Found"
          message="Create a user to give team members access to the CRM."
          actionLabel="Add User"
          onAction={handleOpenCreate}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUserCard}
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

      {/* Add User Modal */}
      <FormModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title="Add New User"
        onSave={handleCreateUser}
        saveTitle="Save"
        saveLoading={submitting}
        saveVariant="primary"
        heightPercent={0.82}
        maxHeightPixels={580}
      >
        <Input
          label="Full Name *"
          placeholder="e.g. Rahul Sharma"
          value={newName}
          onChangeText={setNewName}
        />

        <Input
          label="Email Address *"
          placeholder="rahul@crm.com"
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Phone Number"
          placeholder="+91 98765 43210"
          value={newPhone}
          onChangeText={setNewPhone}
          keyboardType="phone-pad"
        />

        <Input
          label="Initial Password *"
          placeholder="At least 6 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          isPassword
        />

        <View style={styles.rolePickerContainer}>
          <Text style={styles.fieldLabel}>Role *</Text>
          <View style={styles.rolePickerRow}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                newRole === 'ROLE_USER' && styles.roleOptionActive,
              ]}
              onPress={() => setNewRole('ROLE_USER')}
            >
              <Ionicons
                name="person"
                size={14}
                color={newRole === 'ROLE_USER' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  newRole === 'ROLE_USER' && styles.roleOptionTextActive,
                ]}
              >
                User (Sales Agent)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleOption,
                newRole === 'ROLE_ADMIN' && styles.roleOptionActive,
              ]}
              onPress={() => setNewRole('ROLE_ADMIN')}
            >
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={newRole === 'ROLE_ADMIN' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  newRole === 'ROLE_ADMIN' && styles.roleOptionTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rolePickerContainer}>
          <Text style={styles.fieldLabel}>Work Shift *</Text>
          <View style={styles.shiftPickerColumn}>
            {[
              { id: 'SHIFT_1000_1900', label: '10:00 AM – 07:00 PM (Default)' },
              { id: 'SHIFT_0900_1800', label: '09:00 AM – 06:00 PM' },
              { id: 'SHIFT_0930_1830', label: '09:30 AM – 06:30 PM' },
            ].map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.shiftOption,
                  newShift === s.id && styles.roleOptionActive,
                ]}
                onPress={() => setNewShift(s.id)}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={newShift === s.id ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    newShift === s.id && styles.roleOptionTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </FormModal>

      {/* Edit User Modal */}
      <FormModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit User Profile"
        onSave={handleUpdateUser}
        saveTitle="Save"
        saveLoading={submitting}
        saveVariant="primary"
        heightPercent={0.88}
        maxHeightPixels={620}
      >
        <Input
          label="Full Name *"
          value={editName}
          onChangeText={setEditName}
        />

        <Input
          label="Phone Number"
          value={editPhone}
          onChangeText={setEditPhone}
          keyboardType="phone-pad"
        />

        <View style={styles.rolePickerContainer}>
          <Text style={styles.fieldLabel}>Role *</Text>
          <View style={styles.rolePickerRow}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                editRole === 'ROLE_USER' && styles.roleOptionActive,
              ]}
              onPress={() => setEditRole('ROLE_USER')}
            >
              <Ionicons
                name="person"
                size={14}
                color={editRole === 'ROLE_USER' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  editRole === 'ROLE_USER' && styles.roleOptionTextActive,
                ]}
              >
                User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleOption,
                editRole === 'ROLE_ADMIN' && styles.roleOptionActive,
              ]}
              onPress={() => setEditRole('ROLE_ADMIN')}
            >
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={editRole === 'ROLE_ADMIN' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  editRole === 'ROLE_ADMIN' && styles.roleOptionTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rolePickerContainer}>
          <Text style={styles.fieldLabel}>Work Shift *</Text>
          <View style={styles.shiftPickerColumn}>
            {[
              { id: 'SHIFT_1000_1900', label: '10:00 AM – 07:00 PM' },
              { id: 'SHIFT_0900_1800', label: '09:00 AM – 06:00 PM' },
              { id: 'SHIFT_0930_1830', label: '09:30 AM – 06:30 PM' },
            ].map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.shiftOption,
                  editShift === s.id && styles.roleOptionActive,
                ]}
                onPress={() => setEditShift(s.id)}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={editShift === s.id ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    editShift === s.id && styles.roleOptionTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </FormModal>

      {/* Typed Delete User Confirmation Modal */}
      <DeleteConfirmationModal
        visible={deleteModalVisible}
        onClose={() => {
          if (!deletingUser) {
            setDeleteModalVisible(false);
            setUserToDelete(null);
          }
        }}
        onConfirm={handleConfirmDeleteUser}
        title="Delete User Account?"
        itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : undefined}
        description={`Are you sure you want to permanently delete user "${userToDelete?.name || ''}"? This action cannot be undone.`}
        confirmKeyword="DELETE"
        loading={deletingUser}
      />
    </SafeAreaView>
  </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addUserHeaderBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addUserGradient: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePillActive: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rolePillTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  userCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  roleBadgeUser: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  roleTextAdmin: {
    color: colors.primary,
  },
  roleTextUser: {
    color: colors.success,
  },
  userEmail: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  userPhone: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statusToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attendanceBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteUserBtnText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '600',
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
    maxWidth: 440,
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
  rolePickerContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  shiftPickerColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  shiftOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
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
