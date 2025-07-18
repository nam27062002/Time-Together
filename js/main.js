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
    let history = Array.isArray(data.history) ? data.history : [];
    if (!history.includes(url)) {
      history.push(url);
    }
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
        const historyArr = Array.isArray(data.history)
          ? data.history
          : currentUrl
          ? [currentUrl]
          : [];

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
    const prevMonthDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0
    );
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
      const pos = getPointOnHeart(
        Math.PI - 2 * Math.PI * Math.random(),
        heartScale
      );
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
    audio
      .play()
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

// Danh sách các tệp nhạc trong thư mục music/
const musicFiles = [
  {
    src: "music/ANH LA NGOAI LÊ CUA EM - PHƯƠNG LY - OFFICIAL MV.mp3",
    title: "Anh Là Ngoại Lệ Của Em",
  },
  {
    src: "music/HOÀNG TÔN - YÊU EM RẤT NHIỀU (Lyrics Video).mp3",
    title: "Yêu Em Rất Nhiều",
  },
  {
    src: "music/Lady Gaga, Bruno Mars - Die With A Smile (Official Music Video).mp3",
    title: "Die With A Smile",
  },
  {
    src: "music/NƠI NÀY CÓ ANH - OFFICIAL MUSIC VIDEO - SƠN TÙNG M-TP.mp3",
    title: "Nơi Này Có Anh",
  },
  {
    src: "music/THƯƠNG EM ĐẾN GIÀ - LÊ BẢO BÌNH - OFFICIAL MUSIC VIDEO.mp3",
    title: "Thương Em Đến Già",
  },
  {
    src: "music/music.mp3",
    title: "Lễ Đường",
  },
];

let currentMusicIndex = 0;

// Hàm chọn ngẫu nhiên một bài hát và đặt làm nguồn cho thẻ audio
function setRandomMusic() {
  const randomIndex = Math.floor(Math.random() * musicFiles.length);
  currentMusicIndex = randomIndex;
  audio.src = musicFiles[currentMusicIndex].src;
}

// Hàm chuyển bài tiếp theo
function nextMusic() {
  currentMusicIndex = (currentMusicIndex + 1) % musicFiles.length;
  const wasPlaying = !audio.paused;
  audio.src = musicFiles[currentMusicIndex].src;
  if (wasPlaying) {
    audio.play().catch(console.error);
  }
  showMusicTitle();
}

// Hàm chuyển bài ngẫu nhiên
function randomMusic() {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * musicFiles.length);
  } while (newIndex === currentMusicIndex && musicFiles.length > 1);

  currentMusicIndex = newIndex;
  const wasPlaying = !audio.paused;
  audio.src = musicFiles[currentMusicIndex].src;
  if (wasPlaying) {
    audio.play().catch(console.error);
  }
  showMusicTitle();
}

// Hàm hiển thị tên bài hát tạm thời
function showMusicTitle() {
  const currentSong = musicFiles[currentMusicIndex];

  // Tạo element hiển thị tên bài hát
  let titleElement = document.getElementById("music-title-display");
  if (!titleElement) {
    titleElement = document.createElement("div");
    titleElement.id = "music-title-display";
    titleElement.className = "music-title-display";
    document.body.appendChild(titleElement);
  }

  titleElement.textContent = currentSong.title;
  titleElement.classList.remove("fade-out");
  titleElement.classList.add("fade-in");

  // Ẩn sau 3 giây
  setTimeout(() => {
    titleElement.classList.remove("fade-in");
    titleElement.classList.add("fade-out");
  }, 3000);
}

