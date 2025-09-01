# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## Project Overview

**Time Together** is a Vietnamese romantic web application that displays a countdown timer showing how long a couple has been together. It is a static web application built with HTML, CSS, and JavaScript, and it uses Firebase for real-time data synchronization. Key features include a heart particle animation, profile management for two users, and background music.

## Building and Running

### Local Development

To run the project locally, you can use a simple HTTP server.

```bash
# Option 1: Using Python
python -m http.server 5500

# Option 2: Using Node.js (if you have `serve` installed)
npx serve .
```

You can also use the "Live Server" extension in Visual Studio Code.

### Firebase Operations

To upload the default avatars to Firebase Storage, you need to have the Google Cloud SDK installed and authenticated.

```bash
# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Set the project
gcloud config set project time-together-e4930

# 3. Run the upload script
./scripts/upload_default_avatars.ps1
```

## Development Conventions

*   **Code Style:** The project uses a class-based approach for the particle system in JavaScript. The CSS is structured with custom properties for theming and follows a mobile-first responsive design.
*   **Testing:** There are no automated tests in this project. Manual testing is required.
*   **Contributions:** All code and comments are in English, while the UI is in Vietnamese. Consider the cultural context when making UI changes.

## Key Files & Structure

*   `index.html`: The main entry point of the application.
*   `js/main.js`: Contains the core application logic, including the particle animation system, Firebase integration, and UI event handling. This is the primary file for most changes.
*   `css/styles.css`: The main stylesheet for the application.
*   `CLAUDE.md`: Provides detailed project documentation.
*   `.kiro/steering/`: Contains additional documentation on the product, tech, and structure.
*   `music/`: Contains the background music files.
*   `img/`: Contains the default images for the application.
