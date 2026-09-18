import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Colors, Radius } from '@/constants/theme';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

// Module-level bridge so utils/confirmDelete.ts (called imperatively from
// plain onPress handlers all over the app — tasks, goals, classes, exams,
// habits, notes, folders) can trigger this without every one of those ~10
// call sites needing to adopt a hook. Same shape as a toast library's
// imperative API: the one mounted <ConfirmModalHost/> (see app/_layout.tsx,
// alongside NewTaskModal/TimetableUploadModal's own globally-mounted modals)
// registers itself here on mount; requestConfirm just forwards to whatever's
// currently registered.
let showConfirm: ((options: ConfirmOptions) => void) | null = null;

export function requestConfirm(options: ConfirmOptions) {
  showConfirm?.(options);
}

export function ConfirmModalHost() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    // Ignores a request while one's already showing, rather than overwriting
    // it — a rapid double-tap on two different delete buttons (nothing here
    // debounces at the call site) would otherwise silently swap the target
    // mid-flight, so a confirm tap lands on whichever request arrived last,
    // not the one the user actually saw on screen.
    showConfirm = (next) => setOptions((current) => current ?? next);
    return () => {
      showConfirm = null;
    };
  }, []);

  const close = () => setOptions(null);

  const handleConfirm = () => {
    const onConfirm = options?.onConfirm;
    close();
    onConfirm?.();
  };

  return (
    <BottomSheetModal visible={!!options} onClose={close}>
      {options && (
        <View style={styles.content}>
          <Text style={styles.title}>{options.title}</Text>
          <Text style={styles.message}>{options.message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, options.destructive && styles.confirmBtnDestructive]}
              onPress={handleConfirm}
            >
              <Text style={[styles.confirmText, options.destructive && styles.confirmTextDestructive]}>
                {options.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  confirmBtnDestructive: {
    backgroundColor: Colors.errorBg,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  confirmTextDestructive: {
    color: Colors.error,
  },
});
