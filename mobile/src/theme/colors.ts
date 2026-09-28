export const colors = {
  // Backgrounds - Modern light luxury canvas with soft lavender/pearl tint
  background: '#F6F8FD',
  backgroundLight: '#F0F4FC',
  surface: '#FFFFFF',
  surfaceMuted: 'rgba(244, 247, 254, 0.85)',
  surfaceElevated: '#FFFFFF',
  surfaceCard: 'rgba(255, 255, 255, 0.92)',
  surfaceHighlight: '#EDE9FE',
  surfaceGlass: 'rgba(255, 255, 255, 0.88)',
  surfaceGlassSubtle: 'rgba(255, 255, 255, 0.45)',
  surfaceGlassDense: 'rgba(255, 255, 255, 0.96)',

  // Borders - Crisp glassmorphism borders
  border: 'rgba(226, 232, 240, 0.85)',
  borderLight: 'rgba(238, 242, 250, 0.8)',
  borderFocus: '#6366F1',
  borderCard: 'rgba(255, 255, 255, 0.95)',
  borderGlass: 'rgba(255, 255, 255, 0.75)',
  borderGlassSubtle: 'rgba(226, 232, 240, 0.65)',

  // Texts
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Accents & Gradients
  primary: '#4F46E5',
  primaryElectric: '#2563EB',
  primaryViolet: '#7C3AED',
  primaryPurple: '#9333EA',
  primaryMagenta: '#C026D3',
  primaryCyan: '#06B6D4',
  primaryDark: '#1E1B4B',
  primaryLight: '#EEF2FF',
  primaryGlow: 'rgba(99, 102, 241, 0.28)',
  secondary: '#6366F1',
  secondaryLight: '#F5F3FF',

  // Gradients (LinearGradient tuples)
  primaryGradient: ['#2563EB', '#7C3AED', '#C026D3'] as [string, string, string],
  primaryButtonGradient: ['#2563EB', '#7C3AED', '#D946EF'] as [string, string, string],
  violetPinkGradient: ['#7C3AED', '#C026D3', '#EC4899'] as [string, string, string],
  cyanBlueGradient: ['#06B6D4', '#3B82F6', '#6366F1'] as [string, string, string],
  blueVioletGradient: ['#2563EB', '#6366F1', '#8B5CF6'] as [string, string, string],
  heroGradient: ['#2563EB', '#6366F1', '#9333EA', '#D946EF'] as [string, string, string, string],
  heroAttendanceGradient: ['#2563EB', '#7C3AED', '#C026D3', '#EC4899'] as [string, string, string, string],
  cardGlowGradient: ['#3B82F6', '#7C3AED', '#D946EF'] as [string, string, string],
  logoutGradient: ['#EF4444', '#EC4899'] as [string, string],
  progressGradient: ['#06B6D4', '#3B82F6', '#7C3AED', '#D946EF'] as [string, string, string, string],
  quoteGradient: ['#EDE9FE', '#F5F3FF'] as [string, string],
  trophyGradient: ['#6366F1', '#9333EA'] as [string, string],
  avatarGradient: ['#3B82F6', '#7C3AED', '#C026D3'] as [string, string, string],
  glassShineGradient: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)'] as [string, string, string],

  // Icon & Tile Micro-Gradients
  blueTileGradient: ['#2563EB', '#60A5FA'] as [string, string],
  purpleTileGradient: ['#7C3AED', '#A78BFA'] as [string, string],
  magentaTileGradient: ['#C026D3', '#F472B6'] as [string, string],
  orangeTileGradient: ['#EA580C', '#FB923C'] as [string, string],
  greenTileGradient: ['#059669', '#34D399'] as [string, string],
  cyanTileGradient: ['#0891B2', '#38BDF8'] as [string, string],
  pinkTileGradient: ['#DB2777', '#F472B6'] as [string, string],

  // Tab-Specific Gradients & Glows
  tabGradients: {
    home: ['#2563EB', '#7C3AED', '#C026D3'] as [string, string, string],
    leads: ['#1D4ED8', '#6366F1', '#9333EA'] as [string, string, string],
    dial: ['#0284C7', '#06B6D4', '#3B82F6'] as [string, string, string],
    analytics: ['#7C3AED', '#C026D3', '#EC4899'] as [string, string, string],
    reports: ['#7C3AED', '#C026D3', '#EC4899'] as [string, string, string],
    admin: ['#4F46E5', '#7C3AED', '#C026D3'] as [string, string, string],
    settings: ['#4F46E5', '#6366F1', '#8B5CF6'] as [string, string, string],
  },
  tabAtmosphere: {
    home: ['rgba(37, 99, 235, 0.12)', 'rgba(124, 58, 237, 0.10)', 'rgba(217, 70, 239, 0.06)', 'transparent'] as [string, string, string, string],
    leads: ['rgba(29, 78, 216, 0.12)', 'rgba(99, 102, 241, 0.10)', 'rgba(147, 51, 234, 0.06)', 'transparent'] as [string, string, string, string],
    dial: ['rgba(6, 182, 212, 0.14)', 'rgba(59, 130, 246, 0.10)', 'rgba(124, 58, 237, 0.06)', 'transparent'] as [string, string, string, string],
    analytics: ['rgba(124, 58, 237, 0.12)', 'rgba(192, 38, 211, 0.10)', 'rgba(236, 72, 153, 0.06)', 'transparent'] as [string, string, string, string],
    reports: ['rgba(124, 58, 237, 0.12)', 'rgba(192, 38, 211, 0.10)', 'rgba(236, 72, 153, 0.06)', 'transparent'] as [string, string, string, string],
    admin: ['rgba(79, 70, 229, 0.12)', 'rgba(124, 58, 237, 0.10)', 'rgba(192, 38, 211, 0.06)', 'transparent'] as [string, string, string, string],
    settings: ['rgba(79, 70, 229, 0.12)', 'rgba(99, 102, 241, 0.10)', 'transparent'] as [string, string, string],
  },

  // Semantic Status Tints
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#2563EB',
  infoLight: '#EFF6FF',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',

  // Pastel Categories
  pastelBlue: '#EFF6FF',
  pastelBlueText: '#2563EB',
  pastelGreen: '#ECFDF5',
  pastelGreenText: '#059669',
  pastelOrange: '#FFF7ED',
  pastelOrangeText: '#EA580C',
  pastelPurple: '#F5F3FF',
  pastelPurpleText: '#7C3AED',
  pastelRed: '#FEF2F2',
  pastelRedText: '#DC2626',
  pastelPink: '#FDF2F8',
  pastelPinkText: '#DB2777',

  // Dialpad / Actions
  callGreen: '#059669',
  callRed: '#DC2626',

  // Attendance Check-In / Check-Out Pastel States
  attendanceCheckInNeutralBg: '#FFFFFF',
  attendanceCheckInNeutralBorder: 'rgba(255, 255, 255, 0.8)',
  attendanceCheckInNeutralText: '#1E293B',
  attendanceCheckInActiveBg: '#ECFDF5',
  attendanceCheckInActiveBorder: '#A7F3D0',
  attendanceCheckInActiveText: '#065F46',
  attendanceCheckOutBg: '#FEF2F2',
  attendanceCheckOutBorder: '#FECACA',
  attendanceCheckOutText: '#991B1B',
};
