import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  itemName?: string;
  description?: string;
  confirmKeyword?: string; // Default: 'DELETE'
  loading?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  itemName,
  description = 'This action cannot be undone. All associated records and data will be permanently removed.',
  confirmKeyword = 'DELETE',
  loading = false,
}) => {
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (visible) {
      setInputText('');
    }
  }, [visible]);

  const isMatched = inputText.trim() === confirmKeyword;

  const handleConfirm = async () => {
    if (!isMatched || loading) return;
    await onConfirm();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={loading ? undefined : onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={loading ? undefined : onClose}
        />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.warningBadge}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.titleColumn}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title}
              </Text>
              {itemName ? (
                <Text style={styles.itemNameText} numberOfLines={1}>
                  {itemName}
                </Text>
              ) : null}
            </View>
            {!loading && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Warning description */}
          <Text style={styles.descText}>{description}</Text>

          {/* Typing Prompt Box */}
          <View style={styles.inputBox}>
            <Text style={styles.promptLabel}>
              Type <Text style={styles.promptKeyword}>{confirmKeyword}</Text> to confirm:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                isMatched && styles.textInputMatched,
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={`Type "${confirmKeyword}"`}
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Footer Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteBtn,
                !isMatched && styles.deleteBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isMatched || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-bin-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.deleteBtnText}>Delete Permanently</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  warningBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  titleColumn: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  descText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 16,
  },
  inputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  promptLabel: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 8,
  },
  promptKeyword: {
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 1,
  },
  textInputMatched: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBtn: {
    flex: 1.6,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  deleteBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
