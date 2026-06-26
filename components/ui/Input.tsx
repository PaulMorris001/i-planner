import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useState } from 'react';
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
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
        placeholderTextColor={Colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
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
  inputFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 5,
  },
});