import { colors, spacing } from '@turno/shared/tokens';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from './ui';

export function ScreenMessage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <Card>
        <Text weight="bold" size="lg" accessibilityRole="header">
          {title}
        </Text>
        {description ? <Text muted>{description}</Text> : null}
        {children}
      </Card>
    </SafeAreaView>
  );
}

export function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel="A carregar"
    >
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
