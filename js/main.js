(function (canvas) {
  const context = canvas.getContext("2d");
  const particles = new ParticlePool(settings.particles.length);
  const particleRate = settings.particles.length / settings.particles.duration;
  let time;

  function pointOnHeart(t) {
    const scale = 0.4;
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

  function calculateDays() {
    const currentDate = new Date();
    const targetDate = new Date(settings.dateStart);
    const timeDifference = currentDate.getTime() - targetDate.getTime();
    const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));
    return daysDifference;
  }

  const image = (function () {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = settings.particles.size;
    canvas.height = settings.particles.size;

    function to(t) {
      const point = pointOnHeart(t);
      point.x =
        settings.particles.size / 2 + (point.x * settings.particles.size) / 350;
      point.y =
        settings.particles.size / 2 - (point.y * settings.particles.size) / 350;
      return point;
    }

    ctx.beginPath();
    let t = -Math.PI;
    let point = to(t);
    ctx.moveTo(point.x, point.y);

    while (t < Math.PI) {
      t += 0.01;
      point = to(t);
      ctx.lineTo(point.x, point.y);
    }

    ctx.closePath();
    ctx.fillStyle = "#ea80b0";
    ctx.fill();

    const img = new Image();
    img.src = canvas.toDataURL();
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
      particles.add(
        canvas.width / 2 + pos.x,
        canvas.height / 2 - pos.y,
        dir.x,
        -dir.y
      );
    }

    particles.update(deltaTime);
    particles.draw(context, image);

    const days = calculateDays();
    context.font = 'bold 20px "Courier New", Courier, monospace';
    context.fillStyle = "#d66291";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const text = `${days} ngày`;
    const textY = canvas.height / 2;

    context.strokeText(text, canvas.width / 2 - 2, textY - 2);
    context.fillText(text, canvas.width / 2, textY);
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
