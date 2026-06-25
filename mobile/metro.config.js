// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// List of native-only modules that should be ignored on web
const webBlacklistedModules = [
  "react-native-maps",
  // Add any other native-only modules here if you get similar errors in the future
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && webBlacklistedModules.includes(moduleName)) {
    // Return an empty module to prevent Metro from bundling it for web
    return {
      type: "empty",
    };
  }
  
  // Default behavior for other module resolutions
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;