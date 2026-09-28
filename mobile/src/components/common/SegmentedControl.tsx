import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

export interface SegmentOption<T extends string = string> {
  key: T;
  label: string;
  badge?: number | string;
}

interface SegmentedControlProps<T extends string = string> {
  options?: SegmentOption<T>[];
  selectedKey?: T;
  onSelect?: (key: T) => void;
  tabs?: string[];
  selectedIndex?: number;
  onChange?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

export const SegmentedControl = <T extends string = string>({
  options,
  selectedKey,
  onSelect,
  tabs,
  selectedIndex = 0,
  onChange,
  style,
}: SegmentedControlProps<T>) => {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Normalize options
  const normalizedOptions: { key: string; label: string; badge?: number | string }[] =
    options ||
    (tabs || []).map((t, idx) => ({
      key: idx.toString(),
      label: t,
    }));

  const activeIndex = options && selectedKey
    ? Math.max(0, options.findIndex((opt) => opt.key === selectedKey))
    : selectedIndex;

  const tabWidth = containerWidth > 0 && normalizedOptions.length > 0
    ? (containerWidth - 8) / normalizedOptions.length
    : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: activeIndex * tabWidth,
        friction: 7,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabWidth, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setContainerWidth(width);
  };

  const handlePress = (idx: number, key: string) => {
    if (onSelect) {
      onSelect(key as T);
    }
    if (onChange) {
      onChange(idx);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {/* Sliding Active Pill with Electric Blue -> Purple Gradient */}
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.activePillWrapper,
            {
              width: tabWidth,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={colors.primaryButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activePillGradient}
          />
        </Animated.View>
      )}

      {/* Tabs */}
      {normalizedOptions.map((option, idx) => {
        const isActive = idx === activeIndex;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.8}
            onPress={() => handlePress(idx, option.key)}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                isActive ? styles.tabTextActive : styles.tabTextInactive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {option.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    padding: 4,
    position: 'relative',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activePillWrapper: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 14,
    shadowColor: colors.primaryViolet,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  activePillGradient: {
    flex: 1,
    borderRadius: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    zIndex: 2,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  tabTextInactive: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  badge: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});
