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
    if (this.firstActive === this.firstFree) this.firstActive++;
    if (this.firstActive === this.particles.length) this.firstActive = 0;
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
