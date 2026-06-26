import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function Profile() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace(Routes.WELCOME);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.root}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.sub}>Your profile settings go here.</Text>
        
        <Button 
          label="Logout" 
          onPress={handleLogout}
          variant="secondary"
          style={styles.logoutButton}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  logoutButton: {
    marginTop: Spacing.xl,
  },
});