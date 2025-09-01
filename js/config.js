// ===================== Application Configuration =====================
// Centralized configuration file for the entire project

const CONFIG = {
  // Firebase Configuration
  firebase: {
    apiKey: "AIzaSyC5N4vOJagEL30iNZlr2qJa0H_Uec-VS18",
    authDomain: "time-together-e4930.firebaseapp.com",
    projectId: "time-together-e4930",
    storageBucket: "time-together-e4930.firebasestorage.app",
    messagingSenderId: "212578067416",
    appId: "1:212578067416:web:6f3a2cb736a92716ae48ad",
    measurementId: "G-YDQS32T003"
  },

  // Alternative Firebase config for login page
  firebaseLogin: {
    apiKey: "AIzaSyBsWZZhZa9RZ_2nqlWk0LFvf4YGCxNJwjk",
    authDomain: "time-together-e4930.firebaseapp.com",
    projectId: "time-together-e4930",
    storageBucket: "time-together-e4930.firebasestorage.app",
    messagingSenderId: "626261147738",
    appId: "1:626261147738:web:c4b4f65e17b2ff54a7c4be"
  },

  // Authentication Settings
  auth: {
    passcode: "310823",
    storageKeys: {
      auth: "timeTogetherAuth",
      lockout: "timeTogetherLockout",
      attempts: "timeTogetherAttempts"
    },
    lockoutSettings: {
      firstLockout: { attempts: 3, duration: 1 },    // 3 attempts = 1 minute
      secondLockout: { attempts: 5, duration: 5 },   // 5 attempts = 5 minutes  
      thirdLockout: { attempts: 10, duration: 30 }   // 10 attempts = 30 minutes
    }
  },

  // Application Settings
  app: {
    dateStart: "08/31/2023",
    loadingTimeout: 6000, // 6 seconds fallback for loading screen
    minLoadingDuration: 1000, // 1 second minimum loading time
    musicChangeHoldTime: 3000 // 3 seconds to change music
  },

  // Gallery Performance Settings
  gallery: {
    lazyLoadOffset: 2, // Load 2 images ahead
    thumbnailSize: 150, // Max thumbnail size in pixels
    loadBatchSize: 6, // Load 6 images per batch
    loadDelay: 100, // Delay between batch loads (ms)
    placeholderColor: "rgba(214, 98, 145, 0.3)" // Loading placeholder color
  },

  // Particle Animation Settings
  particles: {
    length: 500,
    duration: 2,
    velocity: 100,
    effect: -0.75,
    size: 30
  },

  // Heart Animation Settings
  heart: {
    scale: 0.4,
    color: "#ea80b0",
    pulseScale: 1.1,
    pulseDuration: 2
  },

  // Text Display Settings
  text: {
    font: 'bold 20px "Courier New", Courier, monospace',
    color: "#d66291",
    lineHeight: 25
  },

  // CSS Color Variables
  colors: {
    primary: "#d66291",
    primaryShadow: "rgba(214, 98, 145, 0.5)",
    whiteShadow: "rgba(255, 255, 255, 0.1)",
    transitionSpeed: "0.3s"
  },

  // File Paths
  paths: {
    backgroundPhone: "img/bg_phone.jpg",
    backgroundPC: "img/bg_pc.jpg",
    defaultMaleAvatar: "img/male.jpg",
    defaultFemaleAvatar: "img/female.jpg",
    music: "music/music.mp3"
  },

  // Firebase Collections
  collections: {
    avatars: "avatars",
    background: "background",
    backgroundMain: "main"
  },

  // User Profiles
  profiles: {
    male: {
      key: "male",
      name: "Trọng Nam",
      defaultImage: "img/male.jpg"
    },
    female: {
      key: "female", 
      name: "Bích Ngọc",
      defaultImage: "img/female.jpg"
    }
  }
};

// Make config globally available
window.CONFIG = CONFIG;