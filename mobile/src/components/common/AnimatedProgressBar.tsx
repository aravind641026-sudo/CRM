import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface AnimatedProgressBarProps {
  progress?: number; // 0 to 100
  percentage?: number;
  value?: number;
  duration?: number;
  height?: number;
  gradientColors?: [string, string] | [string, string, string];
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  percentage,
  value,
  duration = 800,
  height = 6,
  gradientColors = colors.progressGradient,
  trackColor = '#E2E8F0',
  style,
}) => {
  const targetProgress = percentage ?? value ?? progress ?? 0;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.min(Math.max(targetProgress, 0), 100);
    Animated.timing(animatedWidth, {
      toValue: clamped,
      duration,
      useNativeDriver: false,
    }).start();
  }, [targetProgress, duration, animatedWidth]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fillContainer, { width: widthInterpolation }]}>
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  fillContainer: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: 999,
  },
});
