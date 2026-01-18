<div align="center">

# 🎨 Waaah-Comics

### *Create Stunning Comics with Gesture Control & AI*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.0%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand%20Tracking-00A36C?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

[Features](#-features) • [Demo](#-demo) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Team](#-meet-the-team)

---

<!-- Add your demo GIF or screenshot here -->
<img src="public/comic-hero.png" alt="Waaah-Comics Demo" width="80%">

*Transform your ideas into comic masterpieces using hand gestures and AI-powered generation*

</div>

---

## ✨ Features

### 🖐️ Gesture-Controlled Drawing
Draw touch-free using real-time hand tracking powered by **MediaPipe**. Our intuitive gesture system lets you create without touching your device.

| Gesture | Action |
|---------|--------|
| ☝️ **Point** | Draw with brush |
| ✊ **Fist** | Erase |
| 🖐️ **Open Palm** | Stop drawing |
| ✌️ **Peace Sign** | Drag toolbar |
| 🤏 **Pinch** | Alternative draw mode |

### AI-Powered Image Generation
Leverage **Google Gemini 2.0 Flash** to transform rough sketches into polished comic-style artwork with bold ink outlines, cel-shading, and vibrant colors.

- **Text-to-Image**: Generate comic assets from text prompts
- **Sketch-to-Image**: Transform drawings into professional artwork
- **Voice Commands**: Speak your prompts naturally

### Comic Studio
Professional comic creation tools with **22+ pre-built templates**:

- Classic 3-Panel, Manga Page, Webtoon Scroll
- Superhero Page, Comic Strip, Graphic Novel
- Instagram Story, Newspaper Strip, and more!
- Drag-and-drop panel arrangement
- Export as high-quality PNG

### ☁️ Cloud Sync & Projects
- Save and organize your work into projects
- Sync across devices with Clerk authentication
- Shared asset library between Gesture Canvas and Comic Studio

---

## 🎬 Demo

<!-- Add your demo video or GIF here -->
<div align="center">

https://github.com/user-attachments/assets/your-demo-video-id

*Watch Waaah-Comics in action*

</div>

---

## 🛠️ Tech Stack

<div align="center">

### Frontend
| Technology | Purpose |
|:----------:|:--------|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg" width="40"> | **Next.js 14** - React framework with App Router |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="40"> | **TypeScript** - Type-safe development |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg" width="40"> | **Tailwind CSS** - Utility-first styling |
| <img src="https://konvajs.org/favicon.ico" width="40"> | **Konva.js** - Canvas manipulation for comics |
| <img src="https://avatars.githubusercontent.com/u/32136078" width="40"> | **Clerk** - Authentication & user management |

### AI & Computer Vision
| Technology | Purpose |
|:----------:|:--------|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" width="40"> | **Google Gemini 2.0 Flash** - AI image generation |
| <img src="https://mediapipe.dev/images/mediapipe_small.png" width="40"> | **MediaPipe** - Real-time hand tracking |

### Backend & Database
| Technology | Purpose |
|:----------:|:--------|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg" width="40"> | **FastAPI** - High-performance Python API |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg" width="40"> | **Supabase** - PostgreSQL database & storage |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" width="40"> | **Python 3.11+** - Backend runtime |

</div>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────┬─────────────────────┬─────────────────────┤
│   Gesture Canvas    │    Comic Studio     │    Asset Library    │
│   ┌─────────────┐   │   ┌─────────────┐   │   ┌─────────────┐   │
│   │  MediaPipe  │   │   │  Konva.js   │   │   │   Context   │   │
│   │  Hand Track │   │   │   Canvas    │   │   │   Provider  │   │
│   └─────────────┘   │   └─────────────┘   │   └─────────────┘   │
├─────────────────────┴─────────────────────┴─────────────────────┤
│                    Gemini AI Service Layer                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  /comics/upload-panel  │  /projects/*  │  /comics/upload-video  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│    Users     │   Projects   │    Panels    │      Storage       │
│  (Clerk ID)  │   Metadata   │   Images     │   (comics_bucket)  │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **Python** 3.11+
- **pnpm** / **npm** / **yarn**
- **Supabase** account
- **Clerk** account
- **Google AI Studio** API key (for Gemini)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Waaah-Comics.git
cd Waaah-Comics
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Gemini
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

### 4. Database Setup

Run the schema in your Supabase SQL editor:

```bash
# Copy contents of backend/schema.sql to Supabase SQL Editor
```

Create a storage bucket named `comics_bucket` in Supabase Storage.

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📁 Project Structure

```
Waaah-Comics/
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router pages
│   │   │   ├── gesture/            # Gesture drawing canvas
│   │   │   ├── comic/              # Comic studio editor
│   │   │   ├── projects/           # Project management
│   │   │   └── assets/             # Asset library
│   │   ├── components/
│   │   │   ├── gesture/            # Hand tracking components
│   │   │   ├── comic/              # Comic editor components
│   │   │   └── shared/             # Shared UI components
│   │   ├── hooks/
│   │   │   └── useHandTracking.ts  # MediaPipe integration
│   │   ├── services/
│   │   │   ├── geminiService.ts    # AI generation
│   │   │   └── apiService.ts       # Backend communication
│   │   ├── context/                # React contexts
│   │   └── config/
│   │       └── templates.json      # Comic panel templates
│   └── public/
├── backend/
│   ├── main.py                     # FastAPI application
│   ├── schema.sql                  # Database schema
│   └── requirements.txt
└── README.md
```

---

## 🎨 Comic Templates

<div align="center">

| Template | Preview | Panels |
|:--------:|:-------:|:------:|
| **Classic 3-Panel** | Vertical strip layout | 3 |
| **Manga Page** | Japanese comic style | 4 |
| **2x2 Grid** | Square grid | 4 |
| **3x3 Grid** | Nine-panel grid | 9 |
| **Webtoon Scroll** | Vertical scrolling | 3 |
| **Comic Strip** | Horizontal newspaper | 3 |
| **Superhero Page** | Dynamic action layout | 6 |
| **Instagram Story** | Mobile-optimized | 3 |

*...and 14 more templates!*

</div>

---

## 👥 Meet the Team

<div align="center">

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/member1">
        <img src="https://via.placeholder.com/150" width="150px;" alt="Member 1" style="border-radius: 50%;"/>
        <br />
        <sub><b>Member Name 1</b></sub>
      </a>
      <br />
      <sub>AI Generated Eng</sub>
    </td>
    <td align="center">
      <a href="https://github.com/member2">
        <img src="https://via.placeholder.com/150" width="150px;" alt="Member 2" style="border-radius: 50%;"/>
        <br />
        <sub><b>Member Name 2</b></sub>
      </a>
      <br />
      <sub>Google Gooner</sub>
    </td>
    <td align="center">
      <a href="https://github.com/member3">
        <img src="https://via.placeholder.com/150" width="150px;" alt="Member 3" style="border-radius: 50%;"/>
        <br />
        <sub><b>Member Name 3</b></sub>
      </a>
      <br />
      <sub>Vibey Engineer</sub>
    </td>
  </tr>
 
</table>

</div>

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/comics/upload-panel` | Upload comic panel image |
| `POST` | `/comics/upload-video` | Upload AI-generated video |
| `GET` | `/projects` | List user projects |
| `POST` | `/projects` | Create new project |
| `GET` | `/projects/{id}` | Get project details |
| `PUT` | `/projects/{id}` | Update project |
| `DELETE` | `/projects/{id}` | Delete project |
| `POST` | `/projects/{id}/panels` | Add panel to project |
| `DELETE` | `/projects/{id}/panels/{panel_id}` | Remove panel |
| `GET` | `/health` | Health check |

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI image generation
- [MediaPipe](https://mediapipe.dev/) for hand tracking technology
- [Clerk](https://clerk.com/) for authentication
- [Supabase](https://supabase.com/) for database and storage
- [Konva.js](https://konvajs.org/) for canvas manipulation

---

<div align="center">

**Made with ❤️ by the Waaah-Comics Team**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/Waaah-Comics?style=social)](https://github.com/yourusername/Waaah-Comics)

</div>
