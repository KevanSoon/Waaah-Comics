# PanelPop Studio

A unified Next.js application combining gesture-controlled drawing with comic panel creation.

## Features

### Gesture Canvas
- Draw touch-free using hand gestures tracked via MediaPipe
- Pinch to draw, open palm to stop
- Voice commands for AI image generation
- Transform sketches into polished artwork with Gemini AI

### Comic Studio
- Drag-and-drop comic panel layouts
- Multiple template options (3-panel, 2x2 grid, hero shot, horizontal strip)
- AI-powered image generation for comic assets
- Export finished comics as PNG
- Save and load comics (authenticated users)

### Shared Asset Library
- Assets created in either tool are available in both
- Download or delete assets from the central library
- Cloud-synced for authenticated users

### User Authentication
- Clerk authentication for personalized experience
- User-specific asset galleries
- Save and sync comics across sessions

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables in `.env.local`:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Clerk URLs (optional)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Gemini (for local generation fallback)
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Clerk Setup

1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your publishable key and secret key to `.env.local`
4. Configure the JWKS URL in your backend `.env`:
   ```
   CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
   ```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Canvas (Comic)**: Konva.js / react-konva
- **Canvas (Gesture)**: HTML5 Canvas API
- **Hand Tracking**: MediaPipe Tasks Vision
- **AI Generation**: Google Gemini 2.0 Flash
- **Backend**: FastAPI (Python)
- **Icons**: Lucide React
