// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Login screen first */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Tabs after login */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
        <Stack.Screen
          name="feedbacks/feedback"
          options={{ title: "Feedback" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
