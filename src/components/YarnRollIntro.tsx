import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { COLORS } from '@/constants/theme';

const SHOP_LETTERS = Array.from('Tiệm Cuộn Len');

export function YarnRollIntro() {
  const { width: windowWidth } = useWindowDimensions();
  const [visible, setVisible] = useState(true);

  const isMobile = windowWidth < 640;
  // Exact width matching the "Tiệm Cuộn Len" typography so the ball rolls directly across the letters
  const trackWidth = isMobile ? Math.min(windowWidth - 48, 270) : 360;
  const ballSize = isMobile ? 48 : 60;

  // 0 -> 1 as the yarn ball rolls from left to right
  const rollProgress = useRef(new Animated.Value(0)).current;
  // 0 -> 1 for subtitle fade-in
  const subtitleFade = useRef(new Animated.Value(0)).current;
  // 1 -> 0 for overlay exit
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rollAnimation = Animated.sequence([
      Animated.delay(100),
      Animated.timing(rollProgress, {
        toValue: 1,
        duration: 1750,
        easing: Easing.bezier(0.22, 0.85, 0.32, 1),
        useNativeDriver: false,
      }),
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(420),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    rollAnimation.start(({ finished }) => {
      if (finished) {
        setVisible(false);
      }
    });

    return () => rollAnimation.stop();
  }, [rollProgress, subtitleFade, overlayOpacity]);

  if (!visible) return null;

  // Animate `left` from -ballSize/2 to trackWidth - ballSize/2 so the ball rolls across the exact text span
  const ballLeft = rollProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-ballSize * 0.2, trackWidth - ballSize * 0.35],
  });

  const ballRotate = rollProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1080deg'],
  });

  const ballBottom = rollProgress.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: [6, 15, 6, 13, 6, 11, 6, 6],
  });

  const threadWidth = rollProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, trackWidth],
  });

  const subtitleTranslateY = subtitleFade.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: overlayOpacity,
        },
      ]}
      pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setVisible(false)}
        style={styles.touchArea}>
        {/* Soft decorative background circles */}
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />

        <View style={styles.stageCard}>
          {/* Top pill badge */}
          <Animated.View style={[styles.topBadge, { opacity: rollProgress }]}>
            <Text style={styles.topBadgeText} numberOfLines={1}>
              ✦ TIỆM ĐAN MÓC THỦ CÔNG ✦
            </Text>
          </Animated.View>

          {/* Progressive Shop Name Reveal synchronized with the rolling yarn ball */}
          <View style={[styles.wordRow, { width: trackWidth }]}>
            {SHOP_LETTERS.map((char, index) => {
              const start = Math.max(0, (index / SHOP_LETTERS.length) * 0.82);
              const end = Math.min(1, start + 0.16);

              const letterOpacity = rollProgress.interpolate({
                inputRange: [0, start, end, 1],
                outputRange: [0, 0, 1, 1],
                extrapolate: 'clamp',
              });

              const letterTranslateY = rollProgress.interpolate({
                inputRange: [0, start, end, 1],
                outputRange: [14, 14, 0, 0],
                extrapolate: 'clamp',
              });

              return (
                <Animated.Text
                  key={`${char}-${index}`}
                  style={[
                    styles.shopLetter,
                    isMobile && styles.shopLetterMobile,
                    {
                      opacity: letterOpacity,
                      transform: [{ translateY: letterTranslateY }],
                    },
                  ]}>
                  {char === ' ' ? '\u00A0' : char}
                </Animated.Text>
              );
            })}
          </View>

          {/* Rolling Yarn Track & Unspooling Thread directly under the shop name */}
          <View style={[styles.trackContainer, { width: trackWidth, height: ballSize + 14 }]}>
            {/* Unspooling yarn strand left behind by the rolling ball */}
            <Animated.View
              style={[
                styles.yarnStrand,
                {
                  width: threadWidth,
                },
              ]}>
              <View style={styles.yarnStrandHighlight} />
            </Animated.View>

            {/* Rolling Yarn Ball */}
            <Animated.View
              style={[
                styles.ballWrapper,
                {
                  width: ballSize,
                  height: ballSize,
                  left: ballLeft,
                  bottom: ballBottom,
                  transform: [{ rotate: ballRotate }],
                },
              ]}>
              {Platform.OS === 'web' ? (
                <svg
                  viewBox="0 0 100 100"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <radialGradient id="yarnGrad" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#F5E6D3" />
                      <stop offset="45%" stopColor="#D8C3AD" />
                      <stop offset="85%" stopColor="#9E7758" />
                      <stop offset="100%" stopColor="#6E4F37" />
                    </radialGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="url(#yarnGrad)"
                    stroke="#5C4332"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M16 36 C 36 18, 66 20, 84 38"
                    fill="none"
                    stroke="#5C4332"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 52 C 38 34, 68 36, 88 54"
                    fill="none"
                    stroke="#5C4332"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 68 C 42 52, 66 54, 82 70"
                    fill="none"
                    stroke="#5C4332"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M34 12 C 22 38, 26 68, 44 88"
                    fill="none"
                    stroke="#7A5C45"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M52 8 C 38 36, 42 68, 62 90"
                    fill="none"
                    stroke="#7A5C45"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M68 16 C 56 40, 60 66, 76 82"
                    fill="none"
                    stroke="#7A5C45"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <ellipse
                    cx="35"
                    cy="28"
                    rx="12"
                    ry="6"
                    transform="rotate(-24 35 28)"
                    fill="#FFFDF9"
                    opacity="0.55"
                  />
                </svg>
              ) : (
                <View style={styles.nativeYarnBall}>
                  <Text style={{ fontSize: isMobile ? 32 : 40 }}>🧶</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Subtitle & Tagline */}
          <Animated.View
            style={[
              styles.subtitleWrap,
              {
                opacity: subtitleFade,
                transform: [{ translateY: subtitleTranslateY }],
              },
            ]}>
            <Text style={[styles.subtitleText, isMobile && styles.subtitleTextMobile]}>
              Đan từng mũi ấm áp • Gửi trọn yêu thương
            </Text>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#FAF5EE',
  },
  touchArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  bgCircleTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#EFE4D6',
    opacity: 0.7,
  },
  bgCircleBottom: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: '#E8D8C5',
    opacity: 0.65,
  },
  stageCard: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE4D6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#D8C3AD',
    marginBottom: 16,
  },
  topBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A5C45',
    letterSpacing: 1.2,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  shopLetter: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.darkText,
    letterSpacing: -0.5,
  },
  shopLetterMobile: {
    fontSize: 32,
    letterSpacing: -0.3,
  },
  trackContainer: {
    justifyContent: 'center',
    position: 'relative',
    marginTop: 2,
  },
  yarnStrand: {
    position: 'absolute',
    left: 0,
    bottom: 8,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#B89576',
    overflow: 'hidden',
  },
  yarnStrandHighlight: {
    height: 2,
    width: '100%',
    backgroundColor: '#E5D1BC',
  },
  ballWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeYarnBall: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7A5C45',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitleTextMobile: {
    fontSize: 13,
  },
});
