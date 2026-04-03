/**
 * BallRenderer — 3D ball with reflections, glow, and rolling animation
 */

import * as THREE from "three";
import { gsap } from "gsap";

export class BallRenderer {
  constructor(scene) {
    this.scene = scene;
    this.ballGroup = new THREE.Group();
    this.scene.add(this.ballGroup);

    this.ball = null;
    this.glowLight = null;
    this.trailParticles = [];
    this.radius = 0.28;

    this._createBall();
  }

  _createBall() {
    // Ball geometry
    const geo = new THREE.SphereGeometry(this.radius, 32, 32);

    // Material: metallic with subtle reflections
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });

    this.ball = new THREE.Mesh(geo, mat);
    this.ball.castShadow = true;
    this.ball.position.y = this.radius + 0.05;
    this.ballGroup.add(this.ball);

    // Glow effect — point light attached to ball
    this.glowLight = new THREE.PointLight(0x7C3AED, 1.5, 4);
    this.glowLight.position.y = this.radius;
    this.ballGroup.add(this.glowLight);

    // Outer glow sphere
    const glowGeo = new THREE.SphereGeometry(this.radius * 1.6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x7C3AED,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.glowMesh.position.y = this.radius + 0.05;
    this.ballGroup.add(this.glowMesh);
  }

  /**
   * Set ball color to match level paint color
   */
  setColor(colorHex) {
    const color = new THREE.Color(colorHex);
    this.ball.material.color.set(color);
    this.ball.material.emissive.set(color);
    this.ball.material.emissiveIntensity = 0.3;
    this.glowLight.color.set(color);
    this.glowMesh.material.color.set(color);
  }

  /**
   * Set position (grid coordinates)
   */
  setPosition(row, col) {
    this.ballGroup.position.set(col, 0, row);
  }

  /**
   * Get current grid position
   */
  getPosition() {
    return {
      col: this.ballGroup.position.x,
      row: this.ballGroup.position.z,
    };
  }

  /**
   * Animate ball rolling from current position to target.
   */
  animateMoveTo(targetRow, targetCol, pathLength, onCellReached) {
    return new Promise((resolve) => {
      const startPos = {
        x: this.ballGroup.position.x,
        z: this.ballGroup.position.z,
      };
      const endPos = { x: targetCol, z: targetRow };

      const dx = endPos.x - startPos.x;
      const dz = endPos.z - startPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance === 0) {
        resolve();
        return;
      }

      // Faster, snappier movement
      const baseDuration = 0.05; // 50ms per cell
      const duration = Math.max(pathLength * baseDuration, 0.15);

      const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
      const rollAxis = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), moveDir)
        .normalize();

      let lastContentT = -1;

      // Squash/Stretch effect — scale down axis of movement
      const scaleX = Math.abs(dx) > 0 ? 1.15 : 0.9;
      const scaleZ = Math.abs(dz) > 0 ? 1.15 : 0.9;
      const scaleY = 0.85; // squish vertically slightly

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(this.ballGroup.scale, { x: 1, y: 1, z: 1, duration: 0.15, ease: "back.out(2)" });
          this._bounceOnStop(resolve);
        }
      });

      // Squash anticipation
      gsap.to(this.ballGroup.scale, {
        x: scaleX, y: scaleY, z: scaleZ,
        duration: duration * 0.5,
        ease: "power1.inOut",
        yoyo: true,
        repeat: 1
      });

      // Move animation
      const renderer = this;
      tl.to(this.ballGroup.position, {
        x: endPos.x,
        z: endPos.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: function() {
          const t = this.progress();
          
          // Rotation
          const rollAmount = distance * t * (Math.PI * 2) / (renderer.radius * 2 * Math.PI);
          renderer.ball.setRotationFromAxisAngle(rollAxis, rollAmount);

          // Notify passing through cells
          const currentCellIndex = Math.floor(t * pathLength);
          if (currentCellIndex > lastContentT && currentCellIndex <= pathLength) {
            for (let i = lastContentT + 1; i <= currentCellIndex && i < pathLength; i++) {
              if (onCellReached) onCellReached(i);
            }
            lastContentT = currentCellIndex;
          }
        }
      });
      
      // Glow pulse
      gsap.to(this.glowLight, {
        intensity: 2.0,
        duration: duration * 0.5,
        yoyo: true,
        repeat: 1
      });
    });
  }

  _bounceOnStop(resolve) {
    gsap.to(this.ball.position, {
      y: this.radius + 0.1,
      duration: 0.1,
      ease: "power1.out",
      yoyo: true,
      repeat: 1,
      onComplete: () => resolve()
    });
  }

  /**
   * Idle floating animation
   */
  updateIdle(time) {
    if (!this.ball) return;
    this.ball.position.y =
      this.radius + 0.05 + Math.sin(time * 2) * 0.02;
    this.glowMesh.material.opacity = 0.06 + Math.sin(time * 3) * 0.02;
  }

  /**
   * Show/hide ball
   */
  setVisible(visible) {
    this.ballGroup.visible = visible;
  }
}
