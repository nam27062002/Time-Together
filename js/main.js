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
 * @param {Function} onDataLoaded - Callback khi dữ liệu đầu tiên được load
 */
function subscribeAvatar(userKey, avatarElement, onDataLoaded) {
  let hasCalledCallback = false;
  
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
        
        // Call onDataLoaded callback if provided and not called yet
        if (onDataLoaded && !hasCalledCallback) {
          hasCalledCallback = true;
          onDataLoaded();
        }
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
            
            // Call onDataLoaded callback if provided and not called yet
            if (onDataLoaded && !hasCalledCallback) {
              hasCalledCallback = true;
              onDataLoaded();
            }
          })
          .catch(() => {
            avatarElement.src = `img/${userKey}.jpg`;
            
            // Call onDataLoaded callback if provided and not called yet
            if (onDataLoaded && !hasCalledCallback) {
              hasCalledCallback = true;
              onDataLoaded();
            }
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
  const mainContent = document.getElementById("info");

  // Main content is hidden by default via CSS

  // Gọi hàm để đặt nhạc ngẫu nhiên khi trang tải
  setRandomMusic();

  // Show loading screen
  showLoading();

  // Chỉ hiện nội dung chính sau khi cả 2 avatar đã load từ Firebase
  let avatarLoadedCount = 0;
  const checkDataLoaded = () => {
    avatarLoadedCount++;
    if (avatarLoadedCount >= 2) {
      // Hide loading and show main content
      hideLoading();
      mainContent.classList.add("loaded");
    }
  };

  // Make checkDataLoaded available globally for subscribeAvatar calls
  window.checkDataLoaded = checkDataLoaded;
  
  // Fallback timeout to show content even if Firebase fails
  setTimeout(() => {
    if (avatarLoadedCount < 2) {
      hideLoading();
      mainContent.classList.add("loaded");
    }
  }, CONFIG.app.loadingTimeout);

  // Simple click handler for music control - only toggle play/pause
  musicControl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMusicPlayback();
  });

  // Music change gesture: Only swipe up on mobile
  let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Mobile: Use swipe up gesture only
    let touchStartY = 0;
    
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
      
      // Check for swipe up (at least 100px)
      if (swipeDistance > 100) {
        nextMusic();
      }
    }, { passive: true });
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
subscribeAvatar("male", maleAvatar, window.checkDataLoaded);
subscribeAvatar("female", femaleAvatar, window.checkDataLoaded);

// ===================== ROMANTIC VISUAL EFFECTS =====================

// Optimized floating particles with object pooling
class FloatingParticlePool {
  constructor(maxSize = 15) {
    this.pool = [];
    this.active = [];
    this.maxSize = maxSize;
    this.particles = ['💖', '💕', '💗', '🌟', '✨', '💫', '🌸', '🌺'];
    this.container = null;
  }

  init(container) {
    this.container = container;
    // Pre-create particle elements for pooling
    for (let i = 0; i < this.maxSize; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.display = 'none';
      this.pool.push(particle);
      container.appendChild(particle);
    }
  }

  createParticle() {
    if (this.pool.length === 0) return; // No available particles
    
    const particle = this.pool.pop();
    particle.textContent = this.particles[Math.floor(Math.random() * this.particles.length)];
    
    // Random positioning and animation
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 8 + 10) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particle.style.display = 'block';
    
    this.active.push(particle);
    
    // Return to pool after animation
    setTimeout(() => {
      this.returnToPool(particle);
    }, 12000);
  }

  returnToPool(particle) {
    const index = this.active.indexOf(particle);
    if (index > -1) {
      this.active.splice(index, 1);
      particle.style.display = 'none';
      this.pool.push(particle);
    }
  }
}

// Create floating particles with object pooling
function createFloatingParticles() {
  const particleContainer = document.getElementById('floating-particles');
  if (!particleContainer) return;

  const particlePool = new FloatingParticlePool(15);
  particlePool.init(particleContainer);

  // Create initial particles
  for (let i = 0; i < 12; i++) {
    setTimeout(() => particlePool.createParticle(), i * 800);
  }

  // Continuously create new particles (optimized rate)
  setInterval(() => particlePool.createParticle(), 1400);
}

// Initialize particles after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(createFloatingParticles, 2000); // Start after 2 seconds
});

