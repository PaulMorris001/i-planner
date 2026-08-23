import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';

interface GateCardProps {
  icon: IconSymbolName;
  title: string;
  subtitle: string;
  // The action buttons/links below the subtitle — content and behavior are
  // entirely up to the caller (CalendarConnectGate's connect buttons,
  // AiDisclosureGate's consent toggles + agree button, etc).
  children: ReactNode;
}

// Shared shell for a full-screen "before you can use this feature" gate —
// was independently redefined (byte-identical wrap/card/iconBadge/title/
// subtitle styles) in CalendarConnectGate.tsx and AiDisclosureGate.tsx
// before being consolidated here.
export function GateCard({ icon, title, subtitle, children }: GateCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <IconSymbol name={icon} color={Colors.primaryLight} size={26} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: Spacing.lg,
  },
});
