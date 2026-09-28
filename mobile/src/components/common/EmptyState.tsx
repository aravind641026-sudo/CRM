import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  message?: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'call',
  title,
  description,
  message,
  actionTitle,
  actionLabel,
  onAction,
  style,
}) => {
  const desc = description || message;
  const btnLabel = actionTitle || actionLabel;

  return (
    <View style={[styles.container, style]}>
      {/* Decorative Aura and Glass Rings */}
      <View style={styles.illustrationWrapper}>
        {/* Outermost ambient aura */}
        <View style={styles.outerAura}>
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.12)', 'rgba(124, 58, 237, 0.10)', 'rgba(217, 70, 239, 0.08)', 'transparent']}
            style={styles.auraGradient}
          />
        </View>

        {/* Outer glass ring */}
        <View style={styles.outerRing}>
          {/* Inner solid glass circle with soft shadow */}
          <View style={styles.innerGlassCircle}>
            <Ionicons name={icon} size={32} color="#7C3AED" />
          </View>
        </View>

        {/* Floating colored spheres / planetary accents */}
        <View style={styles.dotCyan} />
        <View style={styles.dotPink} />
        <View style={styles.dotBlue} />
        <View style={styles.dotPurple} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {desc && <Text style={styles.description}>{desc}</Text>}
      {btnLabel && onAction && (
        <Button
          title={btnLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing.md,
  },
  outerAura: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  auraGradient: {
    flex: 1,
    borderRadius: 85,
  },
  outerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  innerGlassCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  dotCyan: {
    position: 'absolute',
    top: 26,
    right: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
  },
  dotPink: {
    position: 'absolute',
    bottom: 34,
    left: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F472B6',
  },
  dotBlue: {
    position: 'absolute',
    top: 42,
    left: 28,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
  },
  dotPurple: {
    position: 'absolute',
    bottom: 28,
    right: 32,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(56, 189, 248, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 290,
    lineHeight: 19,
    fontWeight: '500',
  },
  button: {
    marginTop: spacing.md,
    minWidth: 120,
  },
});
