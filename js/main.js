const SETTINGS = {
  particles: {
    length: 500,
    duration: 2,
    velocity: 100,
    effect: -0.75,
    size: 30,
  },
  dateStart: "08/31/2023",
  heart: {
    scale: 0.4,
    color: "#ea80b0",
    pulseScale: 1.1,
    pulseDuration: 2,
  },
  text: {
    font: 'bold 20px "Courier New", Courier, monospace',
    color: "#d66291",
    lineHeight: 25,
  },
};

let displayMode = 0;
// ===================== Firebase setup =====================
const firebaseConfig = {
  apiKey: "AIzaSyC5N4vOJagEL30iNZlr2qJa0H_Uec-VS18",
  authDomain: "time-together-e4930.firebaseapp.com",
  projectId: "time-together-e4930",
  storageBucket: "time-together-e4930.firebasestorage.app",
  messagingSenderId: "212578067416",
  appId: "1:212578067416:web:6f3a2cb736a92716ae48ad",
  measurementId: "G-YDQS32T003",
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const authPromise = firebase
  .auth()
  .signInAnonymously()
  .catch((e) => console.error("Firebase auth error:", e));

const storage = firebase.storage();
const db = firebase.firestore();
const STORAGE_BASE_URL = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o`;

/**
 * Upload avatar lên Firebase Storage và lưu URL vào Firestore.
 * @param {File} file
 * @param {string} userKey "male" | "female"
 * @returns {Promise<string>} URL download
 */
async function uploadAvatar(file, userKey) {
  // Đảm bảo đã đăng nhập ẩn danh xong
  await authPromise;

  // Tạo tên file duy nhất theo timestamp để không ghi đè ảnh cũ
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}.${ext}`;
  const fileRef = storage.ref().child(`avatars/${userKey}/${fileName}`);
  await fileRef.put(file);
  const url = await fileRef.getDownloadURL();

  // Thêm url mới vào history và đặt thành current
  const docRef = db.collection("avatars").doc(userKey);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const data = snapshot.exists ? snapshot.data() : {};
    const history = Array.isArray(data.history) ? data.history : [];
    history.push(url);
    tx.set(docRef, { current: url, history }, { merge: true });
  });

  return url;
}

/**
 * Lắng nghe thay đổi avatar realtime và cập nhật ảnh.
 * @param {string} userKey
 * @param {HTMLImageElement} avatarElement
 */
function subscribeAvatar(userKey, avatarElement) {
  db.collection("avatars")
    .doc(userKey)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const currentUrl = data.current || data.url;
        const historyArr = Array.isArray(data.history) ? data.history : (currentUrl ? [currentUrl] : []);

        if (currentUrl) {
          avatarElement.src = currentUrl;
        } else {
          // Nếu chưa có doc, thử lấy ảnh default trên Storage, nếu thất bại mới dùng ảnh local
          const defaultUrl = `${STORAGE_BASE_URL}/avatars%2F${userKey}%2Fdefault.jpg?alt=media`;
          fetch(defaultUrl, { method: "HEAD" })
            .then((res) => {
              if (res.ok) {
                avatarElement.src = defaultUrl;
              } else {
                avatarElement.src = `img/${userKey}.jpg`;
              }
            })
            .catch(() => {
              avatarElement.src = `img/${userKey}.jpg`;
            });
        }

        // render gallery
        const galleryEl = userKey === "male" ? maleGallery : femaleGallery;
        renderGallery(userKey, galleryEl, historyArr, currentUrl);
      } else {
        // Nếu chưa có doc, thử lấy ảnh default trên Storage, nếu thất bại mới dùng ảnh local
        const defaultUrl = `${STORAGE_BASE_URL}/avatars%2F${userKey}%2Fdefault.jpg?alt=media`;
        fetch(defaultUrl, { method: "HEAD" })
          .then((res) => {
            if (res.ok) {
              avatarElement.src = defaultUrl;
            } else {
              avatarElement.src = `img/${userKey}.jpg`;
            }
          })
          .catch(() => {
            avatarElement.src = `img/${userKey}.jpg`;
          });

        // xóa gallery nếu không có dữ liệu
        const galleryEl = userKey === "male" ? maleGallery : femaleGallery;
        if (galleryEl) galleryEl.innerHTML = "";
      }
    });
}

