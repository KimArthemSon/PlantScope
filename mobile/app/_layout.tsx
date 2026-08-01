// app/_layout.tsx
import { useEffect } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AlertProvider } from "@/components/AlertContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function checkForUpdate() {
      try {
        // Safety check: Only run this if updates are enabled (skips local dev/Expo Go)
        if (!Updates.isEnabled) {
          return;
        }

        // 1. Check if an update is available on the 'preview' channel
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          // 2. Download the new JavaScript/Assets in the background
          await Updates.fetchUpdateAsync();
          
          // 3. Force the app to immediately reload with the new code
          await Updates.reloadAsync();
        }
      } catch (error) {
        // Log error silently so it doesn't crash the app if offline
        console.log("Error checking for OTA updates:", error);
      }
    }

    checkForUpdate();
  }, []);

  return (
    <AlertProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* Login screen first */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="homepage" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="privacy_policy" options={{ headerShown: false }} />
          <Stack.Screen name="terms_and_conditions" options={{ headerShown: false }} />
          <Stack.Screen name="feedbacks" options={{ headerShown: false }} />
          <Stack.Screen name="tree_growers" options={{ headerShown: false }} />

          {/* Tabs after login */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="editProfile" options={{ headerShown: false }} />

          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AlertProvider>
  );
}