// Add romantic pulsing effect to the main info container
function addRomanticPulsing() {
  const infoContainer = document.getElementById('info');
  if (infoContainer) {
    setInterval(() => {
      infoContainer.style.filter = 'drop-shadow(0 0 20px rgba(255, 105, 180, 0.3))';
      setTimeout(() => {
        infoContainer.style.filter = 'drop-shadow(0 0 10px rgba(255, 105, 180, 0.1))';
      }, 1000);
    }, 3000);
  }
}

// Initialize romantic effects
document.addEventListener('DOMContentLoaded', addRomanticPulsing);

// ===================== 3D VISUAL EFFECTS ENGINE =====================

class Hearts3DEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hearts = [];
    this.constellationLines = [];
    this.mode = 'both'; // Start with both 3D and constellation
    this.maxHearts = this.getOptimalHeartCount();
    this.animationFrame = null;
    this.lastTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    
    // Performance optimization caches
    this.gradientCache = new Map();
    this.heartPathCache = null;
    this.isLowPowerDevice = this.detectLowPowerDevice();
    
    // Canvas optimizations
    this.setupCanvasOptimizations();
    
    this.resize();
    this.initHearts();
    this.start();
    
    window.addEventListener('resize', () => this.resize());
  }

  setupCanvasOptimizations() {
    // Enable hardware acceleration hints
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // Pre-create heart path for reuse
    this.createHeartPath();
  }

  createHeartPath() {
    // Create reusable heart path
    this.heartPath = new Path2D();
    this.heartPath.moveTo(0, 6);
    // Left curve
    this.heartPath.bezierCurveTo(-8, -2, -12, -8, -6, -12);
    this.heartPath.bezierCurveTo(-3, -14, 0, -12, 0, -8);
    // Right curve  
    this.heartPath.bezierCurveTo(0, -12, 3, -14, 6, -12);
    this.heartPath.bezierCurveTo(12, -8, 8, -2, 0, 6);
    this.heartPath.closePath();
  }

  detectLowPowerDevice() {
    // Simple heuristic to detect potentially low-power devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    return isMobile || hasLowMemory;
  }

  getOptimalHeartCount() {
    if (this.isLowPowerDevice) {
      return 15; // More hearts since Aurora is removed
    }
    return 25; // Full experience without Aurora
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initHearts() {
    this.hearts = [];
    for (let i = 0; i < this.maxHearts; i++) {
      this.hearts.push(this.createHeart());
    }
  }

  createHeart() {
    let x, y;
    
    if (this.mode === 'both' || this.mode === 'constellation') {
      // Distribute hearts around avatar areas, avoid center
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      const avoidRadius = Math.min(this.canvas.width, this.canvas.height) * 0.25; // Avoid center 25%
      
      do {
        x = Math.random() * this.canvas.width;
        y = Math.random() * this.canvas.height;
      } while (Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) < avoidRadius);
      
      // Bias towards avatar areas (top corners and edges)
      if (Math.random() > 0.5) {
        // Left side (male avatar area)
        x = Math.random() * (this.canvas.width * 0.4);
      } else {
        // Right side (female avatar area) 
        x = this.canvas.width * 0.6 + Math.random() * (this.canvas.width * 0.4);
      }
    } else {
      // Normal random distribution for regular 3D mode
      x = Math.random() * this.canvas.width;
      y = Math.random() * this.canvas.height;
    }
    
    return {
      x: x,
      y: y,
      z: Math.random() * 1000 + 100, // Depth
      vx: (Math.random() - 0.5) * 1.5, // Slower movement
      vy: (Math.random() - 0.5) * 1.5,
      vz: (Math.random() - 0.5) * 2,
      size: Math.random() * 15 + 8, // Slightly smaller
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 3, // Slower rotation
      color: this.getRandomHeartColor(),
      pulsePhase: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.6 + 0.3 // More visible
    };
  }

  getRandomHeartColor() {
    const colors = [
      'rgba(255, 105, 180, ',
      'rgba(255, 182, 193, ',
      'rgba(255, 20, 147, ',
      'rgba(255, 192, 203, ',
      'rgba(255, 69, 0, ',
      'rgba(138, 43, 226, '
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  drawHeart(heart) {
    const scale = 1000 / (heart.z + 1000); // 3D perspective
    const x = heart.x * scale + (this.canvas.width * (1 - scale)) / 2;
    const y = heart.y * scale + (this.canvas.height * (1 - scale)) / 2;
    const size = heart.size * scale;
    
    // Skip rendering if too small or too far (viewport culling)
    if (size < 1 || x < -50 || x > this.canvas.width + 50 || y < -50 || y > this.canvas.height + 50) {
      return { x, y, size, alpha: 0 };
    }
    
    // Pulsing effect (optimized)
    const pulse = Math.sin(Date.now() * 0.005 + heart.pulsePhase) * 0.3 + 1;
    const finalSize = size * pulse;
    
    // Calculate alpha based on depth
    const depthAlpha = Math.max(0.1, Math.min(1, (1000 - heart.z) / 1000));
    const alpha = heart.alpha * depthAlpha;
    
    // Get cached gradient or create new one
    const gradientKey = `${heart.color}_${Math.floor(alpha * 10)}`;
    let gradient = this.gradientCache.get(gradientKey);
    if (!gradient) {
      gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      gradient.addColorStop(0, heart.color + alpha + ')');
      gradient.addColorStop(0.7, heart.color + (alpha * 0.8) + ')');
      gradient.addColorStop(1, heart.color + '0)');
      
      // Cache gradient (limit cache size)
      if (this.gradientCache.size > 50) {
        this.gradientCache.clear();
      }
      this.gradientCache.set(gradientKey, gradient);
    }
    
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((heart.rotation * Math.PI) / 180);
    this.ctx.scale(finalSize / 20, finalSize / 20);
    
    // Use cached gradient and path
    this.ctx.fillStyle = gradient;
    this.ctx.shadowColor = heart.color + '0.8)';
    this.ctx.shadowBlur = 15 * scale;
    
    // Use pre-created path for better performance
    this.ctx.fill(this.heartPath);
    
    this.ctx.restore();
    
    return { x, y, size: finalSize, alpha };
  }

  drawConstellationLines() {
    if (this.mode !== 'constellation' && this.mode !== 'both') return;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const avoidRadius = Math.min(this.canvas.width, this.canvas.height) * 0.2; // Avoid center area
    
    // Batch line drawing for better performance
    const linesToDraw = [];
    
    // Connect nearby hearts but avoid center area
    for (let i = 0; i < this.hearts.length; i++) {
      for (let j = i + 1; j < this.hearts.length; j++) {
        const heart1 = this.hearts[i];
        const heart2 = this.hearts[j];
        
        // Quick 3D distance check before expensive calculations
        const quickDist = Math.abs(heart1.z - heart2.z);
        if (quickDist > 300) continue; // Skip if too far in Z
        
        const scale1 = 1000 / (heart1.z + 1000);
        const scale2 = 1000 / (heart2.z + 1000);
        
        const x1 = heart1.x * scale1 + (this.canvas.width * (1 - scale1)) / 2;
        const y1 = heart1.y * scale1 + (this.canvas.height * (1 - scale1)) / 2;
        const x2 = heart2.x * scale2 + (this.canvas.width * (1 - scale2)) / 2;
        const y2 = heart2.y * scale2 + (this.canvas.height * (1 - scale2)) / 2;
        
        const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        
        // Check if line passes through center area
        const lineCenterDist = this.distanceToLineSegment(centerX, centerY, x1, y1, x2, y2);
        
        // Only add line if it doesn't pass through center and hearts are close enough
        if (distance < 250 && lineCenterDist > avoidRadius) {
          linesToDraw.push({
            x1, y1, x2, y2,
            alpha: 0.3 * (1 - distance / 250),
            width: 1.5
          });
        }
      }
    }
    
    // Batch draw all lines with minimal context switches
    if (linesToDraw.length > 0) {
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
      this.ctx.shadowBlur = 3;
      
      linesToDraw.forEach(line => {
        this.ctx.strokeStyle = `rgba(255, 105, 180, ${line.alpha})`;
        this.ctx.lineWidth = line.width;
        this.ctx.beginPath();
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
        this.ctx.stroke();
      });
      
      this.ctx.restore();
    }
  }

  // Helper function to calculate distance from point to line segment
  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  update() {
    // Update heart positions and properties
    this.hearts.forEach(heart => {
      heart.x += heart.vx;
      heart.y += heart.vy;
      heart.z += heart.vz;
      heart.rotation += heart.rotationSpeed;
      
      // Wrap around screen
      if (heart.x < 0) heart.x = this.canvas.width;
      if (heart.x > this.canvas.width) heart.x = 0;
      if (heart.y < 0) heart.y = this.canvas.height;
      if (heart.y > this.canvas.height) heart.y = 0;
      
      // Depth boundaries
      if (heart.z < 0) heart.z = 1000;
      if (heart.z > 1000) heart.z = 0;
    });
  }

  render() {
    // Use willReadFrequently hint for better performance
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Sort hearts by depth (far to near) - only when needed
    const sortedHearts = this.hearts.slice().sort((a, b) => b.z - a.z);
    
    // Batch operations to reduce context switches
    this.ctx.save();
    
    // Draw all hearts with minimal context changes
    for (const heart of sortedHearts) {
      this.drawHeart(heart);
    }
    
    this.ctx.restore();
    
    // Draw constellation lines on top (separate batch)
    if (this.mode === 'constellation' || this.mode === 'both') {
      this.drawConstellationLines();
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'constellation') {
      this.maxHearts = 15; // Fewer hearts for cleaner lines
      this.initHearts();
    } else if (mode === 'both') {
      this.maxHearts = 25; // Full experience without Aurora
      this.initHearts();
    } else if (mode === '3d') {
      this.maxHearts = 25;
      this.initHearts();
    }
  }

  start() {
    let targetFPS = 60;
    let frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;
    
    const animate = (currentTime) => {
      // Adaptive frame rate - skip frames if needed
      if (currentTime - lastFrameTime < frameInterval) {
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }
      
      // FPS monitoring for performance optimization
      if (currentTime - this.lastTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastTime = currentTime;
        
        // Adaptive FPS: reduce target FPS if struggling
        if (this.fps < 30) {
          targetFPS = Math.max(30, targetFPS - 5);
          frameInterval = 1000 / targetFPS;
        } else if (this.fps > 55 && targetFPS < 60) {
          targetFPS = Math.min(60, targetFPS + 2);
          frameInterval = 1000 / targetFPS;
        }
      }
      this.frameCount++;
      lastFrameTime = currentTime;

      this.update();
      this.render();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate(performance.now());
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}

// Visual Effects Manager - All effects enabled simultaneously
class VisualEffectsManager {
  constructor() {
    this.hearts3D = null;
    this.init();
  }

  init() {
    // Initialize 3D Hearts Engine with both 3D and constellation modes
    const canvas = document.getElementById('hearts-3d-canvas');
    if (canvas) {
      this.hearts3D = new Hearts3DEngine(canvas);
      // Enable both 3D hearts AND constellation lines
      this.hearts3D.setMode('both'); // New combined mode
    }
    
    // Enable all visual effects
    this.enableAllEffects();
  }

  enableAllEffects() {
    // Show remaining visual effects simultaneously (Aurora removed)
    const particles = document.getElementById('floating-particles');
    const hearts3D = document.getElementById('hearts-3d-canvas');
    
    // Make sure all remaining effects are visible
    if (particles) {
      particles.style.display = 'block';
      particles.style.opacity = '1';
    }
    if (hearts3D) {
      hearts3D.style.display = 'block';
      hearts3D.style.opacity = '1';
    }

    console.log('🎉 Visual effects enabled: Particles + 3D Hearts + Constellations!');
  }
}

// Initialize 3D Visual Effects after DOM loads with optimizations
document.addEventListener('DOMContentLoaded', () => {
  // Lazy initialization - only start after page is fully interactive
  const initVisualEffects = () => {
    // Check if page is still loading
    if (document.readyState !== 'complete') {
      setTimeout(initVisualEffects, 100);
      return;
    }
    
    // Initialize with performance monitoring
    window.visualEffects = new VisualEffectsManager();
    
    // Clean up unused resources periodically
    setInterval(() => {
      if (window.visualEffects && window.visualEffects.hearts3D) {
        // Clear gradient cache if too large
        if (window.visualEffects.hearts3D.gradientCache.size > 100) {
          window.visualEffects.hearts3D.gradientCache.clear();
        }
      }
      
      // Force garbage collection hint (if available)
      if (window.gc) {
        window.gc();
      }
    }, 30000); // Every 30 seconds
  };
  
  setTimeout(initVisualEffects, 1000);
});
