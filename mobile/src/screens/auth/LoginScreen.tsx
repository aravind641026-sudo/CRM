import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { getApiBaseUrl, setApiBaseUrl } from '../../api/client';
import { STORAGE_KEYS } from '../../config/constants';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Server settings modal state
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });

  // Focused state for input border highlight
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  // Input Refs for instant tap-to-focus on entire input box container
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // 1. Top Wave slow drift animation (24s cycle)
  const topWaveTranslateX = useRef(new Animated.Value(0)).current;
  const topWaveTranslateY = useRef(new Animated.Value(0)).current;

  // 2. Bottom Wave slow undulating flow (28s cycle)
  const bottomWaveTranslateX = useRef(new Animated.Value(0)).current;
  const bottomWaveTranslateY = useRef(new Animated.Value(0)).current;

  // 3. Floating particles individual breathing/floating animations
  const floatAnim1 = useRef(new Animated.Value(0)).current; // Top-left cyan ring
  const floatAnim2 = useRef(new Animated.Value(0)).current; // Mid-left pink dot
  const floatAnim3 = useRef(new Animated.Value(0)).current; // Top-right blue sphere
  const floatAnim4 = useRef(new Animated.Value(0)).current; // Mid-right purple orb
  const floatAnim5 = useRef(new Animated.Value(0)).current; // Bottom-left blue ring
  const floatAnim6 = useRef(new Animated.Value(0)).current; // Bottom-right pink dot

  // 4. Dot matrix opacity pulse
  const dotMatrixPulse = useRef(new Animated.Value(0.5)).current;

  // 5. Logo halo glow pulse (4.5s cycle)
  const logoPulse = useRef(new Animated.Value(1)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0.4)).current;

  // 6. Sign In button subtle shimmer sweep
  const btnShimmerTranslate = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    // Top Wave Loop (smooth back & forth drift)
    const topWaveLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(topWaveTranslateX, {
            toValue: 18,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(topWaveTranslateY, {
            toValue: -10,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(topWaveTranslateX, {
            toValue: -15,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(topWaveTranslateY, {
            toValue: 8,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Bottom Wave Loop (smooth undulating flow)
    const bottomWaveLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bottomWaveTranslateX, {
            toValue: -22,
            duration: 14000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bottomWaveTranslateY, {
            toValue: -12,
            duration: 14000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(bottomWaveTranslateX, {
            toValue: 18,
            duration: 14000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bottomWaveTranslateY, {
            toValue: 10,
            duration: 14000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Floating Particle 1 (cyan ring: 6s cycle)
    const p1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, { toValue: -8, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim1, { toValue: 8, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Floating Particle 2 (pink dot: 5s cycle)
    const p2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, { toValue: 6, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim2, { toValue: -6, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Floating Particle 3 (blue sphere: 7s cycle)
    const p3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim3, { toValue: -7, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim3, { toValue: 7, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Floating Particle 4 (purple orb: 8s cycle)
    const p4Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim4, { toValue: 9, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim4, { toValue: -9, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Floating Particle 5 (bottom blue ring: 6.5s cycle)
    const p5Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim5, { toValue: -8, duration: 3250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim5, { toValue: 8, duration: 3250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Floating Particle 6 (bottom pink dot: 4.5s cycle)
    const p6Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim6, { toValue: 5, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim6, { toValue: -5, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Dot Matrix Pulse (5s cycle)
    const matrixLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotMatrixPulse, { toValue: 0.9, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotMatrixPulse, { toValue: 0.4, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    // Logo Ambient Halo Breathing Pulse (4.5s cycle)
    const logoLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoPulse, { toValue: 1.08, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoGlowOpacity, { toValue: 0.7, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(logoPulse, { toValue: 0.96, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoGlowOpacity, { toValue: 0.35, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );

    // Button Shimmer Sweep (8s cycle)
    const btnShimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(btnShimmerTranslate, {
          toValue: 360,
          duration: 1800,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.delay(6200),
        Animated.timing(btnShimmerTranslate, {
          toValue: -160,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    topWaveLoop.start();
    bottomWaveLoop.start();
    p1Loop.start();
    p2Loop.start();
    p3Loop.start();
    p4Loop.start();
    p5Loop.start();
    p6Loop.start();
    matrixLoop.start();
    logoLoop.start();
    btnShimmerLoop.start();

    return () => {
      topWaveLoop.stop();
      bottomWaveLoop.stop();
      p1Loop.stop();
      p2Loop.stop();
      p3Loop.stop();
      p4Loop.stop();
      p5Loop.stop();
      p6Loop.stop();
      matrixLoop.stop();
      logoLoop.stop();
      btnShimmerLoop.stop();
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('connect') ||
        msg.toLowerCase().includes('timeout')
      ) {
        setErrorMessage(
          msg + '\n(Tap "Server Settings" below to test or switch your backend URL)'
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (urlToTest: string) => {
    setTestStatus({ loading: true, message: undefined });
    try {
      const trimmed = urlToTest.trim().replace(/\/+$/, '');
      const cleanUrl = trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${cleanUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test_health_ping@crm.com', password: 'ping' }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Even if 401 or 400, the server reached!
      if (res.status === 200 || res.status === 400 || res.status === 401) {
        setTestStatus({
          loading: false,
          success: true,
          message: `Connected! Server is reachable (HTTP ${res.status}).`,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: `Server responded with HTTP status ${res.status}.`,
        });
      }
    } catch (e: any) {
      const errMsg = e.name === 'AbortError' ? 'Connection timed out (8s)' : (e.message || 'Network error');
      setTestStatus({
        loading: false,
        success: false,
        message: `Failed to connect: ${errMsg}`,
      });
    }
  };

  const handleSaveServerUrl = async () => {
    const trimmed = serverUrlInput.trim().replace(/\/+$/, '');
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please enter a valid backend server URL.');
      return;
    }
    const cleanUrl = trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
    setApiBaseUrl(cleanUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_API_URL, cleanUrl);
    setShowServerModal(false);
    setErrorMessage('');
    Alert.alert('Backend Updated', `Active backend URL is now:\n${cleanUrl}`);
  };

  return (
    <View style={styles.screenRoot}>
      {/* ========================================================================= */}
      {/* 1. ISOLATED LIVE ANIMATED BACKGROUND (POINTER-EVENTS NONE)                */}
      {/* ========================================================================= */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top-Left Animated Fluid Waves */}
        <Animated.View
          style={[
            styles.topWaveLayer,
            {
              transform: [
                { translateX: topWaveTranslateX },
                { translateY: topWaveTranslateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#38BDF8', '#6366F1', '#A855F7', '#E879F9', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topWaveGradient1}
          />
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.45)', 'rgba(168, 85, 247, 0.35)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.topWaveGradient2}
          />
        </Animated.View>

        {/* Top-Right Soft Lavender Ambient Aura */}
        <View style={styles.topRightAura}>
          <LinearGradient
            colors={['rgba(216, 180, 254, 0.35)', 'rgba(244, 114, 182, 0.2)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.auraFill}
          />
        </View>

        {/* Top-Right Decorative Dot Matrix (5x5 grid from reference) */}
        <Animated.View style={[styles.dotMatrixGrid, { opacity: dotMatrixPulse }]}>
          {Array.from({ length: 25 }).map((_, i) => (
            <View key={i} style={styles.matrixDot} />
          ))}
        </Animated.View>

        {/* Particle 1: Top-Left Cyan/Blue Ring */}
        <Animated.View
          style={[
            styles.particleCyanRing,
            { transform: [{ translateY: floatAnim1 }] },
          ]}
        />

        {/* Particle 2: Satellite Dot (Cyan / Blue near top left) */}
        <Animated.View
          style={[
            styles.particleCyanDot,
            { transform: [{ translateY: floatAnim2 }] },
          ]}
        />

        {/* Particle 3: Mid-Left Magenta Glowing Dot */}
        <Animated.View
          style={[
            styles.particleMagentaDotLeft,
            { transform: [{ translateY: floatAnim2 }] },
          ]}
        />

        {/* Particle 4: Top-Right Solid Blue Sphere */}
        <Animated.View
          style={[
            styles.particleBlueSphere,
            { transform: [{ translateY: floatAnim3 }] },
          ]}
        />

        {/* Particle 5: Mid-Right Pink Particle */}
        <Animated.View
          style={[
            styles.particlePinkDotRight,
            { transform: [{ translateY: floatAnim2 }] },
          ]}
        />

        {/* Particle 6: Mid-Right Large Soft Purple Sphere */}
        <Animated.View
          style={[
            styles.particlePurpleOrbRight,
            { transform: [{ translateY: floatAnim4 }] },
          ]}
        />

        {/* Particle 7: Bottom-Left Blue Ring */}
        <Animated.View
          style={[
            styles.particleBottomBlueRing,
            { transform: [{ translateY: floatAnim5 }] },
          ]}
        />

        {/* Particle 8: Bottom Pink Particle near waves */}
        <Animated.View
          style={[
            styles.particleBottomPinkDot,
            { transform: [{ translateY: floatAnim6 }] },
          ]}
        />

        {/* Bottom Flowing Multi-Layer Waves */}
        <Animated.View
          style={[
            styles.bottomWaveLayer,
            {
              transform: [
                { translateX: bottomWaveTranslateX },
                { translateY: bottomWaveTranslateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#38BDF8', '#6366F1', '#A855F7', '#EC4899', '#F43F5E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.9 }}
            style={styles.bottomWaveGradient1}
          />
          <LinearGradient
            colors={['transparent', 'rgba(168, 85, 247, 0.4)', 'rgba(236, 72, 153, 0.5)', 'rgba(244, 63, 94, 0.35)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bottomWaveGradient2}
          />
        </Animated.View>
      </View>

      {/* ========================================================================= */}
      {/* 2. FOREGROUND INTERACTIVE CONTENT                                         */}
      {/* ========================================================================= */}
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
          >
            {/* Center Branding Area matching Reference Image */}
            <View style={styles.brandingSection}>
              {/* Concentric Orbital Ring behind the Logo */}
              <View style={styles.orbitalRingContainer} pointerEvents="none">
                <View style={styles.orbitalRing} />
                <View style={styles.orbitSatellitePurple} />
                <View style={styles.orbitSatelliteCyan} />
                <View style={styles.orbitSatellitePink} />
              </View>

              {/* Pulsing Ambient Halo */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.logoHaloGlow,
                  {
                    opacity: logoGlowOpacity,
                    transform: [{ scale: logoPulse }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#38BDF8', '#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.haloGradient}
                />
              </Animated.View>

              {/* Center Calling CRM Squircle Logo with handset */}
              <View style={styles.logoSquircleWrapper}>
                <LinearGradient
                  colors={['#4F46E5', '#9333EA', '#F43F5E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoSquircle}
                >
                  <Ionicons
                    name="call"
                    size={38}
                    color="#FFFFFF"
                    style={{ transform: [{ rotate: '0deg' }] }}
                  />
                  {/* Glossy top highlight */}
                  <View style={styles.logoGlossHighlight} />
                </LinearGradient>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.brandTitle}>Calling CRM</Text>
              <Text style={styles.brandSubtitle}>Sign in to your account</Text>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Email Address Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => emailInputRef.current?.focus()}
                  style={[
                    styles.inputBox,
                    focusedField === 'email' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconBox} pointerEvents="none">
                    <Ionicons name="mail-outline" size={19} color="#8B5CF6" />
                  </View>
                  <TextInput
                    ref={emailInputRef}
                    style={styles.textInputField}
                    placeholder="agent@crm.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMessage) setErrorMessage('');
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    importantForAutofill="no"
                    underlineColorAndroid="transparent"
                    editable={!loading}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Field */}
              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.inputLabel}>Password</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => passwordInputRef.current?.focus()}
                  style={[
                    styles.inputBox,
                    focusedField === 'password' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconBox} pointerEvents="none">
                    <Ionicons name="lock-closed-outline" size={19} color="#8B5CF6" />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInputField}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMessage) setErrorMessage('');
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    importantForAutofill="no"
                    underlineColorAndroid="transparent"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeToggleBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>

              {/* Sign In CTA Button */}
              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleLogin}
                activeOpacity={0.88}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signInGradient}
                >
                  <Text style={styles.signInText}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Text>
                  <View style={styles.arrowBadge}>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>

                  {/* Shimmer sweep effect */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.btnShimmerBeam,
                      { transform: [{ translateX: btnShimmerTranslate }] },
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(255, 255, 255, 0.35)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.shimmerFill}
                    />
                  </Animated.View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Server Connection Settings Button */}
            <TouchableOpacity
              style={styles.serverSettingsBtn}
              onPress={() => {
                setServerUrlInput(getApiBaseUrl());
                setTestStatus({ loading: false, message: undefined });
                setShowServerModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="server-outline" size={13} color="#6366F1" />
              <Text style={styles.serverSettingsBtnText} numberOfLines={1}>
                Server: {getApiBaseUrl().replace('https://', '').replace('http://', '')}
              </Text>
              <Ionicons name="settings-outline" size={13} color="#6366F1" />
            </TouchableOpacity>

            {/* Bottom Security Footer */}
            <View style={styles.footerSection}>
              <View style={styles.shieldIconContainer}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" />
              </View>
              <Text style={styles.footerText}>Enterprise Security & JWT Authentication</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Server Connection Settings Modal */}
        <Modal
          visible={showServerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowServerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="server" size={20} color="#4F46E5" />
                  <Text style={styles.modalTitle}>Backend Connection</Text>
                </View>
                <TouchableOpacity onPress={() => setShowServerModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Configure the backend server URL this mobile app connects to:
              </Text>

              <TextInput
                style={styles.serverModalInput}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://... or http://192.168.1.16:8080"
                placeholderTextColor="#94A3B8"
              />

              {/* Quick Presets */}
              <Text style={styles.presetsLabel}>Quick Presets:</Text>
              <View style={styles.presetButtonsRow}>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => setServerUrlInput('https://procedures-anderson-importance-drivers.trycloudflare.com/api/v1')}
                >
                  <Ionicons name="cloud-done-outline" size={14} color="#16A34A" />
                  <Text style={styles.presetBtnText}>Cloudflare HTTPS Tunnel (Recommended)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => setServerUrlInput('http://192.168.1.16:8080/api/v1')}
                >
                  <Ionicons name="wifi-outline" size={14} color="#2563EB" />
                  <Text style={styles.presetBtnText}>Local Wi-Fi (192.168.1.16:8080)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => setServerUrlInput('https://crm-b4a1.onrender.com/api/v1')}
                >
                  <Ionicons name="globe-outline" size={14} color="#7C3AED" />
                  <Text style={styles.presetBtnText}>Render Cloud Production</Text>
                </TouchableOpacity>
              </View>

              {/* Test Connection Status */}
              {testStatus.loading ? (
                <View style={styles.testStatusRow}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.testStatusText}>Testing connection...</Text>
                </View>
              ) : testStatus.message ? (
                <View style={[styles.testStatusRow, testStatus.success ? styles.testSuccess : styles.testFail]}>
                  <Ionicons
                    name={testStatus.success ? "checkmark-circle" : "alert-circle"}
                    size={16}
                    color={testStatus.success ? "#16A34A" : "#DC2626"}
                  />
                  <Text style={[styles.testStatusText, { color: testStatus.success ? "#16A34A" : "#DC2626" }]}>
                    {testStatus.message}
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={() => handleTestConnection(serverUrlInput)}
                  disabled={testStatus.loading}
                >
                  <Text style={styles.testBtnText}>Test Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.saveBtnText}>Save & Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#F8FAFE',
    position: 'relative',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  // ==========================================
  // TOP FLUID WAVES & AURAS
  // ==========================================
  topWaveLayer: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 320,
    height: 320,
  },
  topWaveGradient1: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.6,
  },
  topWaveGradient2: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.5,
  },
  topRightAura: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 260,
    height: 260,
  },
  auraFill: {
    width: '100%',
    height: '100%',
    borderRadius: 130,
  },

  // ==========================================
  // DECORATIVE DOT MATRIX (5x5 GRID)
  // ==========================================
  dotMatrixGrid: {
    position: 'absolute',
    top: 50,
    right: 22,
    width: 50,
    height: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  matrixDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C084FC',
  },

  // ==========================================
  // FLOATING PARTICLES & ORBS
  // ==========================================
  particleCyanRing: {
    position: 'absolute',
    top: 170,
    left: 18,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3.5,
    borderColor: 'rgba(56, 189, 248, 0.65)',
  },
  particleCyanDot: {
    position: 'absolute',
    top: 295,
    left: 105,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  particleMagentaDotLeft: {
    position: 'absolute',
    top: 368,
    left: 28,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  particleBlueSphere: {
    position: 'absolute',
    top: 168,
    right: 125,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  particlePinkDotRight: {
    position: 'absolute',
    top: 275,
    right: 110,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  particlePurpleOrbRight: {
    position: 'absolute',
    top: 250,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.45)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  particleBottomBlueRing: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: 'rgba(56, 189, 248, 0.65)',
  },
  particleBottomPinkDot: {
    position: 'absolute',
    bottom: 145,
    right: 120,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  // ==========================================
  // BOTTOM UNDULATING LIVE WAVES
  // ==========================================
  bottomWaveLayer: {
    position: 'absolute',
    bottom: -70,
    left: -60,
    right: -60,
    height: 260,
  },
  bottomWaveGradient1: {
    width: '120%',
    height: '100%',
    borderRadius: 180,
    opacity: 0.75,
  },
  bottomWaveGradient2: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 0,
    height: 190,
    borderRadius: 140,
    opacity: 0.6,
  },

  // ==========================================
  // CENTER BRANDING AREA
  // ==========================================
  brandingSection: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  orbitalRingContainer: {
    position: 'absolute',
    top: -16,
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitalRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.22)',
  },
  orbitSatellitePurple: {
    position: 'absolute',
    top: 4,
    left: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8B5CF6',
  },
  orbitSatelliteCyan: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38BDF8',
  },
  orbitSatellitePink: {
    position: 'absolute',
    top: 50,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#EC4899',
  },
  logoHaloGlow: {
    position: 'absolute',
    top: -4,
    width: 104,
    height: 104,
    borderRadius: 36,
  },
  haloGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    opacity: 0.45,
  },
  logoSquircleWrapper: {
    width: 82,
    height: 82,
    borderRadius: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoSquircle: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  logoGlossHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginTop: 14,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },

  // ==========================================
  // LOGIN CARD & INPUTS
  // ==========================================
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '500',
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 7,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 50,
  },
  inputBoxFocused: {
    borderColor: '#8B5CF6',
    backgroundColor: '#FFFFFF',
  },
  inputIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  textInputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    height: 46,
  },
  eyeToggleBtn: {
    padding: 6,
  },
  signInButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
  signInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  arrowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnShimmerBeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
  },
  shimmerFill: {
    width: '100%',
    height: '100%',
    transform: [{ skewX: '-25deg' }],
  },

  // ==========================================
  // BOTTOM SECURITY FOOTER
  // ==========================================
  footerSection: {
    alignItems: 'center',
    marginTop: 14,
    gap: 4,
  },
  shieldIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },

  // ==========================================
  // SERVER SETTINGS BUTTON & MODAL
  // ==========================================
  serverSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 20,
    alignSelf: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  serverSettingsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  serverModalInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetButtonsRow: {
    gap: 6,
    marginBottom: 12,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  testStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  testSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  testFail: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  testStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    flex: 1,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  testBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  saveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