// Loading screen handling
document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.querySelector(".loading-screen");
  const musicControl = document.querySelector(".music-control");

  // Gọi hàm để đặt nhạc ngẫu nhiên khi trang tải
  setRandomMusic();

  // Helper functions
  window.showLoading = () => {
    loadingScreen.classList.remove("fade-out");
  };
  window.hideLoading = () => {
    loadingScreen.classList.add("fade-out");
  };

  showLoading();

  // Chỉ ẩn loading khi 2 avatar chính đã load hoặc sau 6s fallback
  let avatarLoadedCount = 0;
  const checkAvatarLoaded = () => {
    avatarLoadedCount++;
    if (avatarLoadedCount >= 2) hideLoading();
  };

  [maleAvatar, femaleAvatar].forEach((img) => {
    if (img.complete) {
      checkAvatarLoaded();
    } else {
      img.addEventListener("load", checkAvatarLoaded);
      img.addEventListener("error", checkAvatarLoaded);
    }
  });

  setTimeout(hideLoading, 6000);

  // Music control button gesture handlers
  let pressTimer = null;
  let lastTapTime = 0;
  let tapCount = 0;

  // Touch/Mouse down - start long press timer
  const startPress = (e) => {
    e.stopPropagation();
    pressTimer = setTimeout(() => {
      // Long press detected - next song
      nextMusic();
      pressTimer = null;
    }, 800); // 800ms for long press
  };

  // Touch/Mouse up - handle tap or cancel long press
  const endPress = (e) => {
    e.stopPropagation();

    if (pressTimer) {
      // Short press - check for double tap
      clearTimeout(pressTimer);
      pressTimer = null;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime;

      if (timeDiff < 300 && tapCount === 1) {
        // Double tap detected - random song
        tapCount = 0;
        randomMusic();
      } else {
        // Single tap - toggle play/pause
        tapCount = 1;
        lastTapTime = currentTime;
        setTimeout(() => {
          if (tapCount === 1) {
            toggleMusicPlayback();
          }
          tapCount = 0;
        }, 300);
      }
    }
  };

  // Cancel long press on mouse/touch leave
  const cancelPress = (e) => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  // Add event listeners for both touch and mouse
  musicControl.addEventListener("mousedown", startPress);
  musicControl.addEventListener("mouseup", endPress);
  musicControl.addEventListener("mouseleave", cancelPress);

  musicControl.addEventListener("touchstart", startPress);
  musicControl.addEventListener("touchend", endPress);
  musicControl.addEventListener("touchcancel", cancelPress);

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

  // Attempt silent autoplay: start muted
  audio.muted = true;
  audio.play().catch(() => {}); // ignore errors in silent mode

  // On first user interaction, unmute and play if paused
  const resumeAudio = () => {
    audio.muted = false;
    if (audio.paused) {
      audio.play().catch(() => {});
    }
    document.removeEventListener("pointerdown", resumeAudio);
  };
  document.addEventListener("pointerdown", resumeAudio, { once: true });
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
const bgFileInput = document.getElementById("file-input-bg");

// Modal elements
const avatarModal = document.getElementById("avatar-modal");
const modalGallery = document.getElementById("modal-gallery");
const closeModalBtn = document.getElementById("close-modal-btn");
const uploadNewBtn = document.getElementById("upload-new-btn");

// Confirm modal elements
const confirmModal = document.getElementById("confirm-modal");
const confirmYesBtn = document.getElementById("confirm-yes");
const confirmNoBtn = document.getElementById("confirm-no");

function showConfirm() {
  return new Promise((resolve) => {
    confirmModal.classList.remove("hidden");

    const cleanup = (result) => {
      confirmModal.classList.add("hidden");
      confirmYesBtn.removeEventListener("click", yesHandler);
      confirmNoBtn.removeEventListener("click", noHandler);
      resolve(result);
    };

    const yesHandler = () => cleanup(true);
    const noHandler = () => cleanup(false);

    confirmYesBtn.addEventListener("click", yesHandler);
    confirmNoBtn.addEventListener("click", noHandler);
  });
}

let currentUserKey = null;

function openAvatarModal(userKey) {
  currentUserKey = userKey;
  avatarModal.classList.remove("hidden");
  fetchAvatarHistory(userKey).then(({ history, current }) => {
    renderModalGallery(userKey, history, current);
  });
}

function hideAvatarModal() {
  avatarModal.classList.add("hidden");
}

closeModalBtn.addEventListener("click", hideAvatarModal);

uploadNewBtn.addEventListener("click", () => {
  hideAvatarModal();
  if (!currentUserKey) return;
  if (currentUserKey === "male") {
    maleFileInput.click();
  } else {
    femaleFileInput.click();
  }
});

/**
 * Tải dữ liệu avatar (current & history) cho modal
 */
function fetchAvatarHistory(userKey) {
  return db
    .collection("avatars")
    .doc(userKey)
    .get()
    .then((snap) => {
      const defaultUrl = `${STORAGE_BASE_URL}/avatars%2F${userKey}%2Fdefault.jpg?alt=media`;

      if (!snap.exists) {
        return { current: defaultUrl, history: [] };
      }

      const data = snap.data();
      const current = data.current || data.url || defaultUrl;
      let history = Array.isArray(data.history) ? data.history : [];
      if (!history.includes(defaultUrl)) {
        history.unshift(defaultUrl);
      }
      return { current, history };
    });
}

function renderModalGallery(userKey, history, currentUrl) {
  modalGallery.innerHTML = "";
  const urls = [];
  if (currentUrl) urls.push(currentUrl);
  history.forEach((u) => {
    if (u && !urls.includes(u)) urls.push(u);
  });

  urls.forEach((url) => {
    const wrapper = document.createElement("div");
    wrapper.className = "thumb-wrapper";

    const img = document.createElement("img");
    img.src = url;
    img.className = "thumb" + (url === currentUrl ? " active" : "");
    img.addEventListener("click", () => {
      setCurrentAvatar(userKey, url);
      hideAvatarModal();
    });
    wrapper.appendChild(img);

    // nút xoá, trừ default
    const defaultUrl = getDefaultUrl(userKey);
    if (url !== defaultUrl) {
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteAvatar(userKey, url);
      });
      wrapper.appendChild(delBtn);
    }

    modalGallery.appendChild(wrapper);
  });
}

