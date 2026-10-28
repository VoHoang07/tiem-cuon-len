# Tiem Cuon Len — Cross-Platform Handmade Yarn & Crochet E-Commerce App

A full-stack, cross-platform e-commerce application built for a handmade crochet and yarn boutique. Developed with **React Native**, **Expo Router (SDK 54)**, **TypeScript**, and **Supabase (PostgreSQL + Auth + Storage)**, featuring automated bank transfer verification via **SePay webhooks**.

---

## Key Features

- **Cross-Platform Storefront (iOS, Android, Web)**
  - File-based routing powered by `expo-router` (`src/app/`) with responsive layouts, dark/light theme support (`ThemeContext`), custom animations (`react-native-reanimated`), and skeleton loading states.
  - Product filtering by category (`CategoryChips`), debounced search (`useDebounce`), customer reviews, and wishlist management (`FavoritesContext`).
- **End-to-End Cart, Checkout & Geolocation (`cart.tsx`, `checkout.tsx`, `useAutoLocation.ts`)**
  - Persistent shopping cart synced with Supabase (`CartContext`) and multi-address management (`AddressContext`) with GPS reverse-geocoding via `expo-location`.
  - Supports multiple payment methods (`bank_transfer` with dynamic VietQR generation, `momo`, `zalopay`, and `cod`).
- **Automated Bank Transfer Webhook (`api/sepay-webhook.js`)**
  - Serverless webhook endpoint deployed on Vercel that listens to real-time bank transaction notifications from SePay, matches order codes and amounts, and updates order status in Supabase automatically.
- **Role-Based Admin Dashboard & Live Customer Support**
  - Admin product management (`add-product.tsx`, `edit-product/`, `manage-products.tsx`) with image uploads (`expo-image-picker`) and automated product description generation.
  - Built-in customer chat widget (`ShopChatWidget.tsx`, `ChatContext.tsx`) and PostgreSQL Row-Level Security (RLS) policies separating customer and admin privileges.

---

## Architecture & Tech Stack

```text
tiem-cuon-len/
├── api/
│   └── sepay-webhook.js            # Serverless webhook for automated bank transfer verification
├── src/
│   ├── app/                        # Expo Router screens (Storefront, Cart, Checkout, Orders, Admin)
│   ├── components/                 # Reusable UI components (ProductCard, ShopChatWidget, BottomNav)
│   ├── store/                      # React Context state providers (Auth, Cart, Order, Product, Chat)
│   ├── services/
│   │   └── supabase.ts             # Supabase client initialization & API helpers
│   ├── hooks/                      # Custom hooks (useAutoLocation, useDebounce, useLogout)
│   ├── types/                      # TypeScript domain models (Product, Order, Address, PaymentMethod)
│   └── utils/                      # Currency formatting & description generators
├── supabase/migrations/            # SQL migrations for payment methods & schema updates
├── schema.sql                      # Complete PostgreSQL schema with Row-Level Security (RLS)
└── vercel.json                     # Vercel web & serverless API routing configuration
```

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React Native 0.81, Expo SDK 54, React 19, TypeScript 5.9 |
| **Navigation & UI** | Expo Router v6, React Native Reanimated v4, Lucide Icons |
| **Backend & Database** | Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Storage) |
| **Payments & Webhooks** | VietQR, SePay Webhook API (`api/sepay-webhook.js` on Vercel) |
| **Build & Deployment** | EAS Build (`eas.json`), Vercel (Web & Serverless API) |

---

## Getting Started

### Prerequisites
- **Node.js 18+** and **npm**
- **Expo Go** app on iOS/Android or an iOS Simulator / Android Emulator
- A **Supabase** project

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/VoHoang07/tiem-cuon-len.git
cd tiem-cuon-len
npm install
```

### 2. Configure Database & Environment Variables
1. Open the SQL Editor in your Supabase dashboard and execute [`schema.sql`](schema.sql) and [`supabase/migrations/payment_methods.sql`](supabase/migrations/payment_methods.sql) to create tables and Row-Level Security (RLS) policies.
2. Create a public Supabase Storage bucket named `products`.
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 3. Run the Application
```bash
# Start the Expo development server
npx expo start

# Launch directly on a target platform
npm run ios
npm run android
npm run web
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
