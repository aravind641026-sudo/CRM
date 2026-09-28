import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { IconTile } from './IconTile';
import { AnimatedNumber } from './AnimatedNumber';
import { AnimatedCard } from './AnimatedCard';

interface StatCardProps {
  label: string;
  value: number;
  iconName: string;
  iconVariant?: 'blue' | 'purple' | 'orange' | 'green' | 'red';
  subText?: string;
  subLabel?: string;
  subtitle?: string;
  prefix?: string;
  suffix?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  iconName,
  iconVariant = 'blue',
  subText,
  subLabel,
  subtitle,
  prefix = '',
  suffix = '',
  onPress,
  style,
  delay = 0,
}) => {
  const displaySub = subLabel || subtitle || subText;
  return (
    <AnimatedCard
      delay={delay}
      onPress={onPress}
      style={[styles.card, style]}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        {/* Top Icon Tile */}
        <View style={styles.iconWrapper}>
          <IconTile
            name={iconName}
            variant={iconVariant}
            size={34}
            iconSize={16}
          />
        </View>

        {/* Big Bold Animated Number */}
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          duration={800}
          style={styles.number}
        />

        {/* Label */}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>

        {/* Optional sub-rate or helper */}
        {displaySub ? (
          <Text style={styles.subText} numberOfLines={1}>
            {displaySub}
          </Text>
        ) : null}
      </View>
    </AnimatedCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    paddingVertical: 10,
    paddingHorizontal: 7,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: 6,
  },
  number: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
  },
  subText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
});
