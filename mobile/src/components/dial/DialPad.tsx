import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { leadApi } from '../../api/leadApi';
import { Lead } from '../../types';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';

interface DialPadProps {
  initialNumber?: string;
  onOpenLeadDetails?: (leadId: number, leadName?: string) => void;
  onOpenLogCallModal?: (leadId: number, leadName: string, phone: string) => void;
  onStartCall?: (phoneNumber: string, lead?: Lead | null) => void;
}

// Explicit 3-column x 4-row telephone keypad matrix
const PAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export const DialPad: React.FC<DialPadProps> = ({
  initialNumber = '',
  onOpenLeadDetails,
  onOpenLogCallModal,
  onStartCall,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [matchedLead, setMatchedLead] = useState<Lead | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive button and spacing calculations for any screen width
  const maxDialWidth = Math.min(windowWidth - 28, 340);
  const gap = windowWidth < 360 ? 16 : 22;
  const rawSize = Math.floor((maxDialWidth - (2 * gap) - 16) / 3);
  const buttonSize = Math.max(68, Math.min(rawSize, 80));
  const rowMarginVertical = windowHeight < 700 ? 5 : 7;

  useEffect(() => {
    if (initialNumber) {
      setPhoneNumber(initialNumber);
    }
  }, [initialNumber]);

  // Search for matching lead as digits are entered
  useEffect(() => {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    if (cleanNumber.length >= 4) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const res = await leadApi.getLeads({ search: cleanNumber, size: 1 });
          if (res.content && res.content.length > 0) {
            setMatchedLead(res.content[0]);
          } else {
            setMatchedLead(null);
          }
        } catch {
          setMatchedLead(null);
        } finally {
          setIsSearching(false);
        }
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setMatchedLead(null);
      setIsSearching(false);
    }
  }, [phoneNumber]);

  const handlePress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleLongPressZero = () => {
    setPhoneNumber((prev) => prev + '+');
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleCall = () => {
    if (!phoneNumber) {
      Alert.alert('Invalid Number', 'Please enter a phone number to call.');
      return;
    }

    if (onStartCall) {
      onStartCall(phoneNumber.trim(), matchedLead);
      return;
    }

    const url = `tel:${phoneNumber.trim()}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Phone dialer unavailable', `Cannot make calls to ${phoneNumber} on this device.`);
        }
      })
      .catch((err) => console.warn('Dialer error:', err));
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 28) + 16 }]}>
      {/* Number Display Bar */}
      <View style={styles.displayContainer}>
        <Text
          style={[
            styles.numberText,
            !phoneNumber && styles.placeholderText,
            phoneNumber.length > 12 && styles.numberTextSmall,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {phoneNumber || 'Enter Number'}
        </Text>
        {phoneNumber.length > 0 && (
          <TouchableOpacity
            onPress={handleDelete}
            onLongPress={handleClear}
            style={styles.backspaceButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Matched Lead Lookup Card */}
      {matchedLead && (
        <Card style={styles.matchedCard}>
          <View style={styles.matchedHeader}>
            <View style={styles.matchedInfo}>
              <Text style={styles.matchedName} numberOfLines={1}>{matchedLead.name}</Text>
              <Text style={styles.matchedProject} numberOfLines={1}>
                {matchedLead.project?.name || 'CRM Lead'} • {matchedLead.phone}
              </Text>
            </View>
            <StatusBadge label={matchedLead.status} status={matchedLead.status} />
          </View>
          <View style={styles.matchedActions}>
            {onOpenLeadDetails && (
              <TouchableOpacity
                style={styles.matchedBtnSecondary}
                onPress={() => onOpenLeadDetails(matchedLead.id, matchedLead.name)}
              >
                <Ionicons name="person-outline" size={13} color={colors.primary} />
                <Text style={styles.matchedBtnSecondaryText}>View Lead</Text>
              </TouchableOpacity>
            )}
            {onOpenLogCallModal && (
              <TouchableOpacity
                style={styles.matchedBtnPrimary}
                onPress={() => onOpenLogCallModal(matchedLead.id, matchedLead.name, matchedLead.phone)}
              >
                <Ionicons name="create-outline" size={13} color="#ffffff" />
                <Text style={styles.matchedBtnPrimaryText}>Log Notes</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      )}

      {/* Keypad Grid: Guaranteed 3 Columns x 4 Rows */}
      <View style={[styles.keypadContainer, { maxWidth: maxDialWidth }]}>
        {PAD_ROWS.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[styles.padRow, { marginVertical: rowMarginVertical, gap }]}
          >
            {row.map((btn) => (
              <TouchableOpacity
                key={btn}
                style={[
                  styles.padButton,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                ]}
                onPress={() => handlePress(btn)}
                onLongPress={btn === '0' ? handleLongPressZero : undefined}
                activeOpacity={0.65}
              >
                <Text style={[styles.padDigit, { fontSize: buttonSize >= 68 ? 28 : 24 }]}>
                  {btn}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Row 5: Call & Actions Row Aligned to the 3 Columns */}
        <View style={[styles.padRow, styles.actionRow, { marginVertical: rowMarginVertical, gap }]}>
          {/* Column 1 Spacer */}
          <View style={{ width: buttonSize, height: buttonSize }} />

          {/* Column 2: Call Button */}
          <TouchableOpacity
            style={[
              styles.callButton,
              {
                width: buttonSize,
                height: buttonSize,
                borderRadius: buttonSize / 2,
              },
            ]}
            onPress={handleCall}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={buttonSize >= 68 ? 32 : 28} color="#ffffff" />
          </TouchableOpacity>

          {/* Column 3: Delete / Backspace Button */}
          <View
            style={{
              width: buttonSize,
              height: buttonSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {phoneNumber.length > 0 && (
              <TouchableOpacity
                onPress={handleDelete}
                onLongPress={handleClear}
                style={styles.deleteButton}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="backspace-outline"
                  size={buttonSize >= 68 ? 30 : 26}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  displayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: '100%',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  numberText: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  placeholderText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  numberTextSmall: {
    fontSize: 24,
  },
  backspaceButton: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.sm,
  },
  matchedCard: {
    width: '100%',
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderColor: colors.border,
  },
  matchedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchedInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  matchedName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  matchedProject: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  matchedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  matchedBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.primaryLight,
  },
  matchedBtnSecondaryText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  matchedBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 5,
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.primary,
  },
  matchedBtnPrimaryText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  keypadContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  padButton: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  padDigit: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionRow: {
    marginTop: spacing.sm,
  },
  callButton: {
    backgroundColor: colors.callGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.callGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
});