function getDiffDaysOnly() {
  const currentDate = new Date();
  const startDate = new Date(SETTINGS.dateStart);
  return Math.floor((currentDate - startDate) / (1000 * 3600 * 24));
}

/**
 * Calculates the difference between the current date and a start date in years, months, and days.
 * @returns {{years: number, months: number, days: number}} An object containing the difference in years, months, and days.
 */
function getDiffYearMonthDay() {
  const currentDate = new Date();
  const startDate = new Date(SETTINGS.dateStart);

  if (currentDate < startDate) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = currentDate.getFullYear() - startDate.getFullYear();
  let months = currentDate.getMonth() - startDate.getMonth();
  let days = currentDate.getDate() - startDate.getDate();

  // Adjust months and years if days are negative
  if (days < 0) {
    months--;
    const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    days += prevMonthDate.getDate();
  }

  // Adjust years if months are negative
  if (months < 0) {
    years--;
    months += 12;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

class Point {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Point(this.x, this.y);
  }

  length(length) {
    if (typeof length === "undefined") {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    this.normalize();
    this.x *= length;
    this.y *= length;
    return this;
  }

  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y);
    if (len !== 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }
}

class Particle {
  constructor() {
    this.position = new Point();
    this.velocity = new Point();
    this.acceleration = new Point();
    this.age = 0;
  }

  initialize(x, y, dx, dy) {
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = dx;
    this.velocity.y = dy;
    this.acceleration.x = dx * SETTINGS.particles.effect;
    this.acceleration.y = dy * SETTINGS.particles.effect;
    this.age = 0;
  }

  update(deltaTime) {
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.velocity.x += this.acceleration.x * deltaTime;
    this.velocity.y += this.acceleration.y * deltaTime;
    this.age += deltaTime;
  }

  draw(context, image) {
    const ease = (t) => --t * t * t + 1;
    const size = image.width * ease(this.age / SETTINGS.particles.duration);
    context.globalAlpha = 1 - this.age / SETTINGS.particles.duration;
    context.drawImage(
      image,
      this.position.x - size / 2,
      this.position.y - size / 2,
      size,
      size
    );
  }
}

class ParticlePool {
  constructor(length) {
    this.particles = Array(length)
      .fill()
      .map(() => new Particle());
    this.firstActive = 0;
    this.firstFree = 0;
    this.duration = SETTINGS.particles.duration;
  }

  add(x, y, dx, dy) {
    this.particles[this.firstFree].initialize(x, y, dx, dy);
    this.firstFree = (this.firstFree + 1) % this.particles.length;
    if (this.firstActive === this.firstFree) {
      this.firstActive = (this.firstActive + 1) % this.particles.length;
    }
  }

  update(deltaTime) {
    const updateParticle = (i) => this.particles[i].update(deltaTime);

    if (this.firstActive < this.firstFree) {
      for (let i = this.firstActive; i < this.firstFree; i++) updateParticle(i);
    } else {
      for (let i = this.firstActive; i < this.particles.length; i++)
        updateParticle(i);
      for (let i = 0; i < this.firstFree; i++) updateParticle(i);
    }

    while (
      this.particles[this.firstActive].age >= this.duration &&
      this.firstActive !== this.firstFree
    ) {
      this.firstActive = (this.firstActive + 1) % this.particles.length;
    }
  }

  draw(context, image) {
    const drawParticle = (i) => this.particles[i].draw(context, image);

    if (this.firstActive < this.firstFree) {
      for (let i = this.firstActive; i < this.firstFree; i++) drawParticle(i);
    } else {
      for (let i = this.firstActive; i < this.particles.length; i++)
        drawParticle(i);
      for (let i = 0; i < this.firstFree; i++) drawParticle(i);
    }
  }
}

/**
 * Calculates a point on a heart shape curve.
 * @param {number} t - The angle in radians.
 * @param {number} [scale=1] - The scaling factor for the heart.
 * @returns {Point} A Point object representing the coordinates on the heart curve.
 */
function getPointOnHeart(t, scale = 1) {
  const baseScale = SETTINGS.heart.scale * scale;
  return new Point(
    baseScale * 160 * Math.pow(Math.sin(t), 3),
    baseScale *
      (130 * Math.cos(t) -
        50 * Math.cos(2 * t) -
        20 * Math.cos(3 * t) -
        10 * Math.cos(4 * t) +
        25)
  );
}

function createHeartImage() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = SETTINGS.particles.size;
  canvas.height = SETTINGS.particles.size;

  function to(t, scale = 1) {
    const point = getPointOnHeart(t, scale);
    point.x =
      SETTINGS.particles.size / 2 + (point.x * SETTINGS.particles.size) / 350;
    point.y =
      SETTINGS.particles.size / 2 - (point.y * SETTINGS.particles.size) / 350;
    return point;
  }

  ctx.beginPath();
  let t = -Math.PI;
  let p = to(t);
  ctx.moveTo(p.x, p.y);

  while (t < Math.PI) {
    t += 0.01;
    p = to(t);
    ctx.lineTo(p.x, p.y);
  }

  ctx.closePath();
  ctx.fillStyle = SETTINGS.heart.color;
  ctx.fill();

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function initCanvas(canvas) {
  const context = canvas.getContext("2d");
  const particles = new ParticlePool(SETTINGS.particles.length);
  const particleRate = SETTINGS.particles.length / SETTINGS.particles.duration;
  const image = createHeartImage();
  let time;
  let heartScale = 1;

  function render() {
    requestAnimationFrame(render);
    const newTime = new Date().getTime() / 1000;
    const deltaTime = newTime - (time || newTime);
    time = newTime;

    // Cập nhật tỷ lệ trái tim
    heartScale =
      1 +
      Math.sin((newTime * Math.PI) / SETTINGS.heart.pulseDuration) *
        (SETTINGS.heart.pulseScale - 1);

    context.clearRect(0, 0, canvas.width, canvas.height);

    const amount = particleRate * deltaTime;
    for (let i = 0; i < amount; i++) {
      const pos = getPointOnHeart(Math.PI - 2 * Math.PI * Math.random(), heartScale);
      const dir = pos.clone().length(SETTINGS.particles.velocity);
      particles.add(
        canvas.width / 2 + pos.x,
        canvas.height / 2 - pos.y,
        dir.x,
        -dir.y
      );
    }

    particles.update(deltaTime);
    particles.draw(context, image);

    context.font = SETTINGS.text.font;
    context.fillStyle = SETTINGS.text.color;
    context.textAlign = "center";
    context.textBaseline = "middle";

    let displayText = "";
    if (displayMode === 0) {
      displayText = `${getDiffDaysOnly()} ngày`;
      const textY = canvas.height / 2;
      context.lineWidth = 2;
      context.strokeStyle = "rgba(0,0,0,0.5)";
      context.strokeText(displayText, canvas.width / 2, textY);
      context.fillText(displayText, canvas.width / 2, textY);
    } else {
      const { years, months, days } = getDiffYearMonthDay();
      const displayLines = [];
      if (years > 0) displayLines.push(`${years} năm`);
      if (months > 0) displayLines.push(`${months} tháng`);
      if (days > 0 || (years === 0 && months === 0))
        displayLines.push(`${days} ngày`);

      const baseY = canvas.height / 2 - SETTINGS.text.lineHeight;
      displayLines.forEach((line, index) => {
        const yPos = baseY + index * SETTINGS.text.lineHeight;
        context.strokeText(line, canvas.width / 2, yPos);
        context.fillText(line, canvas.width / 2, yPos);
      });
    }
  }

  function onResize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  window.onresize = onResize;
  setTimeout(() => {
    onResize();
    render();
  }, 10);
}

// Initialize canvas
initCanvas(document.getElementById("pinkboard"));

/**
 * Toggles the music playback (play/pause) and updates the UI accordingly.
 */
function toggleMusicPlayback() {
  const musicControl = document.querySelector(".music-control");
  const musicIcon = musicControl.querySelector("i");

  if (audio.paused) {
    audio.play()
      .then(() => {
        musicControl.classList.add("playing");
        musicControl.classList.remove("paused");
        musicIcon.classList.remove("fa-play");
        musicIcon.classList.add("fa-pause");
      })
      .catch((error) => {
        console.error("Không thể phát nhạc:", error);
      });
  } else {
    audio.pause();
    musicControl.classList.remove("playing");
    musicControl.classList.add("paused");
    musicIcon.classList.remove("fa-pause");
    musicIcon.classList.add("fa-play");
  }
}

// Audio handling
const audio = document.getElementById("bgMusic");

// Loading screen handling
document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.querySelector(".loading-screen");
  const musicControl = document.querySelector(".music-control");

  // Hide loading screen after 2 seconds
  setTimeout(() => {
    loadingScreen.classList.add("fade-out");
  }, 2000);

  // Music control button click handler
  musicControl.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to document
    toggleMusicPlayback();
  });

  // Update music control state when audio play/pause events occur
  audio.addEventListener("play", () => {
    musicControl.classList.add("playing");
    musicControl.classList.remove("paused");
    musicControl.querySelector("i").classList.remove("fa-play");
    musicControl.querySelector("i").classList.add("fa-pause");
  });

  audio.addEventListener("pause", () => {
    musicControl.classList.remove("playing");
    musicControl.classList.add("paused");
    musicControl.querySelector("i").classList.remove("fa-pause");
    musicControl.querySelector("i").classList.add("fa-play");
  });

  // Attempt to play music when page loads
  audio.muted = false;
  audio.play().catch(error => {
    console.error("Music autoplay failed:", error);
    // Show play button if autoplay fails
    musicControl.classList.add("paused");
    musicControl.querySelector("i").classList.add("fa-play");
  });
});

