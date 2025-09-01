# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Time Together** is a Vietnamese romantic web application that displays a countdown timer showing how long a couple has been together. It's built as a static web application with real-time Firebase synchronization, featuring heart particle animations, dual profile management, and background music.

## Development Commands

### Local Development
```bash
# Serve locally (choose one)
python -m http.server 5500
npx serve .
# Or use Live Server extension in VS Code
```

### Firebase Operations
```bash
# Upload default avatars (requires Google Cloud SDK)
gcloud auth login
gcloud config set project time-together-e4930
./scripts/upload_default_avatars.ps1
```

## Architecture & Tech Stack

### Core Technologies
- **Static HTML/CSS/JavaScript** - No build process, files served directly
- **Firebase v10.7.1** - Anonymous auth, Firestore real-time sync, Cloud Storage
- **Canvas API** - Heart particle animation system with object pooling
- **Web Audio API** - Background music control

### Key Architecture Patterns

**JavaScript Structure:**
- Class-based particle system (`Point`, `Particle`, `ParticlePool`)
- Event-driven UI interactions
- Firebase real-time listeners for data sync
- Configuration object (`SETTINGS`) for easy customization

**CSS Architecture:**
- CSS Custom Properties for theming (`:root` variables)
- Mobile-first responsive design
- Component-based styling patterns

## Key Files & Structure

### Entry Points
- `index.html` - Main application (89 lines)
- `js/main.js` - Core logic (1,048 lines) - **START HERE for most changes**
- `css/styles.css` - Main stylesheet (835 lines)

### Critical Code Areas
- **Firebase sync:** Real-time avatar and background synchronization
- **Animation system:** Canvas heart particles with performance optimizations
- **Profile management:** Dual avatar system for both partners
- **Music system:** Random Vietnamese song selection and controls

### Firebase Data Structure
```
/avatars/{userKey}/
  - current: string (avatar URL)
  - history: array (all uploaded avatars)

/background/main/
  - current: string (background URL)
  - history: array (all uploaded backgrounds)
```

## Important Implementation Details

### Real-time Synchronization
- Avatar changes sync across devices via Firebase listeners
- Background images shared between users with 5-click upload gesture
- Anonymous authentication with persistent user keys

### Performance Considerations
- Particle system uses object pooling for smooth animations
- Images are optimized and cached
- Responsive assets for mobile/desktop

### Language Context
- UI is in Vietnamese but code/comments are in English
- Music files are Vietnamese love songs
- Consider cultural context when making UI changes

## Documentation Location

Comprehensive architecture documentation exists in `.kiro/steering/`:
- `product.md` - Feature specifications
- `tech.md` - Technology details
- `structure.md` - Code organization

**Read these files first** when working on major features or refactoring.

## Development Notes

- No build system - changes are immediately visible
- Firebase CORS already configured via `cors.json`
- Static hosting compatible (GitHub Pages, Firebase Hosting, Netlify)
- Clean separation between animation, Firebase, and UI logic in `main.js`