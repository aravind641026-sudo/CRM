import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';

const videoSource = require('../../../assets/splashScreenVid.mp4');

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated, isLoading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const navigatedRef = useRef(false);

  const handleNavigateNext = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      if (isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    });
  }, [fadeAnim, isAuthenticated, navigation]);

  // Initialize expo-video player
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Listen for video completion event
  useEventListener(player, 'playToEnd', () => {
    handleNavigateNext();
  });

  // Fallback safety timeout (4.5s) to guarantee navigation on all devices
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        handleNavigateNext();
      }
    }, 4500);

    return () => clearTimeout(timer);
  }, [isLoading, handleNavigateNext]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" translucent />
      <View style={styles.videoWrapper}>
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit="contain"
          nativeControls={false}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    width: '100%',
    height: '100%',
  },
});
