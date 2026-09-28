import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AnimatedNumber } from './AnimatedNumber';

interface CircularProgressWidgetProps {
  percentage: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const CircularProgressWidget: React.FC<CircularProgressWidgetProps> = ({
  percentage,
  label = 'CONV.',
  size = 68,
  strokeWidth = 4,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [percentage, scaleAnim, opacityAnim]);

  const clamped = Math.min(Math.max(percentage, 0), 100);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Outer subtle glow ring */}
      <View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
          },
        ]}
      />

      {/* Glass Inner circle */}
      <View
        style={[
          styles.innerCircle,
          {
            width: size - strokeWidth * 2 - 4,
            height: size - strokeWidth * 2 - 4,
            borderRadius: (size - strokeWidth * 2 - 4) / 2,
          },
        ]}
      >
        <AnimatedNumber
          value={clamped}
          suffix="%"
          duration={850}
          style={styles.percentageText}
        />
        {label ? <Text style={styles.labelText}>{label}</Text> : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  outerRing: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderTopColor: '#FFFFFF',
    borderRightColor: '#FFFFFF',
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  percentageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  labelText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
