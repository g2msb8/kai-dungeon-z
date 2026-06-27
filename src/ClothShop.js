// 洋服屋さんの着せ替えビュー。専用の小さな3Dシーンで主人公を大きく表示する。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { getPlayerOutfit } from './PlayerSkin.js';

export class ClothShop {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 1.25, 4.6);
    this.camera.lookAt(0, 1.05, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(2.5, 4, 3);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.4);
    fill.position.set(-3, 2, 2);
    this.scene.add(fill);

    this._avatar = null;
    this._rafId  = null;
    this._t = 0;
    this._build();
  }

  _build() {
    if (this._avatar) {
      this.scene.remove(this._avatar.root);
      this._avatar.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); }
      });
    }
    const h = buildHumanoid(getPlayerOutfit());
    h.root.scale.setScalar(1.35);
    h.root.position.y = 0;
    this.scene.add(h.root);
    this._avatar = h;
  }

  // 服装を変えたあとに呼ぶ
  rebuild() { this._build(); }

  _resize() {
    const w = this.canvas.clientWidth || 300;
    const hh = this.canvas.clientHeight || 380;
    this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh;
    this.camera.updateProjectionMatrix();
  }

  open() {
    this._resize();
    if (this._rafId) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      this._t += dt;
      if (this._avatar) this._avatar.root.rotation.y = Math.sin(this._t * 0.6) * 0.5; // ゆっくり左右に向く
      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  close() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }
}
