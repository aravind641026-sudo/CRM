import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'dangerLight' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      useNativeDriver: true,
      speed: 26,
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

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    switch (variant) {
      case 'primary':
      case 'gradient':
      case 'success':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
        return colors.primaryElectric;
      case 'dangerLight':
        return colors.danger;
      case 'outline':
        return colors.textPrimary;
      case 'ghost':
        return colors.primaryElectric;
      default:
        return '#FFFFFF';
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return 38;
      case 'lg':
        return 52;
      default:
        return 46;
    }
  };

  const isPrimaryOrGradient = variant === 'primary' || variant === 'gradient';

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const {
    flex,
    flexGrow,
    flexShrink,
    width,
    minWidth,
    maxWidth,
    margin,
    marginHorizontal,
    marginVertical,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    alignSelf,
    ...touchableStyle
  } = flattenedStyle as any;

  const containerStyle: ViewStyle = {};
  if (flex !== undefined) containerStyle.flex = flex;
  if (flexGrow !== undefined) containerStyle.flexGrow = flexGrow;
  if (flexShrink !== undefined) containerStyle.flexShrink = flexShrink;
  if (width !== undefined) containerStyle.width = width;
  if (minWidth !== undefined) containerStyle.minWidth = minWidth;
  if (maxWidth !== undefined) containerStyle.maxWidth = maxWidth;
  if (margin !== undefined) containerStyle.margin = margin;
  if (marginHorizontal !== undefined) containerStyle.marginHorizontal = marginHorizontal;
  if (marginVertical !== undefined) containerStyle.marginVertical = marginVertical;
  if (marginLeft !== undefined) containerStyle.marginLeft = marginLeft;
  if (marginRight !== undefined) containerStyle.marginRight = marginRight;
  if (marginTop !== undefined) containerStyle.marginTop = marginTop;
  if (marginBottom !== undefined) containerStyle.marginBottom = marginBottom;
  if (alignSelf !== undefined) containerStyle.alignSelf = alignSelf;

  const renderButtonBody = () => {
    if (isPrimaryOrGradient && !disabled) {
      return (
        <LinearGradient
          colors={colors.primaryButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.button,
            styles.primaryShadow,
            { height: getHeight() },
            touchableStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, { color: '#FFFFFF' }, textStyle]}>
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      );
    }

    if (variant === 'secondary') {
      return (
        <View
          style={[
            styles.button,
            styles.secondaryGlass,
            { height: getHeight() },
            disabled && styles.disabled,
            touchableStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryElectric} size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, { color: colors.primaryElectric }, textStyle]}>
                {title}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Default other variants (success, danger, outline, etc.)
    let bgColor = colors.primary;
    let borderColor = 'transparent';
    let borderWidth = 0;

    if (disabled) {
      bgColor = colors.surfaceMuted;
    } else if (variant === 'success') {
      bgColor = colors.success;
    } else if (variant === 'danger') {
      bgColor = colors.danger;
    } else if (variant === 'dangerLight') {
      bgColor = colors.dangerLight;
    } else if (variant === 'outline') {
      bgColor = 'rgba(255, 255, 255, 0.8)';
      borderColor = colors.border;
      borderWidth = 1.2;
    } else if (variant === 'ghost') {
      bgColor = 'transparent';
    }

    return (
      <View
        style={[
          styles.button,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth,
            height: getHeight(),
          },
          disabled && styles.disabled,
          touchableStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, containerStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={{ width: width ? '100%' : undefined }}
      >
        {renderButtonBody()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: spacing.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  primaryShadow: {
    shadowColor: colors.primaryViolet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  secondaryGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  disabled: {
    opacity: 0.65,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
