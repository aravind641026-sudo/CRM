import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Linking,
  Alert,
  AppState,
  AppStateStatus,
  TextInput,
  Modal,
  Animated,
  Easing,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { DialPad } from '../../components/dial/DialPad';
import { CallWrapUpModal } from '../../components/dial/CallWrapUpModal';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { callApi } from '../../api/callApi';
import { usersApi } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { Call, User, RootStackParamList } from '../../types';
import { GroupedCallLog, groupCallsByPhoneNumber, isCallMissed } from '../../utils/callGrouping';

// Deterministic pastel avatar palette matching reference image
interface PastelStyle {
  bg: string;
  text: string;
  border: string;
}

const PASTEL_PALETTE: PastelStyle[] = [
  { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE' },
  { bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD' },
  { bg: '#FFE4E6', text: '#E11D48', border: '#FECDD3' },
  { bg: '#FEF9C3', text: '#CA8A04', border: '#FEF08A' },
  { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  { bg: '#FCE7F3', text: '#DB2777', border: '#FBCFE8' },
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  { bg: '#CFFAFE', text: '#0891B2', border: '#A5F3FC' },
];

const getPastelAvatarStyle = (text: string): PastelStyle => {
  if (!text) return PASTEL_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index];
};

type DateRangeOption = 'ALL' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const DialScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isAdmin } = useAuth();

  const [calls, setCalls] = useState<Call[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter System States
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [dateOption, setDateOption] = useState<DateRangeOption>('ALL');
  const [customFromDate, setCustomFromDate] = useState<string>(''); // YYYY-MM-DD
  const [customToDate, setCustomToDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // 'ALL' | 'PROSPECT' | 'CONNECTED' | 'JUNK' | 'MISSED'
  const [selectedUser, setSelectedUser] = useState<{ id?: number; name: string } | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);

  // Dial pad modal visibility
  const [dialPadModalVisible, setDialPadModalVisible] = useState(false);

  // Wrap up modal state
  const [wrapUpModalVisible, setWrapUpModalVisible] = useState(false);
  const [wrapUpCallData, setWrapUpCallData] = useState<{
    telephonyCallId: string;
    leadId?: number;
    leadName?: string;
    phoneNumber: string;
    durationSeconds: number;
  } | null>(null);

  // Animation values for subtle live glowing background
  const auraTranslate1 = useRef(new Animated.Value(0)).current;
  const auraTranslate2 = useRef(new Animated.Value(0)).current;
  const fabGlowAnim = useRef(new Animated.Value(1)).current;

  // Search Bar Hide on Scroll Down / Show on Scroll Up
  const searchBarAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden
  const lastScrollY = useRef(0);
  const isSearchBarHidden = useRef(false);

  const activeCallRef = useRef<{
    telephonyCallId: string;
    leadId?: number;
    leadName?: string;
    phoneNumber: string;
    startTime: number;
  } | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Setup subtle continuous background animations
  useEffect(() => {
    const aura1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraTranslate1, {
          toValue: 15,
          duration: 10000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraTranslate1, {
          toValue: -15,
          duration: 10000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const aura2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraTranslate2, {
          toValue: -20,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraTranslate2, {
          toValue: 20,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const fabLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabGlowAnim, {
          toValue: 1.05,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fabGlowAnim, {
          toValue: 0.98,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    aura1Loop.start();
    aura2Loop.start();
    fabLoop.start();

    return () => {
      aura1Loop.stop();
      aura2Loop.stop();
      fabLoop.stop();
    };
  }, [auraTranslate1, auraTranslate2, fabGlowAnim]);

  // AppState listener for in-call return detection -> opens wrap-up modal
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

        setWrapUpCallData({
          telephonyCallId: callData.telephonyCallId,
          leadId: callData.leadId,
          leadName: callData.leadName,
          phoneNumber: callData.phoneNumber,
          durationSeconds: elapsed,
        });
        setWrapUpModalVisible(true);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchCalls = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [res, activeUsers] = await Promise.all([
        callApi.getCalls({
          userId: isAdmin && selectedUser ? selectedUser.id : undefined,
          size: 150,
        }),
        usersApi.getActiveUsers().catch(() => []),
      ]);
      setCalls(res.content || []);
      if (activeUsers && activeUsers.length > 0) {
        setUsersList(activeUsers);
      }
    } catch (err: any) {
      console.warn('Failed to load calls:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, selectedUser]);

  useFocusEffect(
    useCallback(() => {
      const sf = route.params?.statusFilter;
      const dp = route.params?.datePreset;
      const cs = route.params?.customStartDate;
      const ce = route.params?.customEndDate;
      const fu = route.params?.filterUserId;

      if (sf !== undefined) {
        setSelectedStatus(sf);
      }
      if (dp !== undefined) {
        setDateOption(dp);
      }
      if (cs !== undefined) {
        setCustomFromDate(cs);
      }
      if (ce !== undefined) {
        setCustomToDate(ce);
      }
      if (fu !== undefined && usersList.length > 0) {
        const found = usersList.find((u) => u.id === fu);
        if (found) setSelectedUser({ id: found.id, name: found.name });
      }

      fetchCalls(true);
    }, [
      route.params?.statusFilter,
      route.params?.datePreset,
      route.params?.customStartDate,
      route.params?.customEndDate,
      route.params?.filterUserId,
      usersList,
      fetchCalls,
    ])
  );

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalls(true);
  };

  const handleStartCall = (phone: string, lead?: { id?: number; name?: string } | null) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone) {
      Alert.alert('Invalid Number', 'No valid phone number to dial.');
      return;
    }

    const telephonyCallId = `CALL_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    activeCallRef.current = {
      telephonyCallId,
      leadId: lead?.id,
      leadName: lead?.name,
      phoneNumber: cleanPhone,
      startTime: Date.now(),
    };

    callApi.sendCallEvent({
      eventType: 'CALL_INITIATED',
      telephonyCallId,
      leadId: lead?.id,
      customerPhone: cleanPhone,
    }).catch((err) => console.warn('Initiate call event failed:', err));

    const url = `tel:${cleanPhone}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        activeCallRef.current = null;
        Alert.alert('Dialer Unavailable', `Cannot dial ${cleanPhone} on this device.`);
      }
    });
  };

  // Format Date to match reference: "26 Sep, 12:08 PM"
  const formatCallDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const m = minutes.toString().padStart(2, '0');
      return `${day} ${month}, ${h12}:${m} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  // Check if any filter is active (to display indicator on Filter icon)
  const hasActiveFilters = useMemo(() => {
    const hasDate = dateOption !== 'ALL';
    const hasStatus = selectedStatus !== 'ALL';
    const hasUser = isAdmin && selectedUser !== null;
    return hasDate || hasStatus || hasUser;
  }, [dateOption, selectedStatus, selectedUser, isAdmin]);

  const resetAllFilters = () => {
    setDateOption('ALL');
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedStatus('ALL');
    setSelectedUser(null);
    setShowUserDropdown(false);
    setFilterModalVisible(false);
  };

  // Filtered raw individual calls (Used for grouping and calculations)
  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const rawStatus = (c.callStatus || '').toUpperCase();
      const duration = c.durationSeconds || 0;
      const isMissed = isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;

      // Classify into strictly 4 statuses matching AnalyticsScreen
      let callComputedStatus = 'CONNECTED';
      if (isMissed) {
        callComputedStatus = 'MISSED';
      } else if (rawStatus === 'PROSPECT' || duration > 300) {
        callComputedStatus = 'PROSPECT';
      } else if (rawStatus === 'JUNK' || duration < 30) {
        callComputedStatus = 'JUNK';
      } else {
        callComputedStatus = 'CONNECTED';
      }

      // 1. Call Status Filter
      if (selectedStatus !== 'ALL' && callComputedStatus !== selectedStatus) {
        return false;
      }

      // 2. Call User Filter (Admin only)
      if (isAdmin && selectedUser?.id != null && c.userId !== selectedUser.id) {
        return false;
      }

      // 3. Date Range Filter
      if (dateOption !== 'ALL') {
        const callTime = new Date(c.startTime || c.startedAt || c.createdAt || 0);
        const callYear = callTime.getFullYear();
        const callMonth = callTime.getMonth();
        const callDateNum = callTime.getDate();

        const now = new Date();
        const todayYear = now.getFullYear();
        const todayMonth = now.getMonth();
        const todayDateNum = now.getDate();

        if (dateOption === 'TODAY') {
          if (callYear !== todayYear || callMonth !== todayMonth || callDateNum !== todayDateNum) {
            return false;
          }
        } else if (dateOption === 'TOMORROW') {
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          if (
            callYear !== tomorrow.getFullYear() ||
            callMonth !== tomorrow.getMonth() ||
            callDateNum !== tomorrow.getDate()
          ) {
            return false;
          }
        } else if (dateOption === 'WEEK') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
          if (callTime < startOfWeek) return false;
        } else if (dateOption === 'MONTH') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          if (callTime < startOfMonth) return false;
        } else if (dateOption === 'CUSTOM') {
          const callTimestamp = callTime.getTime();
          if (customFromDate.trim()) {
            const fromTime = new Date(`${customFromDate.trim().slice(0, 10)}T00:00:00`).getTime();
            if (!isNaN(fromTime) && callTimestamp < fromTime) return false;
          }
          if (customToDate.trim()) {
            const toTime = new Date(`${customToDate.trim().slice(0, 10)}T23:59:59`).getTime();
            if (!isNaN(toTime) && callTimestamp > toTime) return false;
          }
        }
      }

      // 4. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (c.leadName || '').toLowerCase();
      const phone = (c.leadPhone || (c as any).phoneNumber || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [calls, dateOption, customFromDate, customToDate, selectedStatus, selectedUser, isAdmin, searchQuery]);

  // Grouped calls for UI display (1 clean row per normalized phone number)
  const groupedCalls = useMemo(() => {
    return groupCallsByPhoneNumber(filteredCalls);
  }, [filteredCalls]);

  // Scroll listener for Search Bar Hide on Scroll Down / Show on Scroll Up
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (currentY <= 5) {
      if (isSearchBarHidden.current) {
        isSearchBarHidden.current = false;
        Animated.timing(searchBarAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }
    } else if (diff > 12 && currentY > 30) {
      if (!isSearchBarHidden.current) {
        isSearchBarHidden.current = true;
        Animated.timing(searchBarAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }).start();
      }
    } else if (diff < -12) {
      if (isSearchBarHidden.current) {
        isSearchBarHidden.current = false;
        Animated.timing(searchBarAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }
    }
    lastScrollY.current = currentY;
  };

  const searchBarHeight = searchBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 0],
  });
  const searchBarOpacity = searchBarAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.2, 0],
  });
  const searchBarTranslateY = searchBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  const renderGroupedCallItem = ({ item }: { item: GroupedCallLog }) => {
    const latestCall = item.latestCall;
    const missed = item.hasMissed || isCallMissed(latestCall);
    const isIncoming = latestCall.callDirection === 'INBOUND' || latestCall.callStatus === 'INCOMING';

    let directionIcon: keyof typeof Ionicons.glyphMap = 'arrow-up';
    let directionColor = '#2563EB';
    let directionLabel = 'Outbound';

    if (missed) {
      directionIcon = 'close-circle';
      directionColor = '#DC2626';
      directionLabel = 'Missed';
    } else if (isIncoming) {
      directionIcon = 'arrow-down';
      directionColor = '#0284C7';
      directionLabel = 'Inbound';
    }

    const displayName = item.leadName || item.phoneNumber || 'Caller';
    const displayPhone = item.phoneNumber;
    const timestamp = formatCallDateTime(item.lastCallDate);

    const initialLetter = displayName ? displayName.charAt(0).toUpperCase() : 'C';
    const avatarPastel = getPastelAvatarStyle(displayName + displayPhone);

    // Strictly 4 Call Statuses from latest call: PROSPECT, CONNECTED, JUNK, MISSED
    let statusLabel = 'CONNECTED';
    let statusBg = '#DCFCE7';
    let statusColor = '#16A34A';

    const rawStatus = (latestCall.callStatus || '').toUpperCase();
    const duration = latestCall.durationSeconds || 0;

    if (missed || rawStatus === 'MISSED' || latestCall.isConnected === false) {
      statusLabel = 'MISSED';
      statusBg = '#FEE2E2';
      statusColor = '#EF4444';
    } else if (rawStatus === 'PROSPECT' || duration > 300) {
      statusLabel = 'PROSPECT';
      statusBg = '#EDE9FE';
      statusColor = '#7C3AED';
    } else if (rawStatus === 'JUNK' || duration < 30) {
      statusLabel = 'JUNK';
      statusBg = '#FFEDD5';
      statusColor = '#EA580C';
    } else {
      statusLabel = 'CONNECTED';
      statusBg = '#DCFCE7';
      statusColor = '#16A34A';
    }

    const hasCrmBadge = item.leadId != null || item.leadName != null;
    const callCountText = item.totalCalls > 1 ? `${item.totalCalls} calls` : null;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.callRow}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('CallHistoryDetail', {
            callId: latestCall.id,
            phoneNumber: displayPhone,
            leadId: item.leadId,
            leadName: item.leadName,
            groupedLog: item,
            call: latestCall,
          });
        }}
      >
        {/* Pastel Avatar */}
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: avatarPastel.bg, borderColor: avatarPastel.border },
          ]}
        >
          <Text style={[styles.avatarInitial, { color: avatarPastel.text }]}>
            {initialLetter}
          </Text>
        </View>

        {/* Center Info Column */}
        <View style={styles.callInfoColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.callerName} numberOfLines={1}>
              {displayName}
            </Text>
            {hasCrmBadge && (
              <View style={styles.crmPill}>
                <Text style={styles.crmPillText}>CRM</Text>
              </View>
            )}
          </View>

          <Text style={styles.callerPhone} numberOfLines={1}>
            {displayPhone}
          </Text>

          <View style={styles.metaRow}>
            {callCountText ? (
              <>
                <View style={styles.countBadgePill}>
                  <Text style={styles.countBadgeText}>{callCountText}</Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaTimestamp}>Last call {timestamp}</Text>
              </>
            ) : (
              <>
                <Ionicons name={directionIcon} size={13} color={directionColor} style={styles.directionIcon} />
                <Text style={[styles.directionText, { color: directionColor }]}>{directionLabel}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaTimestamp}>{timestamp}</Text>
              </>
            )}
          </View>
        </View>

        {/* Right Side: Status Badge + Direct Call Action Button */}
        <View style={styles.rightActionColumn}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.dialActionButton}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              handleStartCall(displayPhone, { id: item.leadId, name: item.leadName });
            }}
          >
            <Ionicons name="call" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenRoot}>
      {/* 1. SOFT LAVENDER / PASTEL GRADIENT BACKGROUND */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['#F9FAFE', '#F3F4FD', '#F6F3FE', '#FFFFFF']}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            styles.bgAuraPurpleTop,
            {
              transform: [
                { translateX: auraTranslate1 },
                { translateY: auraTranslate2 },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(216, 180, 254, 0.40)', 'rgba(244, 114, 182, 0.22)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.auraFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.bgAuraPurpleMid,
            {
              transform: [
                { translateX: auraTranslate2 },
                { translateY: auraTranslate1 },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(192, 132, 252, 0.28)', 'rgba(232, 121, 249, 0.16)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.auraFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.bgAuraSkyBottom,
            {
              transform: [{ translateX: auraTranslate1 }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(56, 189, 248, 0.20)', 'rgba(99, 102, 241, 0.12)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.auraFill}
          />
        </Animated.View>
      </View>

      {/* 2. FOREGROUND CONTENT */}
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {/* Top Header Bar with QMEX Logo & Optional Admin Badge */}
        <View style={styles.topHeaderBar}>
          <Image
            source={require('../../../assets/qmex-logo.png')}
            style={styles.headerLogoImage}
            resizeMode="contain"
          />
          {isAdmin && (
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

        {/* Animated Search Bar + Filter Button (Smoothly hides on scroll down) */}
        <Animated.View
          style={[
            styles.searchBarContainer,
            {
              height: searchBarHeight,
              opacity: searchBarOpacity,
              transform: [{ translateY: searchBarTranslateY }],
              overflow: 'hidden',
            },
          ]}
        >
          <View
            style={[
              styles.searchPillWrapper,
              isSearchFocused && styles.searchPillFocused,
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color="#94A3B8"
              style={styles.searchIcon}
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Search number or name..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />

            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
              >
                <Ionicons name="close-circle" size={17} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {/* Filter Button with Active Indicator */}
            <TouchableOpacity
              style={[
                styles.filterIconButton,
                hasActiveFilters && styles.filterIconButtonActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={hasActiveFilters ? '#7C3AED' : '#6B21A8'}
              />
              {hasActiveFilters && <View style={styles.filterActiveDot} />}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Active Filter Indicator Banner */}
        {(selectedStatus !== 'ALL' || dateOption !== 'ALL' || (isAdmin && selectedUser !== null)) && (
          <View style={styles.activeFilterPillRow}>
            <View style={styles.activeFilterPill}>
              <Ionicons
                name={
                  selectedStatus === 'PROSPECT'
                    ? 'star'
                    : selectedStatus === 'CONNECTED'
                    ? 'checkmark-circle'
                    : selectedStatus === 'JUNK'
                    ? 'time'
                    : selectedStatus === 'MISSED'
                    ? 'call'
                    : 'options'
                }
                size={14}
                color={
                  selectedStatus === 'PROSPECT'
                    ? '#8B5CF6'
                    : selectedStatus === 'CONNECTED'
                    ? '#10B981'
                    : selectedStatus === 'JUNK'
                    ? '#F97316'
                    : selectedStatus === 'MISSED'
                    ? '#EF4444'
                    : '#7C3AED'
                }
              />
              <Text style={styles.activeFilterPillText}>
                {selectedStatus !== 'ALL' ? `Filter: ${selectedStatus}` : 'Filtered'}
                {dateOption !== 'ALL' ? ` • ${dateOption === 'WEEK' ? 'This Week' : dateOption === 'MONTH' ? 'This Month' : dateOption}` : ''}
                {selectedUser ? ` • ${selectedUser.name}` : ''} ({groupedCalls.length} logs)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedStatus('ALL');
                  setDateOption('ALL');
                  setCustomFromDate('');
                  setCustomToDate('');
                  setSelectedUser(null);
                  fetchCalls(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.activeFilterClearBtn}
              >
                <Ionicons name="close-circle" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Grouped Call History List */}
        <View style={styles.listContainer}>
          {loading && !refreshing ? (
            <LoadingState message="Loading call history..." />
          ) : groupedCalls.length === 0 ? (
            <EmptyState
              icon="call-outline"
              title="No Calls Found"
              message={
                searchQuery || hasActiveFilters
                  ? 'No calls matching the selected filter criteria.'
                  : 'Your device and CRM call logs will appear here.'
              }
            />
          ) : (
            <FlatList
              data={groupedCalls}
              keyExtractor={(item) => item.id}
              renderItem={renderGroupedCallItem}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.callListContent,
                { paddingBottom: Math.max(insets.bottom, 16) + 160 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              showsVerticalScrollIndicator={true}
            />
          )}
        </View>

        {/* Modern Floating Action Button (FAB) for Manual Dialer - Elevated above floating tab bar */}
        <View style={[styles.fabAnchorContainer, { bottom: Math.max(insets.bottom, 16) + 88 }]}>
          <TouchableOpacity
            style={styles.fabButton}
            activeOpacity={0.85}
            onPress={() => setDialPadModalVisible(true)}
          >
            <LinearGradient
              colors={['#7C3AED', '#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Ionicons name="keypad" size={28} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* DialPad Modal Component: Positioned comfortably above navigation & home bar */}
        <Modal
          visible={dialPadModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDialPadModalVisible(false)}
        >
          <View style={styles.dialPadModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setDialPadModalVisible(false)}
            />
            <View style={[styles.dialPadModalCard, { paddingBottom: Math.max(insets.bottom, 28) + 20 }]}>
              <View style={styles.dialPadModalHeader}>
                <Text style={styles.dialPadModalTitle}>Direct Dial</Text>
                <TouchableOpacity
                  onPress={() => setDialPadModalVisible(false)}
                  style={styles.dialPadModalClose}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <DialPad
                initialNumber=""
                onOpenLeadDetails={(leadId, leadName) => {
                  setDialPadModalVisible(false);
                  navigation.navigate('LeadDetails', { leadId, leadName });
                }}
                onStartCall={handleStartCall}
              />
            </View>
          </View>
        </Modal>

        {/* Role-Based Filter Popup */}
        <Modal
          visible={filterModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.filterModalBackdrop}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          >
            <View style={styles.filterModalContent} onStartShouldSetResponder={() => true}>
              {/* Modal Header */}
              <View style={styles.filterModalHeader}>
                <View style={styles.filterModalTitleRow}>
                  <View style={styles.filterModalIconWrap}>
                    <Ionicons name="options" size={17} color="#7C3AED" />
                  </View>
                  <Text style={styles.filterModalTitle}>Filter Calls</Text>
                </View>
                <TouchableOpacity
                  style={styles.filterModalCloseBtn}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.filterModalScroll} showsVerticalScrollIndicator={false}>
                {/* 1. DATE RANGE (Radio Options: Today / Tomorrow / This Week / This Month / Custom) */}
                <Text style={styles.filterSectionTitle}>DATE RANGE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateRadioScrollContent}
                  style={styles.dateRadioScroll}
                >
                  {[
                    { id: 'TODAY' as const, label: 'Today' },
                    { id: 'TOMORROW' as const, label: 'Tomorrow' },
                    { id: 'WEEK' as const, label: 'This Week' },
                    { id: 'MONTH' as const, label: 'This Month' },
                    { id: 'CUSTOM' as const, label: 'Custom' },
                  ].map((opt) => {
                    const isSelected = dateOption === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.radioChoiceRow,
                          isSelected && styles.radioChoiceRowActive,
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setDateOption('ALL');
                          } else {
                            setDateOption(opt.id);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioDotInner} />}
                        </View>
                        <Text
                          style={[styles.radioLabelText, isSelected && styles.radioLabelTextActive]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Show Custom From/To Dates ONLY when "Custom" is selected */}
                {dateOption === 'CUSTOM' && (
                  <View style={styles.customDateRangeBox}>
                    <Text style={styles.dateFieldLabel}>From Date</Text>
                    <View style={styles.dateInputWrapper}>
                      <Ionicons name="calendar-outline" size={18} color="#6366F1" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="YYYY-MM-DD (e.g. 2026-09-26)"
                        placeholderTextColor="#94A3B8"
                        value={customFromDate}
                        onChangeText={setCustomFromDate}
                        maxLength={10}
                      />
                    </View>

                    <Text style={[styles.dateFieldLabel, { marginTop: 10 }]}>To Date</Text>
                    <View style={styles.dateInputWrapper}>
                      <Ionicons name="calendar-outline" size={18} color="#6366F1" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="YYYY-MM-DD (e.g. 2026-09-30)"
                        placeholderTextColor="#94A3B8"
                        value={customToDate}
                        onChangeText={setCustomToDate}
                        maxLength={10}
                      />
                    </View>
                  </View>
                )}

                {/* 2. CALL USER FILTER (ADMIN ONLY) */}
                {isAdmin && usersList.length > 0 && (
                  <View style={styles.adminUserFilterSection}>
                    <Text style={styles.filterSectionTitle}>CALL USER</Text>
                    <TouchableOpacity
                      style={[styles.userDropdownBtn, showUserDropdown && styles.userDropdownBtnActive]}
                      onPress={() => setShowUserDropdown(!showUserDropdown)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.userDropdownLeft}>
                        <Ionicons name="person-outline" size={16} color="#6366F1" style={{ marginRight: 8 }} />
                        <Text style={styles.userDropdownText}>
                          {selectedUser ? selectedUser.name : 'All Users'}
                        </Text>
                      </View>
                      <Ionicons
                        name={showUserDropdown ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#64748B"
                      />
                    </TouchableOpacity>

                    {showUserDropdown && (
                      <View style={styles.userDropdownList}>
                        <TouchableOpacity
                          style={[
                            styles.userDropdownItem,
                            selectedUser === null && styles.userDropdownItemActive,
                          ]}
                          onPress={() => {
                            setSelectedUser(null);
                            setShowUserDropdown(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.userDropdownItemText,
                              selectedUser === null && styles.userDropdownItemTextActive,
                            ]}
                          >
                            All Users
                          </Text>
                          {selectedUser === null && (
                            <Ionicons name="checkmark" size={15} color="#7C3AED" />
                          )}
                        </TouchableOpacity>

                        {usersList.map((u) => {
                          const isSel = selectedUser?.id === u.id;
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[
                                styles.userDropdownItem,
                                isSel && styles.userDropdownItemActive,
                              ]}
                              onPress={() => {
                                setSelectedUser({ id: u.id, name: u.name });
                                setShowUserDropdown(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.userDropdownItemText,
                                  isSel && styles.userDropdownItemTextActive,
                                ]}
                              >
                                {u.name}
                              </Text>
                              {isSel && (
                                <Ionicons name="checkmark" size={15} color="#7C3AED" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 3. CALL STATUS FILTER (Strictly 4 Statuses + All) */}
                <Text style={styles.filterSectionTitle}>CALL STATUS</Text>
                <View style={styles.statusChipsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.statusChipBase,
                      selectedStatus === 'ALL' && styles.statusChipAllActive,
                    ]}
                    onPress={() => setSelectedStatus('ALL')}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === 'ALL' && styles.statusChipTextAllActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusChipBase,
                      selectedStatus === 'PROSPECT' && styles.statusChipProspectActive,
                    ]}
                    onPress={() => setSelectedStatus(selectedStatus === 'PROSPECT' ? 'ALL' : 'PROSPECT')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#7C3AED' }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === 'PROSPECT' && styles.statusChipTextProspectActive,
                      ]}
                    >
                      PROSPECT
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusChipBase,
                      selectedStatus === 'CONNECTED' && styles.statusChipConnectedActive,
                    ]}
                    onPress={() => setSelectedStatus(selectedStatus === 'CONNECTED' ? 'ALL' : 'CONNECTED')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === 'CONNECTED' && styles.statusChipTextConnectedActive,
                      ]}
                    >
                      CONNECTED
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusChipBase,
                      selectedStatus === 'JUNK' && styles.statusChipJunkActive,
                    ]}
                    onPress={() => setSelectedStatus(selectedStatus === 'JUNK' ? 'ALL' : 'JUNK')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === 'JUNK' && styles.statusChipTextJunkActive,
                      ]}
                    >
                      JUNK
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusChipBase,
                      selectedStatus === 'MISSED' && styles.statusChipMissedActive,
                    ]}
                    onPress={() => setSelectedStatus(selectedStatus === 'MISSED' ? 'ALL' : 'MISSED')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        selectedStatus === 'MISSED' && styles.statusChipTextMissedActive,
                      ]}
                    >
                      MISSED
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={styles.filterModalFooter}>
                <TouchableOpacity
                  style={styles.filterClearBtn}
                  onPress={resetAllFilters}
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterClearBtnText}>Clear Filter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={() => setFilterModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.filterApplyGradient}
                  >
                    <Text style={styles.filterApplyBtnText}>Apply Filter</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Call Wrap-Up Confirmation Modal */}
        {wrapUpCallData && (
          <CallWrapUpModal
            visible={wrapUpModalVisible}
            leadId={wrapUpCallData.leadId}
            leadName={wrapUpCallData.leadName}
            phoneNumber={wrapUpCallData.phoneNumber}
            telephonyCallId={wrapUpCallData.telephonyCallId}
            initialDurationSeconds={wrapUpCallData.durationSeconds}
            onClose={() => {
              setWrapUpModalVisible(false);
              setWrapUpCallData(null);
              fetchCalls(true);
            }}
            onCompleted={(savedCall) => {
              setWrapUpModalVisible(false);
              setWrapUpCallData(null);
              fetchCalls(true);
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#F9FAFE',
    position: 'relative',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 10,
  },

  // Ambient Glow Auras
  bgAuraPurpleTop: {
    position: 'absolute',
    top: -30,
    right: -50,
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  bgAuraPurpleMid: {
    position: 'absolute',
    top: 260,
    right: -70,
    width: 290,
    height: 290,
    borderRadius: 145,
    overflow: 'hidden',
  },
  bgAuraSkyBottom: {
    position: 'absolute',
    bottom: 60,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  auraFill: {
    flex: 1,
  },

  // Top Header Bar
  topHeaderBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  headerLogoImage: {
    width: 95,
    height: 34,
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

  // Unified Search Bar Container
  searchBarContainer: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchPillWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchPillFocused: {
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
    marginRight: 4,
  },
  filterIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterIconButtonActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7C3AED',
  },

  // Full-Width Call List
  listContainer: {
    flex: 1,
    marginTop: 4,
  },
  callListContent: {
    paddingTop: 4,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    backgroundColor: 'transparent',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  callInfoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  crmPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  crmPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.4,
  },
  callerPhone: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  countBadgePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#C7D2FE',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  directionIcon: {
    marginRight: 3,
  },
  directionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 11,
    color: '#94A3B8',
    marginHorizontal: 5,
  },
  metaTimestamp: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  rightActionColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dialActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },

  // Floating Action Button (FAB) - Enlarged & elevated
  fabAnchorContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // DialPad Modal - Positioned with ample bottom padding
  dialPadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dialPadModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 22,
    maxHeight: '94%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  dialPadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dialPadModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dialPadModalClose: {
    padding: 4,
  },

  // Date Range Filter Modal
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    marginBottom: 14,
  },
  filterModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterModalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterModalCloseBtn: {
    padding: 4,
  },
  filterModalScroll: {
    maxHeight: 380,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },

  // Date Radio Options
  dateRadioScroll: {
    marginBottom: 12,
  },
  dateRadioScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 4,
  },
  radioChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 40,
  },
  radioChoiceRowActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#7C3AED',
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },
  radioLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  radioLabelTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Custom From / To Date inputs
  customDateRangeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  dateFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },

  // Admin User Filter
  adminUserFilterSection: {
    marginBottom: 14,
  },
  userDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userDropdownBtnActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  userDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDropdownText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  userDropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    paddingVertical: 4,
  },
  userDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userDropdownItemActive: {
    backgroundColor: '#F5F3FF',
  },
  userDropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  userDropdownItemTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Call Status Chips Grid
  statusChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusChipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  statusChipAllActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  statusChipProspectActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  statusChipConnectedActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
  },
  statusChipJunkActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F59E0B',
  },
  statusChipMissedActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusChipTextAllActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  statusChipTextProspectActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  statusChipTextConnectedActive: {
    color: '#059669',
    fontWeight: '800',
  },
  statusChipTextJunkActive: {
    color: '#D97706',
    fontWeight: '800',
  },
  statusChipTextMissedActive: {
    color: '#DC2626',
    fontWeight: '800',
  },

  // Modal Footer Actions
  filterModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterApplyBtn: {
    flex: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  filterApplyGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  activeFilterPillRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  activeFilterPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6D28D9',
  },
  activeFilterClearBtn: {
    marginLeft: 4,
  },
});