// Gallery containers (now null because inline gallery removed)
const maleGallery = null;
const femaleGallery = null;

/**
 * Handles the change event for file input, updates avatar, and saves to localStorage.
 * @param {Event} event - The change event.
 * @param {HTMLElement} avatarElement - The image element to update.
 * @param {string} localStorageKey - The key for localStorage.
 */
function handleAvatarChange(event, avatarElement, localStorageKey) {
  const file = event.target.files[0];
  if (file) {
    if (typeof showLoading === "function") showLoading();
    uploadAvatar(file, localStorageKey)
      .then((url) => {
        // đợi ảnh tải xong mới ẩn loading
        const imgPreload = new Image();
        imgPreload.onload = () => {
          if (typeof hideLoading === "function") hideLoading();
        };
        imgPreload.onerror = () => {
          if (typeof hideLoading === "function") hideLoading();
        };
        imgPreload.src = url;
      })
      .catch((err) => {
        console.error("Upload avatar error:", err);
        if (typeof hideLoading === "function") hideLoading();
        hideAvatarModal();
      });
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
  history
    .filter((url) => url && url !== currentUrl)
    .forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.className = "thumb";
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
  db.collection("avatars")
    .doc(userKey)
    .update({ current: url })
    .catch(console.error);
}

function getDefaultUrl(userKey) {
  return `${STORAGE_BASE_URL}/avatars%2F${userKey}%2Fdefault.jpg?alt=media`;
}

/**
 * Xoá avatar khỏi Storage và Firestore history (không áp dụng với default).
 */
function deleteAvatar(userKey, url) {
  const defaultUrl = getDefaultUrl(userKey);
  if (url === defaultUrl) return; // không xoá default

  showConfirm().then((ok) => {
    if (!ok) return;

    // 1. Xoá file khỏi Storage
    storage
      .refFromURL(url)
      .delete()
      .catch((err) => console.error("Delete storage error", err));

    // 2. Cập nhật Firestore
    const docRef = db.collection("avatars").doc(userKey);
    db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;
      let data = snap.data();
      let history = Array.isArray(data.history) ? data.history : [];
      history = history.filter((u) => u !== url);

      // Nếu url đang là current -> chuyển về default hoặc phần tử đầu tiên còn lại
      let current = data.current;
      if (current === url) {
        current = history.length ? history[0] : defaultUrl;
      }

      tx.set(docRef, { history, current }, { merge: true });
    })
      .then(() => hideAvatarModal())
      .catch(console.error);
  });
}

// ================= Background change logic =================

/**
 * Cập nhật ảnh nền trang
 */
function setBackground(url) {
  document.body.style.setProperty(
    "background-image",
    `url('${url}')`,
    "important"
  );
}

function preloadBackground(url) {
  showLoading();
  const img = new Image();
  img.onload = () => {
    setBackground(url);
    hideLoading();
  };
  img.onerror = hideLoading;
  img.src = url;
}

// Lấy background từ Firestore
function subscribeBackground() {
  db.collection("background")
    .doc("main")
    .onSnapshot((snap) => {
      if (snap.exists) {
        const data = snap.data();
        if (data.current) preloadBackground(data.current);
      }
    });
}

subscribeBackground();

/** Upload background */
async function uploadBackground(file) {
  await authPromise;
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}.${ext}`;
  const fileRef = storage.ref().child(`background/${fileName}`);
  await fileRef.put(file);
  const url = await fileRef.getDownloadURL();

  const docRef = db.collection("background").doc("main");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};
    let history = Array.isArray(data.history) ? data.history : [];
    if (!history.includes(url)) history.push(url);
    tx.set(docRef, { current: url, history }, { merge: true });
  });
  return url;
}

bgFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showLoading();
  uploadBackground(file)
    .then((url) => {
      preloadBackground(url);
    })
    .catch((err) => {
      console.error("Upload background error", err);
      hideLoading();
    });
});

// Trigger 5-click detection on document
let clickCounter = 0;
let clickTimeout = null;

document.addEventListener("click", (e) => {
  // tránh tính click trên modal
  if (e.target.closest(".avatar-modal")) return;

  clickCounter++;
  if (clickCounter >= 5) {
    clickCounter = 0;
    bgFileInput.click();
  }

  clearTimeout(clickTimeout);
  clickTimeout = setTimeout(() => {
    clickCounter = 0;
  }, 800);
});

maleAvatar.addEventListener("click", () => openAvatarModal("male"));
femaleAvatar.addEventListener("click", () => openAvatarModal("female"));

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
