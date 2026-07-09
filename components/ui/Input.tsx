import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useState } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Typography, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  secureTextEntry,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const isPasswordField = !!secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            isPasswordField && styles.inputWithToggle,
            focused && styles.inputFocused,
            !!error && styles.inputError,
          ]}
          placeholderTextColor={Colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPasswordField ? hidden : secureTextEntry}
          {...props}
        />
        {isPasswordField && (
          <Pressable
            style={styles.toggleButton}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
          >
            <IconSymbol name={hidden ? 'eye' : 'eye.slash'} color={Colors.textMuted} size={20} />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  toggleButton: {
    position: 'absolute',
    right: 4,
    height: 50,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 5,
  },
});
