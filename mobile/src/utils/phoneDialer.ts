import { Linking, Alert, Platform } from 'react-native';

/**
 * Sanitizes phone number by removing spaces, brackets, dashes, etc.,
 * leaving only digits and a possible leading '+'.
 * E.g. "+91 98111 22334" -> "+919811122334"
 * E.g. "98765-43210" -> "9876543210"
 */
export const sanitizePhoneNumber = (phone?: string | null): string => {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digits}` : digits;
};

/**
 * Opens the native Android/iOS system phone dialer with the phone number pre-populated.
 * 
 * Behavior:
 * - Sanitizes the number (removes spaces, dashes, formatting).
 * - Opens the system dialer with the number ready to call.
 * - Does NOT make silent calls or require dangerous CALL_PHONE runtime permissions.
 * - Compatible with Android 11+ (API 30+) package visibility by calling Linking.openURL directly.
 */
export const openSystemDialer = async (phoneNumber?: string | null): Promise<boolean> => {
  if (!phoneNumber) {
    Alert.alert('No Phone Number', 'This contact does not have a phone number.');
    return false;
  }

  const cleanPhone = sanitizePhoneNumber(phoneNumber);
  if (!cleanPhone || cleanPhone.length < 3) {
    Alert.alert('Invalid Number', `"${phoneNumber}" is not a valid phone number.`);
    return false;
  }

  const telUrl = `tel:${cleanPhone}`;

  try {
    await Linking.openURL(telUrl);
    return true;
  } catch (err: any) {
    console.warn(`[phoneDialer] openURL failed for ${telUrl}:`, err);
    // Fallback for iOS telprompt or alternate dialer intents
    try {
      await Linking.openURL(`telprompt:${cleanPhone}`);
      return true;
    } catch (fallbackErr: any) {
      Alert.alert(
        'Unable to Open Dialer',
        `Could not open the phone dialer for ${cleanPhone}. Please verify your device has a phone app.`
      );
      return false;
    }
  }
};
