var settings = {
  particles: {
    length: 500,
    duration: 2,
    velocity: 100,
    effect: -0.75,
    size: 30,
  },
  dateStart: "08/31/2023",
};

let displayMode = 0;

function getDiffDaysOnly() {
  const currentDate = new Date();
  const startDate = new Date(settings.dateStart);
  const timeDifference = currentDate - startDate;
  return Math.floor(timeDifference / (1000 * 3600 * 24));
}

function getDiffYearMonthDay() {
  const currentDate = new Date();
  const startDate = new Date(settings.dateStart);

  if (currentDate < startDate) {
    return { years: 0, months: 0, days: 0 };
  }

  let y = currentDate.getFullYear() - startDate.getFullYear();
  let m = currentDate.getMonth() - startDate.getMonth();
  let d = currentDate.getDate() - startDate.getDate();

  if (d < 0) {
    m -= 1;
    const tempDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    d = tempDate.getDate() + d;
  }

  if (m < 0) {
    y -= 1;
    m += 12;
  }

  y = Math.max(0, y);
  m = Math.max(0, m);
  d = Math.max(0, d);

  return { years: y, months: m, days: d };
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
    this.acceleration.x = dx * settings.particles.effect;
    this.acceleration.y = dy * settings.particles.effect;
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
    function ease(t) {
      return --t * t * t + 1;
    }
    const size = image.width * ease(this.age / settings.particles.duration);
    context.globalAlpha = 1 - this.age / settings.particles.duration;
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
    this.particles = new Array(length);
    this.firstActive = 0;
    this.firstFree = 0;
    this.duration = settings.particles.duration;

    for (let i = 0; i < this.particles.length; i++)
      this.particles[i] = new Particle();
  }

  add(x, y, dx, dy) {
    this.particles[this.firstFree].initialize(x, y, dx, dy);
    this.firstFree++;
    if (this.firstFree === this.particles.length) this.firstFree = 0;
    if (this.firstActive === this.firstFree) {
      this.firstActive++;
      if (this.firstActive === this.particles.length) this.firstActive = 0;
    }
  }

  update(deltaTime) {
    let i;
    if (this.firstActive < this.firstFree) {
      for (i = this.firstActive; i < this.firstFree; i++)
        this.particles[i].update(deltaTime);
    }
    if (this.firstFree < this.firstActive) {
      for (i = this.firstActive; i < this.particles.length; i++)
        this.particles[i].update(deltaTime);
      for (i = 0; i < this.firstFree; i++) this.particles[i].update(deltaTime);
    }
    while (
      this.particles[this.firstActive].age >= this.duration &&
      this.firstActive !== this.firstFree
    ) {
      this.firstActive++;
      if (this.firstActive === this.particles.length) this.firstActive = 0;
    }
  }

  draw(context, image) {
    if (this.firstActive < this.firstFree) {
      for (let i = this.firstActive; i < this.firstFree; i++)
        this.particles[i].draw(context, image);
    }
    if (this.firstFree < this.firstActive) {
      for (let i = this.firstActive; i < this.particles.length; i++)
        this.particles[i].draw(context, image);
      for (let i = 0; i < this.firstFree; i++)
        this.particles[i].draw(context, image);
    }
  }
}

class Point {
  constructor(x, y) {
    this.x = typeof x !== "undefined" ? x : 0;
    this.y = typeof y !== "undefined" ? y : 0;
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

(function (canvas) {
  const context = canvas.getContext("2d");
  const particles = new ParticlePool(settings.particles.length);
  const particleRate = settings.particles.length / settings.particles.duration;
  let time;

  let startX = 0;

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

  function pointOnHeart(t) {
    const scale = 0.4;
    return new Point(
      scale * 160 * Math.pow(Math.sin(t), 3),
      scale * (130 * Math.cos(t) - 50 * Math.cos(2 * t) - 20 * Math.cos(3 * t) - 10 * Math.cos(4 * t) + 25)
    );
  }

  const image = (function () {
    const c2 = document.createElement("canvas");
    const ctx2 = c2.getContext("2d");
    c2.width = settings.particles.size;
    c2.height = settings.particles.size;

    function to(t) {
      const point = pointOnHeart(t);
      point.x = settings.particles.size / 2 + (point.x * settings.particles.size) / 350;
      point.y = settings.particles.size / 2 - (point.y * settings.particles.size) / 350;
      return point;
    }

    ctx2.beginPath();
    let t = -Math.PI;
    let p = to(t);
    ctx2.moveTo(p.x, p.y);
    while (t < Math.PI) {
      t += 0.01;
      p = to(t);
      ctx2.lineTo(p.x, p.y);
    }
    ctx2.closePath();
    ctx2.fillStyle = "#ea80b0";
    ctx2.fill();

    const img = new Image();
    img.src = c2.toDataURL();
    return img;
  })();

  function render() {
    requestAnimationFrame(render);
    const newTime = new Date().getTime() / 1000;
    const deltaTime = newTime - (time || newTime);
    time = newTime;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const amount = particleRate * deltaTime;
    for (let i = 0; i < amount; i++) {
      const pos = pointOnHeart(Math.PI - 2 * Math.PI * Math.random());
      const dir = pos.clone().length(settings.particles.velocity);
      particles.add(canvas.width / 2 + pos.x, canvas.height / 2 - pos.y, dir.x, -dir.y);
    }

    particles.update(deltaTime);
    particles.draw(context, image);

    context.font = 'bold 20px "Courier New", Courier, monospace';
    context.fillStyle = "#d66291";
    context.textAlign = "center";
    context.textBaseline = "middle";

    let displayText = "";
    if (displayMode === 0) {
      const diffDays = getDiffDaysOnly();
      displayText = `${diffDays} ngày`;
    } else {
      const { years, months, days } = getDiffYearMonthDay();
      let displayLines = [];
      if (years > 0) displayLines.push(`${years} năm`);
      if (months > 0) displayLines.push(`${months} tháng`);
      if (days > 0 || (years === 0 && months === 0)) displayLines.push(`${days} ngày`);
      const multiLine = displayLines.join("\n");

      const lines = multiLine.split("\n");
      const lineHeight = 25;
      const baseY = canvas.height / 2 - lineHeight;
      lines.forEach((line, index) => {
        const yPos = baseY + index * lineHeight;
        context.strokeText(line, canvas.width / 2, yPos);
        context.fillText(line, canvas.width / 2, yPos);
      });
    }

    const textY = canvas.height / 2;
    context.lineWidth = 2;
    context.strokeStyle = "rgba(0,0,0,0.5)";
    context.strokeText(displayText, canvas.width / 2, textY);
    context.fillText(displayText, canvas.width / 2, textY);
  }

  function onResize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  window.onresize = onResize;

  setTimeout(function () {
    onResize();
    render();
  }, 10);
})(document.getElementById("pinkboard"));



document.addEventListener('DOMContentLoaded', function() {
  const audio = document.querySelector('audio');
  audio.muted = false; // Bật tiếng sau khi trang tải
});


document.body.addEventListener('click', function() {
  const audio = document.querySelector('audio');
  if (audio.paused) {
    audio.play();
  }
});

document.body.addEventListener('touchstart', function() {
  const audio = document.querySelector('audio');
  if (audio.paused) {
    audio.play();
  }
});