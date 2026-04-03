/**
 * MazeRenderer — Creates 3D tile and wall meshes from grid data
 */

import * as THREE from "three";
import { CELL } from "../core/GridManager.js";

export class MazeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mazeGroup = new THREE.Group();
    this.scene.add(this.mazeGroup);

    this.tileMeshes = []; // 2D array matching grid
    this.wallMeshes = [];

    // Shared geometries
    this._tileGeo = new THREE.BoxGeometry(0.92, 0.1, 0.92);
    this._wallGeo = new THREE.BoxGeometry(0.96, 0.55, 0.96);
    this._baseGeo = new THREE.PlaneGeometry(200, 200);

    // Materials will be created per-level for colors
    this._floorMat = null;
    this._wallMat = null;
    this._paintedMat = null;
    this._unpaintedMat = null;
  }

  /**
   * Build 3D maze from grid data
   */
  buildMaze(grid, colors) {
    this.clear();

    const rows = grid.length;
    const cols = grid[0].length;

    // Parse colors
    const paintColor = new THREE.Color(colors.paint);
    const glowColor = new THREE.Color(colors.glow);
    const floorColor = new THREE.Color(colors.floor);

    // Materials
    this._unpaintedMat = new THREE.MeshStandardMaterial({
      color: 0x2d2d4a,
      roughness: 0.7,
      metalness: 0.1,
    });

    this._paintedMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      roughness: 0.4,
      metalness: 0.2,
      emissive: paintColor,
      emissiveIntensity: 0.15,
    });

    this._wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e3a,
      roughness: 0.5,
      metalness: 0.4,
    });

    // Base plane
    const baseMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 1,
      metalness: 0,
    });
    const baseMesh = new THREE.Mesh(this._baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.set((cols - 1) / 2, -0.06, (rows - 1) / 2);
    baseMesh.receiveShadow = true;
    this.mazeGroup.add(baseMesh);

    // Build tiles and walls
    this.tileMeshes = Array.from({ length: rows }, () =>
      Array(cols).fill(null)
    );

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellValue = grid[r][c];

        if (cellValue === CELL.WALL) {
          const wall = new THREE.Mesh(this._wallGeo, this._wallMat);
          wall.position.set(c, 0.275, r);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.mazeGroup.add(wall);
          this.wallMeshes.push(wall);
        } else {
          // Floor tile
          const tile = new THREE.Mesh(this._tileGeo, this._unpaintedMat.clone());
          tile.position.set(c, 0, r);
          tile.receiveShadow = true;
          this.mazeGroup.add(tile);
          this.tileMeshes[r][c] = tile;
        }
      }
    }
  }

  /**
   * Animate a tile being painted
   */
  paintTile(row, col, colors, delay = 0) {
    const tile = this.tileMeshes[row]?.[col];
    if (!tile) return;

    const paintColor = new THREE.Color(colors.paint);

    // Animate: scale pulse + color change
    const startTime = performance.now() + delay;
    const duration = 300;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < 0) {
        requestAnimationFrame(animate);
        return;
      }

      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      // Color lerp
      const startColor = new THREE.Color(0x1a1a2e);
      tile.material.color.copy(startColor).lerp(paintColor, ease);
      tile.material.emissive.copy(new THREE.Color(0x000000)).lerp(paintColor, ease * 0.15);
      tile.material.emissiveIntensity = 0.15 * ease;

      // Scale pulse
      if (t < 0.5) {
        const pulseT = t * 2;
        tile.scale.y = 1 + Math.sin(pulseT * Math.PI) * 0.5;
        tile.position.y = Math.sin(pulseT * Math.PI) * 0.03;
      } else {
        tile.scale.y = 1;
        tile.position.y = 0;
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Reset a tile to unpainted state
   */
  unpaintTile(row, col) {
    const tile = this.tileMeshes[row]?.[col];
    if (!tile) return;

    tile.material.color.set(0x1a1a2e);
    tile.material.emissive.set(0x000000);
    tile.material.emissiveIntensity = 0;
    tile.scale.y = 1;
    tile.position.y = 0;
  }

  /**
   * Clear all maze meshes
   */
  clear() {
    while (this.mazeGroup.children.length > 0) {
      const child = this.mazeGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.mazeGroup.remove(child);
    }
    this.tileMeshes = [];
    this.wallMeshes = [];
  }
}
