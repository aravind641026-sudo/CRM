import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  isFilterActive?: boolean;
  activeFilterCount?: number;
  showFilterButton?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  onFilterPress,
  isFilterActive = false,
  activeFilterCount = 0,
  showFilterButton = true,
  containerStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.searchBox,
          isFocused && styles.searchBoxFocused,
          !showFilterButton && { flex: 1 },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={isFocused ? '#7C3AED' : '#94A3B8'}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange('')}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {showFilterButton && onFilterPress && (
        <TouchableOpacity
          style={[
            styles.filterBtn,
            isFilterActive && styles.filterBtnActive,
          ]}
          onPress={onFilterPress}
          activeOpacity={0.75}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={isFilterActive ? '#FFFFFF' : '#64748B'}
          />
          {isFilterActive && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchBoxFocused: {
    borderColor: '#C084FC',
    backgroundColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 2,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  filterBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  activeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
