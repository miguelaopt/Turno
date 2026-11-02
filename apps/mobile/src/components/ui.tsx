import { colors, fontFamily, fontSize, minTouchTarget, radii, spacing } from '@turno/shared/tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

// Componentes base da app, com os tokens de packages/shared/src/tokens.ts.

type Weight = keyof typeof fontFamily.native;

export function Text({
  weight = 'regular',
  muted,
  size = 'md',
  style,
  ...props
}: RNTextProps & { weight?: Weight; muted?: boolean; size?: keyof typeof fontSize }) {
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFamily.native[weight],
          fontSize: fontSize[size],
          color: muted ? colors.textMuted : colors.text,
        },
        style,
      ]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive';

export function Button({
  title,
  variant = 'primary',
  loading,
  icon,
  style,
  disabled,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  title?: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        v.container,
        !title && styles.iconButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : icon}
      {title ? (
        <Text weight="semibold" style={v.text}>
          {title}
        </Text>
      ) : null}
    </Pressable>
  );
}

const variants: Record<Variant, { container: ViewStyle; text: TextStyle & { color: string } }> = {
  primary: {
    container: { backgroundColor: colors.accent },
    text: { color: colors.accentForeground },
  },
  outline: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.accent } },
  destructive: {
    container: { backgroundColor: colors.urgent },
    text: { color: colors.urgentForeground },
  },
};

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | undefined }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text weight="semibold" size="sm">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        style={[styles.input, error ? { borderColor: colors.urgent } : null]}
        {...props}
      />
      {error ? (
        <Text size="sm" style={{ color: colors.urgent }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function WarningBox({ title, items }: { title?: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.warning} accessibilityRole="alert">
      {title ? (
        <Text weight="bold" style={{ color: colors.urgent }}>
          {title}
        </Text>
      ) : null}
      {items.map((item, i) => (
        <Text key={i} size="sm" style={{ color: colors.urgent }}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    borderRadius: radii.control,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconButton: { paddingHorizontal: 0 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.native.regular,
    fontSize: fontSize.md,
    color: colors.text,
  },
  warning: {
    backgroundColor: colors.urgentSoft,
    borderColor: colors.urgent,
    borderWidth: 1,
    borderRadius: radii.control,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
