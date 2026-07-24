import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useAuth, ReauthRequiredError } from '@/hooks/useAuth';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const { user, deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const identifier = user?.fullName?.trim() || user?.email || 'my';
  const requiredPhrase = `Delete ${identifier} account`;
  const canConfirm = confirmText === requiredPhrase;

  const reset = () => {
    setConfirmText('');
    setPassword('');
    setNeedsPassword(false);
    setSubmitting(false);
  };

  useEffect(() => {
    if (visible) reset();
  }, [visible]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
    reset();
  };

  const handleDelete = async () => {
    if (!needsPassword && !canConfirm) return;
    setSubmitting(true);
    try {
      await deleteAccount(needsPassword ? password : undefined);
      onClose();
      router.replace(Routes.WELCOME);
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        setNeedsPassword(true);
        setSubmitting(false);
        return;
      }
      const message = (err as { message?: string })?.message ?? 'Something went wrong. Please try again.';
      Alert.alert("Couldn't delete account", message);
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose}>
      <Text style={styles.title}>Delete account</Text>

      {!needsPassword ? (
        <>
          <Text style={styles.warning}>
            This permanently deletes your account and everything in it — tasks, goals, habits,
            classes, exams, and AI Coach history. This can't be undone.
          </Text>

          <Text style={styles.instructionLabel}>
            Type <Text style={styles.phrase}>{requiredPhrase}</Text> to confirm:
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={requiredPhrase}
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Button
              label={submitting ? 'Deleting…' : 'Delete account'}
              onPress={handleDelete}
              disabled={!canConfirm || submitting}
              loading={submitting}
              style={styles.deleteButton}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.warning}>
            Your account data is deleted. For security, Firebase needs your password once more to
            finish removing your sign-in — enter it to complete deletion.
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Button
              label={submitting ? 'Deleting…' : 'Confirm & delete'}
              onPress={handleDelete}
              disabled={!password || submitting}
              loading={submitting}
              style={styles.deleteButton}
            />
          </View>
        </>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  warning: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 10,
  },
  instructionLabel: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 18,
  },
  phrase: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  input: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
  },
});
