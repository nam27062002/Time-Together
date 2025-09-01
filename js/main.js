// Use centralized config
const SETTINGS = {
  particles: CONFIG.particles,
  dateStart: CONFIG.app.dateStart,
  heart: CONFIG.heart,
  text: CONFIG.text,
};

let displayMode = 0;
// ===================== Firebase setup =====================
const firebaseConfig = CONFIG.firebase;

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
  const docRef = db.collection(CONFIG.collections.avatars).doc(userKey);
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
  db.collection(CONFIG.collections.avatars)
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
    // Đảm bảo canvas luôn vuông để border-radius: 50% tạo ra hình tròn hoàn hảo
    const size = Math.min(canvas.clientWidth, canvas.clientHeight);
    canvas.width = size;
    canvas.height = size;
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
  const musicControl = document.querySelector(".music-control");

  // Gọi hàm để đặt nhạc ngẫu nhiên khi trang tải
  setRandomMusic();

  // Show loading screen
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

  setTimeout(hideLoading, CONFIG.app.loadingTimeout);

  // Simple click handler for music control - only toggle play/pause
  musicControl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMusicPlayback();
  });

  // Touch/hover anywhere for 3 seconds to change song
  let changeTimer = null;
  let isActive = false;
  let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const startChangeTimer = () => {
    if (!isActive) {
      isActive = true;
      changeTimer = setTimeout(() => {
        if (isActive) {
          nextMusic();
          isActive = false;
        }
      }, CONFIG.app.musicChangeHoldTime);
    }
  };

  const endChangeTimer = () => {
    isActive = false;
    if (changeTimer) {
      clearTimeout(changeTimer);
      changeTimer = null;
    }
  };


  if (isMobile) {
    // Mobile: Use swipe up gesture or double tap anywhere on screen
    let touchStartY = 0;
    let lastTapTime = 0;
    let tapCount = 0;
    
    document.addEventListener("touchstart", (e) => {
      // Ignore touches on interactive elements
      if (e.target.closest('.music-control, .avt, .modal, button, input')) return;
      
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      // Ignore touches on interactive elements
      if (e.target.closest('.music-control, .avt, .modal, button, input')) return;
      
      const touchEndY = e.changedTouches[0].clientY;
      const swipeDistance = touchStartY - touchEndY;
      const currentTime = Date.now();
      
      // Check for swipe up (at least 100px)
      if (swipeDistance > 100) {
        nextMusic();
        return;
      }
      
      // Check for double tap
      if (currentTime - lastTapTime < 300) {
        tapCount++;
        if (tapCount === 2) {
          nextMusic();
          tapCount = 0;
          return;
        }
      } else {
        tapCount = 1;
      }
      
      lastTapTime = currentTime;
      
      // Reset tap count after delay
      setTimeout(() => {
        tapCount = 0;
      }, 300);
    }, { passive: true });

  } else {
    // Desktop: Use hover
    document.body.addEventListener("mouseenter", startChangeTimer);
    document.body.addEventListener("mouseleave", endChangeTimer);
    document.body.addEventListener("mousemove", startChangeTimer);
  }

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
  
  // Show loading indicator
  const loadingEl = document.createElement("div");
  loadingEl.className = "gallery-loading";
  loadingEl.innerHTML = "💖 Đang tải ảnh...";
  modalGallery.appendChild(loadingEl);
  
  const urls = [];
  if (currentUrl) urls.push(currentUrl);
  history.forEach((u) => {
    if (u && !urls.includes(u)) urls.push(u);
  });

  // Remove loading after a short delay
  setTimeout(() => {
    modalGallery.innerHTML = "";
    renderGalleryImages(userKey, urls, currentUrl);
  }, 200);
}

function renderGalleryImages(userKey, urls, currentUrl) {
  const batchSize = CONFIG.gallery.loadBatchSize;
  const loadDelay = CONFIG.gallery.loadDelay;
  
  // Create all wrappers first for layout stability
  const fragments = document.createDocumentFragment();
  const imageElements = [];
  
  urls.forEach((url, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "thumb-wrapper";
    
    // Create placeholder
    const placeholder = document.createElement("div");
    placeholder.className = "thumb-placeholder";
    placeholder.style.cssText = `
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${CONFIG.gallery.placeholderColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    `;
    placeholder.innerHTML = "💖";
    wrapper.appendChild(placeholder);

    // Add delete button if not default
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

    fragments.appendChild(wrapper);
    imageElements.push({ wrapper, placeholder, url, index });
  });
  
  modalGallery.appendChild(fragments);
  
  // Load images in batches
  loadImagesBatch(userKey, imageElements, currentUrl, 0);
}

