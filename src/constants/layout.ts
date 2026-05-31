// Shared layout constants
// SafeAreaView handles bottom inset automatically.
// BottomNav is 56px fixed, no self-padding.
// Spacers only compensate for the nav height to prevent content overlap.

/** Height of the bottom nav content bar */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/** Bottom spacer for screens WITHOUT BottomNav (general scroll padding) */
export const SCREEN_BOTTOM_PADDING = 32;

/** Bottom spacer for screens WITH BottomNav: nav height + breathing room */
export const BOTTOM_NAV_SPACER = TAB_BAR_CONTENT_HEIGHT + 24;
