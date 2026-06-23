import * as THREE from 'three';

export function buildHellBiome(scene) {
  const RADIUS = 38;
  scene.fog = new THREE.Fog(0x220033, 12, 52);
  scene.background = new THREE.Color(0x2a0040);

  const group = new THREE.Group();
  scene.add(group);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x180022, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const boneMat = new THREE.MeshStandardMaterial({ color: 0xddd8c8, roughness: 0.85 });
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
    const r   = 6 + Math.random() * 26;
    _addSkeleton(group, boneMat, Math.sin(ang) * r, Math.cos(ang) * r);
  }

  return { group, bounds: { radius: RADIUS } };
}

function _addSkeleton(group, boneMat, x, z) {
  const ry    = Math.random() * Math.PI * 2;
  const eyeM  = new THREE.MeshStandardMaterial({ color: 0x000000 });

  // Skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), boneMat);
  skull.position.set(x, 1.45, z);
  group.add(skull);
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), eyeM);
    eye.position.set(x + ex, 1.47, z + 0.16);
    group.add(eye);
  }

  // Spine
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.80, 5), boneMat);
  spine.position.set(x, 0.90, z);
  group.add(spine);

  // Ribcage arcs
  for (let r = 0; r < 3; r++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.030, 5, 10, Math.PI), boneMat);
    rib.position.set(x, 1.18 - r * 0.14, z);
    rib.rotation.y = ry;
    group.add(rib);
  }

  // Fallen arm bone
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.50, 5), boneMat);
  arm.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
  arm.position.set(x + 0.4, 0.035, z + (Math.random() - 0.5) * 0.4);
  group.add(arm);
}
