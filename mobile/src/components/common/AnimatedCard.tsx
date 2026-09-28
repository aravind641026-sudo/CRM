import React, { useEffect, useRef } from 'react';
import {
  Animated,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';
import { colors } from '../../theme/colors';

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  asCard?: boolean;
  glow?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  delay = 0,
  duration = 220,
  onPress,
  style,
  activeOpacity = 0.85,
  asCard = false,
  glow = false,
}) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(6)).current;
  const scaleAnim = useRef(new Animated.Value(0.99)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, duration, opacityAnim, translateYAnim, scaleAnim]);

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(pressScaleAnim, {
        toValue: 0.975,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      Animated.spring(pressScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  };

  const containerStyle = [
    styles.animContainer,
    asCard && styles.cardSurface,
    asCard && glow && styles.cardGlow,
    style,
    {
      opacity: opacityAnim,
      transform: [
        { translateY: translateYAnim },
        { scale: Animated.multiply(scaleAnim, pressScaleAnim) },
      ],
    },
  ];

  if (onPress) {
    return (
      <Animated.View style={containerStyle}>
        <TouchableOpacity
          activeOpacity={activeOpacity}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.innerTouchable}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={containerStyle}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animContainer: {
    // Dynamic height based on content
  },
  cardSurface: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardGlow: {
    shadowColor: colors.primaryViolet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
    borderColor: 'rgba(124, 58, 237, 0.35)',
  },
  innerTouchable: {
    width: '100%',
  },
});
