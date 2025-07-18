# Technology Stack

## Frontend Technologies

- **HTML5** with semantic markup and Vietnamese language support
- **CSS3** with custom properties, animations, and responsive design
- **Vanilla JavaScript** (ES6+) with modern features like async/await, classes, and modules
- **Canvas API** for heart particle animation system
- **Web Audio API** for background music control

## Backend & Services

- **Firebase v10.7.1** (compat SDK)
  - Authentication (anonymous sign-in)
  - Firestore for real-time data storage
  - Storage for image uploads
- **Google Cloud Storage** with CORS configuration

## External Dependencies

- **Google Fonts** (Poppins font family)
- **Font Awesome 6.0.0** for icons
- **Firebase SDK** loaded via CDN

## Build System

This is a **static web application** with no build process required. Files are served directly.

### Development Commands

```bash
# Serve locally (any static server)
python -m http.server 5500
# or
npx serve .
# or use Live Server extension in VS Code
```

### Deployment

- Static hosting compatible (GitHub Pages, Firebase Hosting, Netlify, etc.)
- CORS configuration required for Firebase Storage (see cors.json)
- Default avatars can be uploaded using the PowerShell script in `/scripts/`

### Firebase Setup Commands

```bash
# Upload default avatars (requires Google Cloud SDK)
gcloud auth login
gcloud config set project time-together-e4930
./scripts/upload_default_avatars.ps1
```

## Performance Considerations

- Images are optimized and cached
- Firebase real-time listeners for avatar synchronization
- Particle system optimized with object pooling
- Responsive images with different backgrounds for mobile/desktop
