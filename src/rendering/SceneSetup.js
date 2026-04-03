/**
 * SceneSetup — Three.js scene, camera, renderer, lights
 */

import * as THREE from "three";

export class SceneSetup {
  constructor(container) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.setClearColor(0x141428, 1);
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x141428, 0.015);

    // Camera (Perspective, angled top-down)
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 12, 8);
    this.camera.lookAt(0, 0, 0);

    // Lights
    this._setupLights();

    // Resize handler
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);
  }

  _setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xc8c8ff, 1.2);
    this.scene.add(ambient);

    // Main directional (warm, casts shadows)
    this.dirLight = new THREE.DirectionalLight(0xfff4e6, 1.6);
    this.dirLight.position.set(5, 10, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 30;
    this.dirLight.shadow.camera.left = -12;
    this.dirLight.shadow.camera.right = 12;
    this.dirLight.shadow.camera.top = 12;
    this.dirLight.shadow.camera.bottom = -12;
    this.dirLight.shadow.bias = -0.001;
    this.scene.add(this.dirLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x9d7aef, 0.6);
    rimLight.position.set(-5, 6, -5);
    this.scene.add(rimLight);

    // Hemisphere light for soft ambient
    const hemi = new THREE.HemisphereLight(0xa8a0ff, 0x2a2548, 0.8);
    this.scene.add(hemi);
  }

  /**
   * Set camera to frame a maze of given dimensions
   */
  frameMaze(rows, cols) {
    this._lastRows = rows;
    this._lastCols = cols;

    const maxDim = Math.max(rows, cols);
    let distance = maxDim * 1.1 + 3;

    // Adjust for mobile/portrait view so the sides don't get cut off
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 1.0) {
      // Scale distance by inverse aspect to fit width
      distance = distance / (aspect * 0.9);
    }

    const centerX = (cols - 1) / 2;
    const centerZ = (rows - 1) / 2;

    this._targetCamPos = new THREE.Vector3(centerX, distance, centerZ + distance * 0.55);
    this._targetLookAt = new THREE.Vector3(centerX, 0, centerZ);

    // Update shadow camera to cover maze
    this.dirLight.position.set(centerX + 5, 10, centerZ + 5);
    this.dirLight.target.position.set(centerX, 0, centerZ);
    this.scene.add(this.dirLight.target);
  }

  /**
   * Smoothly interpolate camera to target on each frame
   */
  updateCamera(dt) {
    if (this._targetCamPos) {
      this.camera.position.lerp(this._targetCamPos, 0.05);
      const currentLookAt = new THREE.Vector3();
      this.camera.getWorldDirection(currentLookAt);
      // Look at target
      if (this._targetLookAt) {
        this.camera.lookAt(this._targetLookAt);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Re-frame to ensure grid stays within bounds on rotation/resize
    if (this._lastRows && this._lastCols) {
       this.frameMaze(this._lastRows, this._lastCols);
       // Immediately snap camera to prevent lerp-lag on resize
       this.camera.position.copy(this._targetCamPos);
       this.camera.lookAt(this._targetLookAt);
    }
  }

  destroy() {
    window.removeEventListener("resize", this._onResize);
    this.renderer.dispose();
  }
}
