import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { GradientView } from '../../components/common/GradientView';
import { MeqHeader } from '../../components/common/MeqHeader';
import { IconTile } from '../../components/common/IconTile';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { shiftApi } from '../../api/shiftApi';
import { ShiftChangeRequest, ShiftOption } from '../../types';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, logout, isAdmin, refreshProfile } = useAuth();

  // Account & Profile edit state
  const [showAccountProfile, setShowAccountProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Work Shift state
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftRequests, setShiftRequests] = useState<ShiftChangeRequest[]>([]);
  const [availableShifts, setAvailableShifts] = useState<ShiftOption[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('SHIFT_0930_1830');
  const [shiftReason, setShiftReason] = useState('');
  const [shiftSubmitting, setShiftSubmitting] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // About App info
  const [showAboutApp, setShowAboutApp] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
    }
  }, [user]);

  const loadShiftData = async () => {
    try {
      const [shifts, requests] = await Promise.all([
        shiftApi.getAvailableShifts(),
        shiftApi.getMyShiftRequests(),
      ]);
      setAvailableShifts(shifts || []);
      setShiftRequests(requests || []);
    } catch (e) {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadShiftData();
  }, []);

  const handleRequestShiftChange = async () => {
    if (!selectedShift) {
      Alert.alert('Validation Error', 'Please select a shift.');
      return;
    }

    setShiftSubmitting(true);
    try {
      await shiftApi.createShiftChangeRequest({
        requestedShift: selectedShift,
        reason: shiftReason.trim() || undefined,
      });
      Alert.alert('Success', 'Shift change request submitted for Admin approval.');
      setShiftReason('');
      setShowShiftForm(false);
      await loadShiftData();
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      Alert.alert('Request Failed', err.message || 'Unable to submit shift change request.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully.');
      setShowAccountProfile(false);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setShowAccountProfile(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Validation Error', 'Please enter your current and new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const msg = await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('Success', msg || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      Alert.alert('Password Change Failed', err.message || 'Unable to update password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const executeLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to sign out of your account?') : true;
      if (confirmed) {
        executeLogout();
      }
    } else {
      Alert.alert('Confirm Sign Out', 'Are you sure you want to sign out of your account?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: executeLogout,
        },
      ]);
    }
  };

  const roleLabel = isAdmin ? 'ADMIN' : 'AGENT';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'K';

  return (
    <AmbientBackground variant="settings">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Top Header: MEQ CRM Branding */}
        <MeqHeader onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <GradientView
              colors={colors.avatarGradient}
              style={styles.avatarLarge}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </GradientView>

            <View style={styles.profileDetails}>
              <Text style={styles.userName}>{user?.name || 'Kishore Kumar'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'kishore@qmex.com'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{roleLabel}</Text>
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.profileDivider} />

          <View style={styles.profileBottomRow}>
            <View style={styles.phoneGroup}>
              <Ionicons name="call-outline" size={15} color="#6B7280" />
              <Text style={styles.phoneText}>{user?.phone || 'No phone added'}</Text>
            </View>
            <View style={styles.verifiedGroup}>
              <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Settings Navigation Menu Card */}
        <View style={styles.menuCard}>
          {/* 1. Account & Profile (With Edit Form) */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowAccountProfile(!showAccountProfile)}
          >
            <IconTile name="person" variant="blue" size={38} iconSize={18} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Account & Profile</Text>
              <Text style={styles.menuSubtitle}>Personal details & edit profile</Text>
            </View>
            <Ionicons
              name={showAccountProfile ? 'chevron-up' : 'chevron-forward'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {showAccountProfile && (
            <View style={styles.embeddedForm}>
              <Input
                label="Full Name"
                placeholder="Enter full name"
                value={editName}
                onChangeText={setEditName}
                leftIcon="person-outline"
              />
              <Input
                label="Phone Number"
                placeholder="Enter phone number"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                leftIcon="call-outline"
              />
              <Input
                label="Email (Read-only)"
                value={user?.email || ''}
                editable={false}
                leftIcon="mail-outline"
              />
              <Input
                label="Role (Read-only)"
                value={roleLabel}
                editable={false}
                leftIcon="shield-outline"
              />
              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[styles.formBtn, styles.cancelBtn]}
                  onPress={handleCancelProfileEdit}
                  disabled={profileSaving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, styles.saveBtn, profileSaving && { opacity: 0.7 }]}
                  onPress={handleSaveProfile}
                  disabled={profileSaving}
                >
                  <Text style={styles.saveBtnText}>
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.menuDivider} />

          {/* 2. Work Shift */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowShiftForm(!showShiftForm)}
          >
            <IconTile name="time" variant="purple" size={38} iconSize={18} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Work Shift</Text>
              <Text style={styles.menuSubtitle}>{user?.shiftDisplayName || '10:00 AM – 07:00 PM'}</Text>
            </View>
            <Ionicons
              name={showShiftForm ? 'chevron-up' : 'chevron-forward'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {showShiftForm && (
            <View style={styles.embeddedForm}>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 }}>
                  Current Assigned Shift
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  {user?.shiftDisplayName || '10:00 AM – 07:00 PM'}
                </Text>
              </View>

              {shiftRequests.length > 0 && (
                <View style={{ marginBottom: 14, padding: 10, backgroundColor: colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>Latest Request Status:</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: shiftRequests[0].status === 'APPROVED' ? colors.success : shiftRequests[0].status === 'PENDING' ? '#eab308' : colors.danger, marginTop: 2 }}>
                    {shiftRequests[0].status === 'PENDING' ? 'Pending Admin Approval' : shiftRequests[0].status} ({shiftRequests[0].requestedShiftDisplayName})
                  </Text>
                </View>
              )}

              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>
                Select New Shift
              </Text>
              <View style={{ gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'SHIFT_1000_1900', label: '10:00 AM – 07:00 PM' },
                  { id: 'SHIFT_0900_1800', label: '09:00 AM – 06:00 PM' },
                  { id: 'SHIFT_0930_1830', label: '09:30 AM – 06:30 PM' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: selectedShift === s.id ? colors.primary : colors.border,
                    }}
                    onPress={() => setSelectedShift(s.id)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={selectedShift === s.id ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: selectedShift === s.id ? '700' : '500',
                        color: selectedShift === s.id ? colors.primary : colors.textSecondary,
                      }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Reason (Optional)"
                placeholder="Why are you requesting this shift change?"
                value={shiftReason}
                onChangeText={setShiftReason}
                multiline
              />

              <Button
                title={shiftRequests.some((r) => r.status === 'PENDING') ? 'Shift Change Request Pending' : 'Submit Shift Request'}
                onPress={handleRequestShiftChange}
                disabled={shiftSubmitting || shiftRequests.some((r) => r.status === 'PENDING')}
                loading={shiftSubmitting}
                variant="primary"
                size="sm"
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          <View style={styles.menuDivider} />

          {/* 3. Change Password */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowPasswordForm(!showPasswordForm)}
          >
            <IconTile name="key" variant="purple" size={38} iconSize={18} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Change Password</Text>
              <Text style={styles.menuSubtitle}>Update security credentials</Text>
            </View>
            <Ionicons
              name={showPasswordForm ? 'chevron-up' : 'chevron-forward'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {showPasswordForm && (
            <View style={styles.embeddedForm}>
              <Input
                label="Current Password"
                placeholder="••••••••"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                isPassword
                leftIcon="lock-closed-outline"
              />
              <Input
                label="New Password"
                placeholder="••••••••"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                leftIcon="lock-closed-outline"
              />
              <Input
                label="Confirm New Password"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                leftIcon="lock-closed-outline"
              />
              <Button
                title="Update Password"
                onPress={handleChangePassword}
                loading={passwordLoading}
                variant="primary"
                size="sm"
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          <View style={styles.menuDivider} />

          {/* 4. Notifications */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <IconTile name="notifications" variant="red" size={38} iconSize={18} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuSubtitle}>System alerts & reminders</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 5. About App */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowAboutApp(!showAboutApp)}
          >
            <IconTile name="information-circle" variant="purple" size={38} iconSize={18} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>About App</Text>
              <Text style={styles.menuSubtitle}>Version 2.4.0 • Active Session</Text>
            </View>
            <Ionicons
              name={showAboutApp ? 'chevron-up' : 'chevron-forward'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {showAboutApp && (
            <View style={styles.embeddedForm}>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Application</Text>
                <Text style={styles.infoValue}>Calling CRM Mobile v2.4.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Active Role</Text>
                <Text style={styles.infoValue}>
                  {isAdmin ? 'Administrator (Full Access)' : 'Agent (Employee)'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Authentication</Text>
                <Text style={styles.infoValue}>Spring Boot JWT (Secured)</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoKey}>Session Status</Text>
                <Text style={[styles.infoValue, { color: '#16A34A', fontWeight: '700' }]}>
                  Active & Verified
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Full-width Red Gradient Log Out Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleLogout}
          style={styles.logoutBtnContainer}
        >
          <GradientView
            colors={colors.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutGradientBtn}
          >
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </GradientView>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  userEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  rolePill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rolePillText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  profileBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  verifiedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  embeddedForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  formBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoKey: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logoutBtnContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  logoutGradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
