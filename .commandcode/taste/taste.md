# expo
- Target Expo SDK 54 (Expo Go on device is version 54.0.6). Confidence: 0.75
- Guard browser-only APIs (window/document) with `Platform.OS === "web"` check; use AppState from react-native for native app lifecycle events instead. Confidence: 0.80

# layout
- Use shared constants file `src/constants/layout.ts` for layout values (e.g., TAB_BAR_CONTENT_HEIGHT, TAB_BAR_SAFE_PADDING) instead of importing from component files. Confidence: 0.70

# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

