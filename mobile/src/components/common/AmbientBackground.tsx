import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

export type AtmosphereVariant = 'home' | 'leads' | 'dial' | 'analytics' | 'reports' | 'admin' | 'settings';

interface AmbientBackgroundProps {
  variant?: AtmosphereVariant;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  variant = 'home',
  children,
  style,
}) => {
  // Slow ambient breathing and floating animations
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // 1. Slow, subtle floating for top-right blob
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop1.start();

    // 2. Slow drifting for top-left / bottom-right blob
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop2.start();

    // 3. Gentle breathing glow
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 5500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 5500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [floatAnim1, floatAnim2, pulseAnim]);

  const topTranslateX = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const topTranslateY = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  const bottomTranslateX = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });
  const bottomTranslateY = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  return (
    <View style={[styles.container, style]}>
      {/* 1. Base clean canvas background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Subtle overall background wash */}
        <LinearGradient
          colors={['#F6F8FE', '#F3F5FC', '#EDF2FB']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top-Right Flowing Ambient Gradient Blob */}
        <Animated.View
          style={[
            styles.topRightBlob,
            {
              transform: [
                { translateX: topTranslateX },
                { translateY: topTranslateY },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(124, 58, 237, 0.18)',
              'rgba(192, 38, 211, 0.14)',
              'rgba(37, 99, 235, 0.08)',
              'transparent',
            ]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.blobGradient}
          />
        </Animated.View>

        {/* Top-Left Cyan & Electric Blue Highlight Aura */}
        <Animated.View
          style={[
            styles.topLeftBlob,
            {
              transform: [
                { translateX: bottomTranslateX },
                { translateY: bottomTranslateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(6, 182, 212, 0.14)',
              'rgba(37, 99, 235, 0.10)',
              'rgba(124, 58, 237, 0.05)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blobGradient}
          />
        </Animated.View>

        {/* Bottom-Right Violet/Pink Flowing Light Wave */}
        <Animated.View
          style={[
            styles.bottomRightBlob,
            {
              transform: [
                { translateX: topTranslateX },
                { translateY: bottomTranslateY },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(217, 70, 239, 0.15)',
              'rgba(124, 58, 237, 0.12)',
              'rgba(37, 99, 235, 0.08)',
              'transparent',
            ]}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.blobGradient}
          />
        </Animated.View>

        {/* Glass reflection spheres & decorative bubbles */}
        <View style={styles.bubble1} />
        <View style={styles.bubble2} />
        <View style={styles.bubble3} />
        <View style={styles.bubble4} />
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FD',
  },
  blobGradient: {
    flex: 1,
    borderRadius: 999,
  },
  topRightBlob: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  topLeftBlob: {
    position: 'absolute',
    top: 40,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bottomRightBlob: {
    position: 'absolute',
    bottom: -60,
    right: -50,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  bubble1: {
    position: 'absolute',
    top: 90,
    right: 48,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  bubble2: {
    position: 'absolute',
    top: 140,
    left: 36,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  bubble3: {
    position: 'absolute',
    bottom: 120,
    left: 45,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  bubble4: {
    position: 'absolute',
    bottom: 180,
    right: 32,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});

