import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CardShineProps {
  interval?: number;
}

export const CardShine: React.FC<CardShineProps> = ({ interval = 4500 }) => {
  const translateX = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 400,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.delay(interval),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [interval, translateX]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.shineContainer,
          {
            transform: [{ translateX }, { rotate: '25deg' }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0)',
            'rgba(255, 255, 255, 0.08)',
            'rgba(255, 255, 255, 0.22)',
            'rgba(255, 255, 255, 0.08)',
            'rgba(255, 255, 255, 0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shineGradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  shineContainer: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 100,
  },
  shineGradient: {
    flex: 1,
  },
});
