import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const SHOP_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': ['OnlineStore', 'Organization'],
  name: 'Tiệm Cuộn Len',
  alternateName: 'Tiệm Cuộn Len Handmade (tiemcuonlen.shop)',
  url: 'https://www.tiemcuonlen.shop/',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.tiemcuonlen.shop/logo-512x512.png',
    width: 512,
    height: 512,
  },
  image: 'https://www.tiemcuonlen.shop/logo-512x512.png',
  description:
    'Tiệm Cuộn Len (tiemcuonlen.shop) — Cửa hàng trực tuyến chính thức chuyên bán sẵn và nhận đặt đan móc thủ công thú bông len, móc khóa len, bó hoa len, chậu hoa kẽm nhung và phụ kiện handmade cao cấp. Giao hàng toàn quốc & Hỏa tốc 2h tại TP.HCM.',
  telephone: '+84387966507',
  email: 'vohoang1327@gmail.com',
  priceRange: '12.000₫ - 350.000₫',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Quận 8',
    addressRegion: 'TP. Hồ Chí Minh',
    addressCountry: 'VN',
  },
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <title>
          Tiệm Cuộn Len — Cửa Hàng Đồ Len Handmade, Móc Khóa, Thú Bông & Hoa Kẽm Nhung
        </title>
        <meta
          name="description"
          content="Tiệm Cuộn Len (tiemcuonlen.shop) chuyên bán sẵn và nhận đặt đan móc thủ công móc khóa len, thú bông len, bó hoa len, chậu hoa kẽm nhung quà tặng cao cấp. Giao hàng toàn quốc & Hỏa tốc 2h TP.HCM."
        />
        <meta name="application-name" content="Tiệm Cuộn Len" />
        <meta name="theme-color" content="#765341" />
        <meta
          name="google-site-verification"
          content="K6yf-g_WIZImy_CFM9JP_zi-voNoDnCJ5GRzdbT_jwo"
        />

        {/* Google Search Favicon Requirements: multiples of 48px (48x48, 96x96, 192x192) */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="48x48" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="canonical" href="https://www.tiemcuonlen.shop/" />

        {/* OpenGraph / Social Preview */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Tiệm Cuộn Len" />
        <meta
          property="og:title"
          content="Tiệm Cuộn Len — Quà Tặng Đan Móc Len & Hoa Kẽm Nhung Thủ Công"
        />
        <meta
          property="og:description"
          content="Chuyên bán sẵn & nhận đặt làm móc khóa len, thú bông len, hoa len, hoa kẽm nhung tặng kèm hộp quà. Giao hàng toàn quốc."
        />
        <meta property="og:url" content="https://www.tiemcuonlen.shop" />
        <meta
          property="og:image"
          content="https://www.tiemcuonlen.shop/logo-512x512.png"
        />

        {/* JSON-LD Structured Data for Google Logo & AI Overview */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SHOP_JSON_LD) }}
        />

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                -webkit-tap-highlight-color: transparent;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                overscroll-behavior-y: none;
              }
              * {
                -webkit-overflow-scrolling: touch;
              }
              img {
                -webkit-user-drag: none;
                user-select: none;
                backface-visibility: hidden;
              }
              ::-webkit-scrollbar {
                width: 6px;
                height: 5px;
              }
              ::-webkit-scrollbar-track {
                background: transparent;
              }
              ::-webkit-scrollbar-thumb {
                background: rgba(118, 83, 65, 0.24);
                border-radius: 999px;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: rgba(118, 83, 65, 0.42);
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