// Touch handling for display mode
let startX = 0;
const canvas = document.getElementById("pinkboard");

canvas.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
});

canvas.addEventListener("touchend", (e) => {
  const endX = e.changedTouches[0].clientX;
  const diffX = endX - startX;
  if (Math.abs(diffX) > 50) {
    displayMode = (displayMode + 1) % 2;
  }
});

// Avatar change handling
const maleAvatar = document.getElementById("avt-male");
const femaleAvatar = document.getElementById("avt-female");
const maleFileInput = document.getElementById("file-input-male");
const femaleFileInput = document.getElementById("file-input-female");

// Gallery containers
const maleGallery = document.getElementById("male-gallery");
const femaleGallery = document.getElementById("female-gallery");

/**
 * Handles the change event for file input, updates avatar, and saves to localStorage.
 * @param {Event} event - The change event.
 * @param {HTMLElement} avatarElement - The image element to update.
 * @param {string} localStorageKey - The key for localStorage.
 */
function handleAvatarChange(event, avatarElement, localStorageKey) {
  const file = event.target.files[0];
  if (file) {
    uploadAvatar(file, localStorageKey)
      .then((url) => {
        avatarElement.src = url;
      })
      .catch((err) => console.error("Upload avatar error:", err));
  }
}

/**
 * Cập nhật gallery thumbnail và gắn sự kiện chọn avatar.
 * @param {string} userKey "male" | "female"
 * @param {HTMLElement} galleryEl
 * @param {string[]} history
 * @param {string} currentUrl
 */
function renderGallery(userKey, galleryEl, history, currentUrl) {
  if (!galleryEl) return;
  galleryEl.innerHTML = "";
  history.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.className = "thumb" + (url === currentUrl ? " active" : "");
    img.addEventListener("click", () => setCurrentAvatar(userKey, url));
    galleryEl.appendChild(img);
  });
}

/**
 * Cập nhật current avatar trong Firestore.
 * @param {string} userKey
 * @param {string} url
 */
function setCurrentAvatar(userKey, url) {
  db.collection("avatars").doc(userKey).update({ current: url }).catch(console.error);
}

maleAvatar.addEventListener("click", () => maleFileInput.click());
femaleAvatar.addEventListener("click", () => femaleFileInput.click());

maleFileInput.addEventListener("change", (e) =>
  handleAvatarChange(e, maleAvatar, "male")
);
femaleFileInput.addEventListener("change", (e) =>
  handleAvatarChange(e, femaleAvatar, "female")
);

// Không còn dùng localStorage cache avatar nữa

// Đăng ký lắng nghe avatar realtime từ Firebase
subscribeAvatar("male", maleAvatar);
subscribeAvatar("female", femaleAvatar);
