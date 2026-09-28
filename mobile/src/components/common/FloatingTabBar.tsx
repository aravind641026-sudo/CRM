import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Tab-specific gradient and accent configurations
const getTabGradients = (routeName: string): [string, string, ...string[]] => {
  if (routeName === 'Home' || routeName === 'AdminDashboard') {
    return ['#2563EB', '#7C3AED', '#C026D3'];
  }
  if (routeName === 'Leads') {
    return ['#1D4ED8', '#6366F1', '#9333EA'];
  }
  if (routeName === 'Dial') {
    return ['#0284C7', '#06B6D4', '#3B82F6'];
  }
  if (routeName === 'Analytics' || routeName === 'Reports') {
    return ['#7C3AED', '#C026D3', '#EC4899'];
  }
  if (routeName === 'AdminHub' || routeName === 'Settings') {
    return ['#4F46E5', '#7C3AED', '#C026D3'];
  }
  return ['#2563EB', '#7C3AED', '#C026D3'];
};

const getTabPrimaryColor = (routeName: string): string => {
  if (routeName === 'Home' || routeName === 'AdminDashboard') return '#2563EB';
  if (routeName === 'Leads') return '#1D4ED8';
  if (routeName === 'Dial') return '#0284C7';
  if (routeName === 'Analytics' || routeName === 'Reports') return '#7C3AED';
  if (routeName === 'AdminHub' || routeName === 'Settings') return '#4F46E5';
  return '#2563EB';
};

interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  labelText: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const TabItem: React.FC<TabItemProps> = ({
  routeName,
  isFocused,
  labelText,
  iconName,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}) => {
  const activeColor = getTabPrimaryColor(routeName);
  const activeGradients = getTabGradients(routeName);

  // Animation values
  const elevateAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const rippleScaleAnim = useRef(new Animated.Value(0)).current;
  const rippleOpacityAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    if (isFocused) {
      // Step 2 & 3: Icon rises smoothly with spring + sparkles settle
      Animated.parallel([
        Animated.spring(elevateAnim, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1.2,
            duration: 220,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Returns smoothly to baseline
      Animated.parallel([
        Animated.spring(elevateAnim, {
          toValue: 0,
          friction: 7,
          tension: 130,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused]);

  const triggerTouchFeedback = () => {
    // Step 1: Touch Ripple animation expanding outward
    rippleScaleAnim.setValue(0.3);
    rippleOpacityAnim.setValue(0.55);

    Animated.parallel([
      Animated.timing(rippleScaleAnim, {
        toValue: 1.6,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacityAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pressScaleAnim, {
          toValue: 0.92,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(pressScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handlePress = () => {
    triggerTouchFeedback();
    onPress();
  };

  // Interpolations for active item
  const iconTranslateY = elevateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const orbScale = elevateAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.5, 0.85, 1],
  });

  const orbOpacity = elevateAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.7, 1],
  });

  const normalIconOpacity = elevateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.2, 0],
  });

  const dotScale = elevateAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.tabContentContainer,
          { transform: [{ scale: pressScaleAnim }] },
        ]}
      >
        {/* Ripple effect overlay on touch */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rippleCircle,
            {
              backgroundColor: `${activeColor}22`,
              borderColor: `${activeColor}44`,
              opacity: rippleOpacityAnim,
              transform: [{ scale: rippleScaleAnim }],
            },
          ]}
        />

        {/* Elevated Floating Orb with Glow (Visible when active) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.elevatedOrbWrapper,
            {
              opacity: orbOpacity,
              transform: [
                { translateY: iconTranslateY },
                { scale: orbScale },
              ],
            },
          ]}
        >
          {/* Radiant Glow Behind the Orb */}
          <View
            style={[
              styles.orbRadiantGlow,
              {
                backgroundColor: activeColor,
                shadowColor: activeColor,
              },
            ]}
          />

          {/* Solid Gradient Orb */}
          <LinearGradient
            colors={activeGradients}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.elevatedOrbGradient}
          >
            <Ionicons name={iconName} size={22} color="#FFFFFF" />

            {/* Glossy top-rim highlight */}
            <View style={styles.orbGlossRim} />
          </LinearGradient>

          {/* Tiny Sparkle Particle on Top-Right */}
          <Animated.View
            style={[
              styles.sparkleParticleRight,
              {
                opacity: sparkleAnim,
                transform: [{ scale: sparkleAnim }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={10} color="#FDE047" />
          </Animated.View>

          {/* Tiny Sparkle Particle on Top-Left */}
          <Animated.View
            style={[
              styles.sparkleParticleLeft,
              {
                opacity: sparkleAnim,
                transform: [{ scale: sparkleAnim }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={7} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>

        {/* Inactive / Baseline Icon (Fades out when elevated) */}
        <Animated.View
          style={[
            styles.baselineIconWrapper,
            {
              opacity: normalIconOpacity,
            },
          ]}
        >
          <Ionicons
            name={iconName}
            size={22}
            color="#94A3B8"
          />
        </Animated.View>

        {/* Tab Label */}
        <Text
          style={[
            styles.tabLabel,
            isFocused ? [styles.activeLabel, { color: activeColor }] : styles.inactiveLabel,
          ]}
          numberOfLines={1}
        >
          {labelText}
        </Text>

        {/* Active Indicator Micro-Dot at bottom baseline */}
        <Animated.View
          style={[
            styles.activeIndicatorDot,
            {
              backgroundColor: activeColor,
              shadowColor: activeColor,
              opacity: dotScale,
              transform: [{ scale: dotScale }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

export const FloatingTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const totalTabs = state.routes.length;
  const tabWidth = containerWidth > 0 ? containerWidth / totalTabs : 0;

  // Fluid sliding blob animation values
  const blobPositionAnim = useRef(new Animated.Value(state.index)).current;
  const blobMorphScaleX = useRef(new Animated.Value(1)).current;
  const blobMorphScaleY = useRef(new Animated.Value(1)).current;

  // Track active route for gradient styling
  const activeRoute = state.routes[state.index]?.name || 'Home';
  const activeGradients = getTabGradients(activeRoute);
  const activeColor = getTabPrimaryColor(activeRoute);

  useEffect(() => {
    // Step 2 Slide: A gradient blob stretches and morphs smoothly between tabs
    Animated.parallel([
      Animated.spring(blobPositionAnim, {
        toValue: state.index,
        friction: 7,
        tension: 85,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(blobMorphScaleX, {
          toValue: 1.28,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(blobMorphScaleX, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(blobMorphScaleY, {
          toValue: 0.88,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.spring(blobMorphScaleY, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [state.index]);

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  const blobTranslateX = blobPositionAnim.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * tabWidth),
  });

  return (
    <View style={[styles.wrapper, { bottom: bottomInset }]}>
      {/* Outer Glow Halo */}
      <View
        style={[
          styles.outerHaloGlow,
          {
            shadowColor: activeColor,
          },
        ]}
      />

      <View style={styles.container} onLayout={handleContainerLayout}>
        {/* Step 2: Liquid morphing gradient blob sliding underneath active tab */}
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.liquidBlobWrapper,
              {
                width: tabWidth,
                transform: [
                  { translateX: blobTranslateX },
                  { scaleX: blobMorphScaleX },
                  { scaleY: blobMorphScaleY },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={activeGradients}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.liquidBlobGradient}
            />
          </Animated.View>
        )}

        {/* Tab Items */}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const labelText = typeof label === 'string' ? label : route.name;

          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'AdminDashboard') {
            iconName = 'grid';
          } else if (route.name === 'Dial') {
            iconName = 'call';
          } else if (route.name === 'Analytics') {
            iconName = 'bar-chart';
          } else if (route.name === 'Leads') {
            iconName = 'people';
          } else if (route.name === 'Reports') {
            iconName = 'pie-chart';
          } else if (route.name === 'AdminHub') {
            iconName = 'person';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              labelText={labelText}
              iconName={iconName}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  outerHaloGlow: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    bottom: 4,
    borderRadius: 36,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
  container: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 36,
    height: 68,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'visible', // Allows elevated active icon to float above container!
  },
  liquidBlobWrapper: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  liquidBlobGradient: {
    width: '90%',
    height: '100%',
    borderRadius: 24,
    opacity: 0.13,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  rippleCircle: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    top: 4,
  },
  elevatedOrbWrapper: {
    position: 'absolute',
    top: -2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'visible',
  },
  orbRadiantGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  elevatedOrbGradient: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  orbGlossRim: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  sparkleParticleRight: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 12,
  },
  sparkleParticleLeft: {
    position: 'absolute',
    top: 2,
    left: -6,
    zIndex: 12,
  },
  baselineIconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  activeLabel: {
    fontWeight: '800',
    fontSize: 10.5,
  },
  inactiveLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});

