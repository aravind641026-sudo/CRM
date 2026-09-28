import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'highlight' | 'muted' | 'glass';
  activeOpacity?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
  activeOpacity = 0.9,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'muted':
        return colors.surfaceMuted;
      case 'highlight':
        return colors.primaryLight;
      case 'glass':
        return colors.surfaceGlass;
      default:
        return 'rgba(255, 255, 255, 0.92)';
    }
  };

  const cardStyle = [
    styles.card,
    { backgroundColor: getBackgroundColor() },
    variant === 'elevated' ? shadows.soft : shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={cardStyle}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={activeOpacity}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.borderRadius.card,
    padding: spacing.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: spacing.normal,
  },
});

