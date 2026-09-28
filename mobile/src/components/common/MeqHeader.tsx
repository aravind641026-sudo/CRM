import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

interface MeqHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showAdminBadge?: boolean;
  onBack?: () => void;
  rightMode?: 'none' | 'home' | 'settings' | 'custom' | 'date';
  rightElement?: React.ReactNode;
  dateText?: string;
  onPressBell?: () => void;
  onPressAvatar?: () => void;
  hasUnreadNotifications?: boolean;
  avatarInitial?: string;
}

export const MeqHeader: React.FC<MeqHeaderProps> = ({
  title,
  subtitle,
  showLogo = true,
  showAdminBadge,
  onBack,
  rightMode = 'home',
  rightElement,
  dateText,
  onPressBell,
  onPressAvatar,
  hasUnreadNotifications = false,
  avatarInitial = 'A',
}) => {
  const { isAdmin } = useAuth();
  const shouldShowAdmin = showAdminBadge !== undefined ? showAdminBadge : isAdmin;

  return (
    <View style={styles.headerContainer}>
      {/* Left Section: Back button or QMAX Logo */}
      <View style={styles.leftSection}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : showLogo ? (
          <View style={styles.headerLogoContainer}>
            <Image
              source={require('../../../assets/qmex-logo.png')}
              style={styles.headerLogoImage}
              resizeMode="contain"
            />
            {shouldShowAdmin && (
              <View style={styles.adminBadge}>
                <LinearGradient
                  colors={['#7C3AED', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.adminBadgeGradient}
                >
                  <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        ) : null}

        {/* Center / Left Title */}
        {title ? (
          <View style={styles.titleCol}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Right Section */}
      <View style={styles.rightSection}>
        {rightElement ? (
          rightElement
        ) : rightMode === 'date' && dateText ? (
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color={colors.primaryElectric} />
            <Text style={styles.dateBadgeText}>{dateText}</Text>
          </View>
        ) : rightMode === 'home' ? (
          <View style={styles.actionGroup}>
            {/* Notification Bell with Badge */}
            {onPressBell && (
              <TouchableOpacity
                style={styles.iconCircleButton}
                activeOpacity={0.75}
                onPress={onPressBell}
              >
                <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
                {hasUnreadNotifications && <View style={styles.notificationDot} />}
              </TouchableOpacity>
            )}

            {/* User Avatar Circle */}
            {onPressAvatar && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPressAvatar}
                style={styles.avatarButton}
              >
                <LinearGradient
                  colors={colors.avatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerLogoContainer: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoImage: {
    width: 90,
    height: 36,
  },
  adminBadge: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  adminBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  adminBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  titleCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarButton: {
    borderRadius: 19,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryViolet,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryElectric,
  },
});