function loadImagesBatch(userKey, imageElements, currentUrl, batchStart) {
  const batchSize = CONFIG.gallery.loadBatchSize;
  const loadDelay = CONFIG.gallery.loadDelay;
  const batchEnd = Math.min(batchStart + batchSize, imageElements.length);
  
  // Load current batch
  for (let i = batchStart; i < batchEnd; i++) {
    const element = imageElements[i];
    loadSingleImage(userKey, element, currentUrl);
  }
  
  // Schedule next batch
  if (batchEnd < imageElements.length) {
    setTimeout(() => {
      loadImagesBatch(userKey, imageElements, currentUrl, batchEnd);
    }, loadDelay);
  }
}

function loadSingleImage(userKey, element, currentUrl) {
  const { wrapper, placeholder, url } = element;
  
  const img = new Image();
  img.onload = () => {
    // Replace placeholder with loaded image
    img.className = "thumb" + (url === currentUrl ? " active" : "");
    img.style.cssText = "opacity: 0; transition: opacity 0.3s ease;";
    
    img.addEventListener("click", () => {
      setCurrentAvatar(userKey, url);
      hideAvatarModal();
    });
    
    wrapper.replaceChild(img, placeholder);
    
    // Fade in
    setTimeout(() => {
      img.style.opacity = "1";
    }, 10);
  };
  
  img.onerror = () => {
    // Show error state
    placeholder.innerHTML = "❌";
    placeholder.style.background = "rgba(255, 0, 0, 0.2)";
  };
  
  // Add Firebase cache parameters for better caching
  const optimizedUrl = url.includes('?') 
    ? `${url}&w=${CONFIG.gallery.thumbnailSize}&h=${CONFIG.gallery.thumbnailSize}`
    : `${url}?w=${CONFIG.gallery.thumbnailSize}&h=${CONFIG.gallery.thumbnailSize}`;
  
  img.src = optimizedUrl;
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

// ===================== PWA Installation =====================
let deferredPrompt;
let installButton = null;

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// PWA Install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  hideInstallButton();
  deferredPrompt = null;
});

// Show install button for mobile even without beforeinstallprompt
window.addEventListener('load', () => {
  setTimeout(() => {
    // Check if it's mobile and not already installed
    if (isMobile && !window.matchMedia('(display-mode: standalone)').matches) {
      // If no beforeinstallprompt was triggered, show manual install button
      if (!deferredPrompt) {
        showInstallButton();
      }
    }
  }, CONFIG.app.musicChangeHoldTime);
});

function showInstallButton() {
  // Create install button if not exists
  if (!installButton) {
    installButton = document.createElement('button');
    installButton.className = 'install-button';
    installButton.innerHTML = '<i class="fas fa-download"></i>';
    installButton.title = 'Cài đặt ứng dụng';
    installButton.addEventListener('click', installApp);
    document.body.appendChild(installButton);
  }
  installButton.style.display = 'flex';
}

function hideInstallButton() {
  if (installButton) {
    installButton.style.display = 'none';
  }
}

async function installApp() {
  if (deferredPrompt) {
    // Android Chrome - use native prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    deferredPrompt = null;
    hideInstallButton();
  } else {
    // iOS Safari or other browsers - show manual instructions
    showManualInstallPrompt();
  }
}

function showManualInstallPrompt() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  let instructions = '';
  if (isIOS) {
    instructions = 'Để cài đặt ứng dụng:<br/>1. Nhấn nút chia sẻ <i class="fas fa-share"></i><br/>2. Chọn "Thêm vào Màn hình Chính"';
  } else {
    instructions = 'Để cài đặt ứng dụng:<br/>1. Nhấn menu trình duyệt (⋮)<br/>2. Chọn "Thêm vào màn hình chính"';
  }
  
  // Create install modal
  const modal = document.createElement('div');
  modal.className = 'install-modal';
  modal.innerHTML = `
    <div class="install-modal-content">
      <h3>Cài đặt Time Together</h3>
      <p>${instructions}</p>
      <button class="install-close-btn">Đã hiểu</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal
  modal.querySelector('.install-close-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

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
