import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Lead } from '../../types';
import { openSystemDialer } from '../../utils/phoneDialer';

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
  onLogCall?: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onPress, onLogCall }) => {
  const handleDirectCall = () => {
    openSystemDialer(lead.phone);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.leadInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {lead.name}
          </Text>
          <Text style={styles.phone} numberOfLines={1}>
            {lead.phone}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.callButton}
          onPress={handleDirectCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Badges & Meta Row */}
      <View style={styles.tagsRow}>
        {lead.project?.name && (
          <View style={styles.projectTag}>
            <Ionicons name="briefcase-outline" size={11} color={colors.textSecondary} />
            <Text style={styles.projectText} numberOfLines={1}>
              {lead.project.name}
            </Text>
          </View>
        )}
        <StatusBadge label={lead.status} status={lead.status} />
        {lead.businessOutcome && (
          <StatusBadge label={lead.businessOutcome} status={lead.businessOutcome} />
        )}
      </View>

      {/* Notes or Follow-up preview */}
      {lead.notes ? (
        <Text style={styles.notesPreview} numberOfLines={2}>
          {lead.notes}
        </Text>
      ) : null}

      {/* Footer Info */}
      <View style={styles.footer}>
        {lead.scheduledFollowUp ? (
          <View style={styles.followUpBadge}>
            <Ionicons name="calendar-outline" size={12} color={colors.warning} />
            <Text style={styles.followUpText}>
              Follow-up: {formatDate(lead.scheduledFollowUp)}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <View style={styles.viewDetailsRow}>
          <Text style={styles.viewDetailsText}>Details</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  leadInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phone: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.callGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs + 2,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    maxWidth: 130,
  },
  notesPreview: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: spacing.xs + 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 4,
    marginTop: 2,
  },
  followUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  followUpText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});
