import * as THREE from 'three';

export function buildHeavenBiome(scene) {
  const RADIUS = 38;
  scene.fog = new THREE.Fog(0xd8f0ff, 28, 75);
  scene.background = new THREE.Color(0xc0e8ff);

  const group = new THREE.Group();
  scene.add(group);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.4, metalness: 0.0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9,
    transparent: true, opacity: 0.88,
  });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const r   = 4 + Math.random() * 28;
    _addCloud(group, cloudMat, Math.sin(ang) * r, Math.cos(ang) * r);
  }

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd060, roughness: 0.12, metalness: 0.92 });
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    _addGoldenPillar(group, goldMat, Math.sin(ang) * 28, Math.cos(ang) * 28);
  }

  return { group, bounds: { radius: RADIUS } };
}

function _addCloud(group, mat, x, z) {
  const parts = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < parts; i++) {
    const r    = 0.45 + Math.random() * 0.7;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
    mesh.scale.y = 0.5;
    mesh.position.set(
      x + (Math.random() - 0.5) * r * 2.5,
      0.28 + Math.random() * 0.4,
      z + (Math.random() - 0.5) * r * 2.5,
    );
    group.add(mesh);
  }
}

function _addGoldenPillar(group, mat, x, z) {
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.38, 6, 8), mat);
  pillar.position.set(x, 3, z);
  group.add(pillar);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), mat);
  cap.position.set(x, 6.1, z);
  group.add(cap);
}
