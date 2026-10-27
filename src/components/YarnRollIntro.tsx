import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '@/constants/theme';

const INTRO_CSS = `
.yri-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #FAF5EE;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
  animation: yri-fade-out 0.42s cubic-bezier(0.4, 0, 0.2, 1) 1.75s forwards;
}
.yri-circle-top {
  position: absolute;
  top: -120px;
  right: -80px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: #EFE4D6;
  opacity: 0.7;
  pointer-events: none;
}
.yri-circle-bottom {
  position: absolute;
  bottom: -140px;
  left: -90px;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: #E8D8C5;
  opacity: 0.65;
  pointer-events: none;
}
.yri-stage {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 92vw;
}
.yri-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #EFE4D6;
  border: 1px solid #D8C3AD;
  border-radius: 999px;
  padding: 6px 16px;
  margin-bottom: 18px;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: 11px;
  font-weight: 800;
  color: #7A5C45;
  letter-spacing: 0.12em;
  white-space: nowrap;
  animation: yri-pop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.yri-track-box {
  position: relative;
  display: inline-block;
  padding: 6px 32px 24px 32px;
}
.yri-title {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: clamp(30px, 6vw, 48px);
  font-weight: 900;
  color: #3D2B1F;
  letter-spacing: -0.02em;
  line-height: 1.15;
  white-space: nowrap;
  clip-path: inset(-15% 100% -15% 0);
  animation: yri-reveal-text 1.25s cubic-bezier(0.25, 0.85, 0.35, 1) 0.12s forwards;
}
.yri-strand-track {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 10px;
  height: 5px;
  border-radius: 99px;
  overflow: hidden;
}
.yri-strand {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #E5D1BC 0%, #B89576 45%, #8C684C 100%);
  border-radius: 99px;
  transform-origin: left center;
  transform: scaleX(0);
  animation: yri-grow-strand 1.25s cubic-bezier(0.25, 0.85, 0.35, 1) 0.12s forwards;
}
.yri-ball-rail {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 56px;
  pointer-events: none;
}
.yri-ball-mover {
  position: absolute;
  top: 0;
  left: 0;
  width: 54px;
  height: 54px;
  animation: yri-roll-x 1.25s cubic-bezier(0.25, 0.85, 0.35, 1) 0.12s forwards;
}
.yri-ball-spinner {
  width: 100%;
  height: 100%;
  animation: yri-spin 1.25s cubic-bezier(0.25, 0.85, 0.35, 1) 0.12s forwards;
  filter: drop-shadow(0 5px 10px rgba(61, 43, 31, 0.2));
}
.yri-sub {
  margin-top: 12px;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: clamp(12.5px, 2.5vw, 15px);
  font-weight: 600;
  color: #7A5C45;
  letter-spacing: 0.02em;
  text-align: center;
  opacity: 0;
  transform: translateY(8px);
  animation: yri-sub-in 0.4s ease-out 1.15s forwards;
}
@media (max-width: 640px) {
  .yri-track-box {
    padding: 4px 24px 20px 24px;
  }
  .yri-ball-mover {
    width: 44px;
    height: 44px;
  }
  .yri-ball-rail {
    height: 46px;
  }
}
@keyframes yri-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes yri-reveal-text {
  0% { clip-path: inset(-15% 100% -15% 0); }
  100% { clip-path: inset(-15% 0% -15% 0); }
}
@keyframes yri-grow-strand {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
@keyframes yri-roll-x {
  0% { left: 0%; transform: translateY(0px); }
  20% { transform: translateY(-7px); }
  40% { transform: translateY(0px); }
  60% { transform: translateY(-5px); }
  80% { transform: translateY(0px); }
  100% { left: calc(100% - 48px); transform: translateY(0px); }
}
@keyframes yri-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(1080deg); }
}
@keyframes yri-sub-in {
  to { opacity: 1; transform: translateY(0); }
}
@keyframes yri-fade-out {
  0% { opacity: 1; visibility: visible; }
  99% { opacity: 0; visibility: visible; pointer-events: none; }
  100% { opacity: 0; visibility: hidden; pointer-events: none; }
}
`;

export function YarnRollIntro() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <div
        className="yri-overlay"
        onClick={() => setVisible(false)}
        role="presentation">
        <style>{INTRO_CSS}</style>
        <div className="yri-circle-top" />
        <div className="yri-circle-bottom" />

        <div className="yri-stage">
          <div className="yri-badge">✦ TIỆM ĐAN MÓC THỦ CÔNG ✦</div>

          <div className="yri-track-box">
            <h1 className="yri-title">Tiệm Cuộn Len</h1>

            <div className="yri-strand-track">
              <div className="yri-strand" />
            </div>

            <div className="yri-ball-rail">
              <div className="yri-ball-mover">
                <div className="yri-ball-spinner">
                  <svg
                    viewBox="0 0 100 100"
                    style={{ width: '100%', height: '100%', display: 'block' }}>
                    <defs>
                      <radialGradient id="yriYarnGrad" cx="35%" cy="30%" r="70%">
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
                      fill="url(#yriYarnGrad)"
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
                </div>
              </div>
            </div>
          </div>

          <div className="yri-sub">
            Đồ len thủ công • Phụ kiện & Quà tặng handmade
          </div>
        </div>
      </div>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setVisible(false)}
      style={styles.nativeOverlay}>
      <Text style={styles.nativeEmoji}>🧶</Text>
      <Text style={styles.nativeTitle}>Tiệm Cuộn Len</Text>
      <Text style={styles.nativeSub}>Đồ len thủ công • Phụ kiện & Quà tặng handmade</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  nativeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nativeEmoji: {
    fontSize: 48,
  },
  nativeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.darkText,
  },
  nativeSub: {
    fontSize: 14,
    color: '#7A5C45',
    fontWeight: '600',
  },
});
