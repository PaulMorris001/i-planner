export const Colors = {
  primary: '#19235e',
  primaryLight: '#3B82F6',
  primaryDark: '#000A4D',
  accent: '#e8edec',
  accentLight: 'rgba(93, 202, 165, 0.15)',
  white: '#FFFFFF',
  offWhite: '#F7F7FB',
  textPrimary: '#0F0E2A',
  textSecondary: '#6B6A80',
  textMuted: '#A8A7BE',
  border: '#E4E3EF',
  borderFocus: '#2C23A0',
  error: '#E24B4A',
  errorBg: '#FEF2F2',
  success: '#1D9E75',
  overlay: 'rgba(26, 20, 99, 0.06)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  display:  { fontSize: 36, fontWeight: '700' as const, lineHeight: 44 },
  h1:       { fontSize: 32, fontWeight: '700' as const, lineHeight: 34 },
  h2:       { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h3:       { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  subtitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 }, // ← add this
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label:    { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};