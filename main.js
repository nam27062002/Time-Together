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

function getDiffDaysOnly() {
  const currentDate = new Date();
  const startDate = new Date(SETTINGS.dateStart);
  return Math.floor((currentDate - startDate) / (1000 * 3600 * 24));
}

function getDiffYearMonthDay() {
  const currentDate = new Date();
  const startDate = new Date(SETTINGS.dateStart);

  if (currentDate < startDate) {
    return { years: 0, months: 0, days: 0 };
  }

  let y = currentDate.getFullYear() - startDate.getFullYear();
  let m = currentDate.getMonth() - startDate.getMonth();
  let d = currentDate.getDate() - startDate.getDate();

  if (d < 0) {
    m -= 1;
    const tempDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0
    );
    d = tempDate.getDate() + d;
  }

  if (m < 0) {
    y -= 1;
    m += 12;
  }

  return {
    years: Math.max(0, y),
    months: Math.max(0, m),
    days: Math.max(0, d),
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

function createHeartImage() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = SETTINGS.particles.size;
  canvas.height = SETTINGS.particles.size;

  function pointOnHeart(t, scale = 1) {
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

  function to(t, scale = 1) {
    const point = pointOnHeart(t, scale);
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

  function pointOnHeart(t) {
    const scale = SETTINGS.heart.scale * heartScale;
    return new Point(
      scale * 160 * Math.pow(Math.sin(t), 3),
      scale *
        (130 * Math.cos(t) -
          50 * Math.cos(2 * t) -
          20 * Math.cos(3 * t) -
          10 * Math.cos(4 * t) +
          25)
    );
  }

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
      const pos = pointOnHeart(Math.PI - 2 * Math.PI * Math.random());
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

// Audio handling
const audio = document.getElementById("bgMusic");

function handleAudioPlay() {
  if (audio.paused) {
    audio.play().catch((error) => {
      console.log("Không thể phát nhạc tự động:", error);
    });
  }
}

// Thêm sự kiện cho toàn bộ document
document.addEventListener("click", handleAudioPlay);
document.addEventListener("touchstart", handleAudioPlay);
document.addEventListener("keydown", handleAudioPlay);

// Loading screen handling
document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.querySelector(".loading-screen");
  const musicControl = document.querySelector(".music-control");
  const musicIcon = musicControl.querySelector("i");

  // Hide loading screen after 2 seconds
  setTimeout(() => {
    loadingScreen.classList.add("fade-out");
  }, 2000);

  // Music control handling
  musicControl.addEventListener("click", (e) => {
    e.stopPropagation(); // Ngăn sự kiện click lan truyền lên document
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
          console.log("Không thể phát nhạc:", error);
        });
    } else {
      audio.pause();
      musicControl.classList.remove("playing");
      musicControl.classList.add("paused");
      musicIcon.classList.remove("fa-pause");
      musicIcon.classList.add("fa-play");
    }
  });

  // Update music control state
  audio.addEventListener("play", () => {
    musicControl.classList.add("playing");
    musicControl.classList.remove("paused");
    musicIcon.classList.remove("fa-play");
    musicIcon.classList.add("fa-pause");
  });

  audio.addEventListener("pause", () => {
    musicControl.classList.remove("playing");
    musicControl.classList.add("paused");
    musicIcon.classList.remove("fa-pause");
    musicIcon.classList.add("fa-play");
  });

  // Try to play music when page loads
  audio.muted = false;
  handleAudioPlay();
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
