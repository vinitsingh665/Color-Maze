/**
 * ParticleSystem — Paint splash particles and confetti
 */

import * as THREE from "three";

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.confetti = [];
  }

  /**
   * Spawn paint splash particles at position
   */
  spawnPaintSplash(row, col, colorHex, count = 8) {
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(col, 0.15, row);

      // Random velocity
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 0.015 + Math.random() * 0.02;
      const vy = 0.03 + Math.random() * 0.03;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy,
        vz: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.015,
      });
    }
  }

  /**
   * Spawn wall hit impact particles
   */
  spawnWallHit(row, col, direction, colorHex) {
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.03, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(col, 0.2, row);

      // Particles fly away from wall
      const spread = (Math.random() - 0.5) * 0.03;
      let vx = spread,
        vz = spread;
      if (direction === "up") vz = 0.02 + Math.random() * 0.01;
      if (direction === "down") vz = -(0.02 + Math.random() * 0.01);
      if (direction === "left") vx = 0.02 + Math.random() * 0.01;
      if (direction === "right") vx = -(0.02 + Math.random() * 0.01);

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx,
        vy: 0.02 + Math.random() * 0.02,
        vz,
        life: 1.0,
        decay: 0.03,
      });
    }
  }

  /**
   * Spawn confetti explosion for win screen
   */
  spawnConfetti(centerRow, centerCol, colorHex, count = 40) {
    const baseColor = new THREE.Color(colorHex);
    const colors = [
      baseColor,
      new THREE.Color("#FBBF24"),
      new THREE.Color("#EC4899"),
      new THREE.Color("#06B6D4"),
      new THREE.Color("#10B981"),
    ];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.1, 0.06);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(centerCol, 1, centerRow);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.03 + Math.random() * 0.05;

      this.scene.add(mesh);
      this.confetti.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 0.05 + Math.random() * 0.06,
        vz: Math.sin(angle) * speed,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        life: 1.0,
        decay: 0.005 + Math.random() * 0.005,
      });
    }
  }

  /**
   * Update all particles
   */
  update() {
    // Regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.vy -= 0.001; // gravity
      p.life -= p.decay;
      p.mesh.material.opacity = Math.max(0, p.life);
      p.mesh.scale.setScalar(p.life);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.mesh.position.x += c.vx;
      c.mesh.position.y += c.vy;
      c.mesh.position.z += c.vz;
      c.vy -= 0.0008; // gravity
      c.mesh.rotation.x += c.rotSpeed;
      c.mesh.rotation.z += c.rotSpeed * 0.7;
      c.life -= c.decay;
      c.mesh.material.opacity = Math.max(0, c.life);

      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mesh.material.dispose();
        this.confetti.splice(i, 1);
      }
    }
  }

  /**
   * Clear all particles immediately
   */
  clear() {
    [...this.particles, ...this.confetti].forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.particles = [];
    this.confetti = [];
  }
}
