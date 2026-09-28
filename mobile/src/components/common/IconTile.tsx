import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface IconTileProps {
  name: string;
  variant?: 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'cyan' | 'pink' | 'magenta';
  size?: number;
  iconSize?: number;
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TILE_CONFIG: Record<
  string,
  {
    gradient: [string, string, ...string[]];
    iconColor: string;
    bgSubtle: string;
    glowColor: string;
  }
> = {
  blue: {
    gradient: ['#2563EB', '#60A5FA'],
    iconColor: '#2563EB',
    bgSubtle: '#EFF6FF',
    glowColor: 'rgba(37, 99, 235, 0.25)',
  },
  purple: {
    gradient: ['#7C3AED', '#A855F7'],
    iconColor: '#7C3AED',
    bgSubtle: '#F5F3FF',
    glowColor: 'rgba(124, 58, 237, 0.25)',
  },
  magenta: {
    gradient: ['#C026D3', '#F472B6'],
    iconColor: '#C026D3',
    bgSubtle: '#FDF4FF',
    glowColor: 'rgba(192, 38, 211, 0.25)',
  },
  orange: {
    gradient: ['#EA580C', '#FB923C'],
    iconColor: '#EA580C',
    bgSubtle: '#FFF7ED',
    glowColor: 'rgba(234, 88, 12, 0.25)',
  },
  green: {
    gradient: ['#059669', '#34D399'],
    iconColor: '#059669',
    bgSubtle: '#ECFDF5',
    glowColor: 'rgba(5, 150, 105, 0.25)',
  },
  red: {
    gradient: ['#DC2626', '#F87171'],
    iconColor: '#DC2626',
    bgSubtle: '#FEF2F2',
    glowColor: 'rgba(220, 38, 38, 0.25)',
  },
  cyan: {
    gradient: ['#0891B2', '#38BDF8'],
    iconColor: '#0891B2',
    bgSubtle: '#ECFEFF',
    glowColor: 'rgba(8, 145, 178, 0.25)',
  },
  pink: {
    gradient: ['#DB2777', '#F472B6'],
    iconColor: '#DB2777',
    bgSubtle: '#FDF2F8',
    glowColor: 'rgba(219, 39, 119, 0.25)',
  },
};

export const IconTile: React.FC<IconTileProps> = ({
  name,
  variant = 'blue',
  size = 40,
  iconSize = 19,
  solid = false,
  style,
}) => {
  const config = TILE_CONFIG[variant] || TILE_CONFIG.blue;

  // Map non-ionicons names to proper ionicons
  let ioniconName = name;
  if (name === 'trophy') ioniconName = 'checkmark-circle';
  if (name === 'person-add') ioniconName = 'people';
  if (name === 'document-text') ioniconName = 'download-outline';

  if (solid) {
    return (
      <View style={[styles.glowWrapper, { shadowColor: config.glowColor }]}>
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.solidContainer,
            {
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.34),
            },
            style,
          ]}
        >
          <Ionicons name={ioniconName as any} size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.subtleContainer,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.34),
          backgroundColor: config.bgSubtle,
        },
        style,
      ]}
    >
      <Ionicons name={ioniconName as any} size={iconSize} color={config.iconColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  glowWrapper: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  subtleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  solidContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
