import { useRef, useCallback } from 'react';
import { Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

export const useCollapsibleHeader = (maxHeight = 70) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  // Stable handleScroll without triggering setState on scroll
  const handleScroll = useCallback(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: false,
    }),
    [scrollY]
  );

  const collapsibleStyle = {
    // Zero layout shift or height manipulation
    overflow: 'hidden' as const,
  };

  return {
    isHeaderCollapsed: false,
    handleScroll,
    collapsibleStyle,
    headerAnim: scrollY,
  };
};
