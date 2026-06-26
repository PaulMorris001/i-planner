import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: Variant;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export function Button({
    label,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    style,
    textStyle,
}: ButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[
                styles.base,
                styles[variant],
                isDisabled && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.85}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' ? Colors.white : Colors.primary}
                    size="small"
                />
            ) : (
                <Text style={[styles.label, styles[`${variant}Label`], textStyle]}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        height: 54,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    disabled: {
        opacity: 0.55,
    },

    // Variants
    primary: {
        backgroundColor: Colors.primary,
    },
    secondary: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    ghost: {
        backgroundColor: 'transparent',
    },

    // Labels
    label: {
        ...Typography.body,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    primaryLabel: {
        color: Colors.white,
    },
    secondaryLabel: {
        color: Colors.textPrimary,
    },
    ghostLabel: {
        color: Colors.primary,
    },
});