import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { leadApi } from '../../api/leadApi';
import { LeadDetailResponse, User, Project } from '../../types';

interface EditLeadModalProps {
  visible: boolean;
  lead: LeadDetailResponse | null;
  agents: User[];
  projects: Project[];
  isAdmin?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Social Media',
  'Direct',
  'Phone Inquiry',
  'Campaign',
  'Other',
];

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  visible,
  lead,
  agents,
  projects,
  isAdmin = false,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState('Website');
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined);
  const [dealValue, setDealValue] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead && visible) {
      setName(lead.name || '');
      setPhone(lead.phone || '');
      setEmail(lead.email || '');
      setCity(lead.city || lead.state || '');
      setAddress(lead.address || '');
      setSource(lead.source || 'Website');
      setSelectedProjectId(lead.project?.id || lead.projectId);
      const owner = lead.currentOwner || lead.assignedTo;
      setSelectedAgentId(owner?.id);
      setDealValue(lead.sale?.dealValue ? String(lead.sale.dealValue) : '');
      setAdditionalInfo(lead.additionalInfo || lead.notes || '');
    }
  }, [lead, visible]);

  const handleSave = async () => {
    if (!lead) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Lead name is required.');
      return;
    }

    if (!trimmedPhone) {
      Alert.alert('Validation Error', 'Phone number is required.');
      return;
    }

    setSaving(true);
    try {
      // 1. Update lead demographics
      await leadApi.updateLead(lead.id, {
        name: trimmedName,
        phone: trimmedPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        source: source.trim() || undefined,
        additionalInfo: additionalInfo.trim() || undefined,
      });

      // 2. If assignment changed and user is Admin, reassign
      const initialOwner = lead.currentOwner || lead.assignedTo;
      if (isAdmin && selectedAgentId && selectedAgentId !== initialOwner?.id) {
        await leadApi.reassignLead(lead.id, selectedAgentId, 'Reassigned via lead profile edit');
      }

      Alert.alert('Success', 'Lead information updated successfully.');
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update lead information.');
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>Edit Lead Profile</Text>
              <Text style={styles.headerSub}>Update contact & lead information</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Status Information Box (Status managed separately) */}
            <View style={styles.statusNoticeBox}>
              <Ionicons name="information-circle" size={18} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusNoticeTitle}>Status Management</Text>
                <Text style={styles.statusNoticeText}>
                  Current Status: <Text style={{ fontWeight: '800' }}>{lead.status?.replace('_', ' ') || 'NEW'}</Text>. Lead status changes follow automated workflow rules and are managed via the Status tab on the lead profile.
                </Text>
              </View>
            </View>

            {/* Field: Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Lead Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={17} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter customer name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Phone Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Phone Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={17} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={17} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: City / Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>City / Location</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="location-outline" size={17} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Coimbatore, Chennai"
                  value={city}
                  onChangeText={setCity}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="business-outline" size={17} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Street / Area address"
                  value={address}
                  onChangeText={setAddress}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Lead Source */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Lead Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {LEAD_SOURCES.map((src) => {
                  const isSel = source.toLowerCase() === src.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={src}
                      style={[styles.chipItem, isSel && styles.chipItemActive]}
                      onPress={() => setSource(src)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                        {src}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Field: Current Owner / Assignment (Admin Only) */}
            {isAdmin && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Assigned Sales Executive (Admin Only)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {agents.map((ag) => {
                    const isSel = selectedAgentId === ag.id;
                    return (
                      <TouchableOpacity
                        key={ag.id}
                        style={[styles.chipItem, isSel && styles.chipItemActive]}
                        onPress={() => setSelectedAgentId(ag.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="person"
                          size={13}
                          color={isSel ? '#2563EB' : '#64748B'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                          {ag.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Field: Deal Value (Optional) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Deal Value (₹)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 25000"
                  value={dealValue}
                  onChangeText={setDealValue}
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Additional Remarks / Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Additional Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Additional requirements or details..."
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
                multiline
                numberOfLines={3}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#2563EB', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    maxHeight: 450,
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  statusNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 2,
  },
  statusNoticeText: {
    fontSize: 11.5,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginRight: 8,
  },
  chipItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
