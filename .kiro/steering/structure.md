# Project Structure

## Root Files

- `index.html` - Main application entry point with Vietnamese language support
- `cors.json` - Firebase Storage CORS configuration for cross-origin requests

## Directory Organization

### `/css/`

- `styles.css` - Main stylesheet with CSS custom properties, animations, and responsive design

### `/js/`

- `main.js` - Core application logic including:
  - Firebase configuration and initialization
  - Canvas heart animation system with particle pooling
  - Avatar management and real-time synchronization
  - Music control and random song selection
  - Background image handling
  - Touch/click event handling

### `/img/`

- `bg_pc.jpg` - Desktop background image
- `bg_phone.jpg` - Mobile background image
- `favicon.png` - Site favicon and loading screen icon
- `male.jpg` - Default male avatar
- `female.jpg` - Default female avatar

### `/music/`

Contains Vietnamese love songs in MP3 format:

- `music.mp3` - Primary background music
- Various Vietnamese songs for random selection

### `/scripts/`

- `note.txt` - Development notes
- `upload_default_avatars.ps1` - PowerShell script for uploading default avatars to Firebase Storage

### `/.kiro/`

- Kiro IDE configuration and steering rules

## Code Organization Patterns

### JavaScript Architecture

- **Class-based approach** for particle system (`Point`, `Particle`, `ParticlePool`)
- **Modular functions** for Firebase operations (`uploadAvatar`, `subscribeAvatar`)
- **Event-driven architecture** for UI interactions
- **Configuration object** (`SETTINGS`) for easy customization

### CSS Architecture

- **CSS Custom Properties** for theming (`:root` variables)
- **Mobile-first responsive design** with media queries
- **Component-based styling** (`.profile`, `.music-control`, etc.)
- **Animation keyframes** for visual effects

### Firebase Data Structure

```
/avatars/{userKey}/
  - current: string (current avatar URL)
  - history: array (all uploaded avatar URLs)

/background/main/
  - current: string (current background URL)
  - history: array (all uploaded background URLs)
```

## File Naming Conventions

- Kebab-case for CSS classes (`.music-control`, `.avatar-modal`)
- camelCase for JavaScript variables and functions
- Descriptive file names in English despite Vietnamese UI content
