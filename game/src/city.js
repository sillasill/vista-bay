// Vista Bay itself: a sun-soaked coastal city built once from the seed — a road
// grid with sidewalks, canvas-textured buildings, palms, streetlights, a beach,
// a marina pier and the sea. Everything static lives in one group; the returned
// city object carries the building boxes for collision and the named places the
// missions and the screenshot staging need.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick, randInt } from './random.js';

/** A canvas texture of a building facade: base colour with a grid of windows. */
function facadeTexture(base, lit, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 10 + col * 23;
      const y = 22 + row * 25;
      const warm = rng() < 0.28;
      g.fillStyle = warm ? lit : 'rgba(30,42,58,0.85)';
      g.fillRect(x, y, 15, 16);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x, y, 15, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A canvas texture of asphalt with a dashed centre line. */
function roadTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2e2e33';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#3a3a40';
  for (let i = 0; i < 200; i++) g.fillRect(rng() * 64, rng() * 256, 2, 2);
  g.fillStyle = '#d8d8d8';
  g.fillRect(3, 0, 2, 256);
  g.fillRect(59, 0, 2, 256);
  g.fillStyle = '#e8c84a';
  for (let y = 0; y < 256; y += 64) g.fillRect(30, y + 8, 4, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.matrixAutoUpdate = true;
  return mesh;
}

export function buildCity(scene, rng) {
  const city = {
    buildings: [],
    palms: [],
    lamps: [],
    boats: [],
    group: new THREE.Group(),
  };
  scene.add(city.group);

  // Sun, sky and haze.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 130, 460);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1));

  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  const groundMat = lambert(0x55504a);
  const sandMat = lambert(PALETTE.sand);
  const seaMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
  const sidewalkMat = lambert(PALETTE.sidewalk);
  const trunkMat = lambert(PALETTE.trunk);
  const palmMat = lambert(PALETTE.palm);
  const poleMat = lambert(0x3a3f45);

  // Ground: city slab, then sand, then the sea stretching to the horizon.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  city.group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 26), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 130);
  city.group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 300), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, 292);
  city.group.add(sea);

  // Roads with dashed centrelines, and raised sidewalks along both edges.
  const roadTex = roadTexture(rng);
  const roadLen = CITY.max - CITY.min;
  for (const x of CITY.roadsX) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, roadLen / 20);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.roadHalf * 2, roadLen),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.03, 0);
    city.group.add(road);
    for (const side of [-1, 1]) {
      const walk = box(CITY.sidewalk, 0.18, roadLen, sidewalkMat);
      walk.position.set(x + side * (CITY.roadHalf + CITY.sidewalk / 2), 0.09, 0);
      city.group.add(walk);
    }
  }
  for (const z of CITY.roadsZ) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    // The texture's dashes run along its v axis; rotate it so they run along
    // the road's length instead of across its width.
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.repeat.set(1, roadLen / 20);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadLen, CITY.roadHalf * 2),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, z);
    city.group.add(road);
    for (const side of [-1, 1]) {
      const walk = box(roadLen, 0.18, CITY.sidewalk, sidewalkMat);
      walk.position.set(0, 0.09, z + side * (CITY.roadHalf + CITY.sidewalk / 2));
      city.group.add(walk);
    }
  }

  // Buildings: one to three per block, taller toward the centre, each with a
  // canvas facade. Their footprints are kept for collision.
  const variants = PALETTE.building.map((c) => {
    const hex = `#${c.toString(16).padStart(6, '0')}`;
    return new THREE.MeshLambertMaterial({ map: facadeTexture(hex, '#ffd98a', rng) });
  });
  const blockCentres = [-67.5, -22.5, 22.5, 67.5];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const centre = Math.max(0, 1 - (Math.abs(bx) + Math.abs(bz)) / 160);
      const count = randInt(rng, 1, 3);
      const slots = [
        { dx: 0, dz: 0, w: 26, d: 26 },
        { dx: -9, dz: -9, w: 12, d: 12 },
        { dx: 9, dz: 9, w: 12, d: 12 },
      ];
      for (let i = 0; i < count; i++) {
        const slot = slots[i];
        const w = slot.w - randInt(rng, 0, 4);
        const d = slot.d - randInt(rng, 0, 4);
        const h = 10 + rng() * 22 + centre * 26;
        const x = bx + slot.dx;
        const z = bz + slot.dz;
        const mesh = box(w, h, d, pick(rng, variants));
        mesh.position.set(x, h / 2, z);
        city.group.add(mesh);
        // A flat roof cap so the top is not a window wall.
        const roof = box(w + 0.6, 0.5, d + 0.6, lambert(0x6a655c));
        roof.position.set(x, h + 0.25, z);
        city.group.add(roof);
        city.buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
      }
    }
  }

  // The safehouse: a small teal house south of the grid. The vault: a grey
  // block by the beach. Both are collision boxes too.
  const safe = box(10, 6, 8, lambert(0x2e8f86));
  safe.position.set(-10, 3, 102);
  city.group.add(safe);
  city.buildings.push({ minX: -15, maxX: -5, minZ: 98, maxZ: 106, h: 6 });
  const vault = box(12, 9, 10, lambert(0x7a7f85));
  vault.position.set(-60, 4.5, 110);
  city.group.add(vault);
  city.buildings.push({ minX: -66, maxX: -54, minZ: 105, maxZ: 115, h: 9 });

  // Palms along the sidewalks and the beach front.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6);
  const crownGeo = new THREE.IcosahedronGeometry(2.1, 0);
  for (let i = 0; i < 34; i++) {
    const onBeach = i >= 26;
    let x;
    let z;
    if (onBeach) {
      x = -110 + rng() * 220;
      z = 121 + rng() * 14;
    } else {
      const road = pick(rng, CITY.roadsX);
      const along = CITY.min + rng() * (CITY.max - CITY.min);
      const side = rng() < 0.5 ? -1 : 1;
      x = road + side * (CITY.roadHalf + CITY.sidewalk + 0.8);
      z = along;
      if (Math.abs(z - Math.round(z / 45) * 45) < 8) continue;
    }
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = (rng() - 0.5) * 0.12;
    city.group.add(trunk);
    const crown = new THREE.Mesh(crownGeo, palmMat);
    crown.position.set(x, 6.1, z);
    crown.scale.set(1.2, 0.7, 1.2);
    city.group.add(crown);
    city.palms.push({ x, z });
  }

  // Streetlights at every other intersection corner.
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
  for (const x of CITY.roadsX) {
    for (const z of CITY.roadsZ) {
      if ((x + z) % 90 !== 0) continue;
      const pole = new THREE.Mesh(lampGeo, poleMat);
      pole.position.set(x + 6.4, 3.25, z + 6.4);
      city.group.add(pole);
      const arm = box(1.6, 0.12, 0.12, poleMat);
      arm.position.set(x + 5.7, 6.4, z + 6.4);
      city.group.add(arm);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x887733 }),
      );
      lamp.position.set(x + 5.0, 6.35, z + 6.4);
      city.group.add(lamp);
      city.lamps.push({ x: x + 6.4, z: z + 6.4 });
    }
  }

  // The pier: planks on posts out into the sea, with a railing.
  const plankMat = lambert(0x9a7b52);
  const pier = box(CITY.pierHalf * 2, 0.5, CITY.pierZ1 - CITY.pierZ0, plankMat);
  pier.position.set(CITY.pierX, 0.6, (CITY.pierZ0 + CITY.pierZ1) / 2);
  city.group.add(pier);
  for (let z = CITY.pierZ0 + 4; z < CITY.pierZ1; z += 12) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 6), lambert(0x6a5138));
      post.position.set(CITY.pierX + side * (CITY.pierHalf - 0.3), 0, z);
      city.group.add(post);
    }
  }
  for (const side of [-1, 1]) {
    const rail = box(0.12, 0.9, CITY.pierZ1 - CITY.pierZ0, plankMat);
    rail.position.set(CITY.pierX + side * (CITY.pierHalf - 0.1), 1.35, (CITY.pierZ0 + CITY.pierZ1) / 2);
    city.group.add(rail);
  }

  // A few moored boats beside the pier.
  const hullMat = lambert(0xe8e8e8);
  const boatSpots = [
    { x: 14, z: 165, c: 0xd84a4a },
    { x: 48, z: 178, c: 0x4a7ad8 },
    { x: 12, z: 190, c: 0xe8c84a },
  ];
  for (const spot of boatSpots) {
    const boat = new THREE.Group();
    const hull = box(3, 1.2, 8, lambert(spot.c));
    hull.position.y = 0.4;
    boat.add(hull);
    const deck = box(2.4, 0.5, 5, hullMat);
    deck.position.y = 1.1;
    boat.add(deck);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), poleMat);
    mast.position.y = 3;
    boat.add(mast);
    boat.position.set(spot.x, 0.1, spot.z);
    boat.rotation.y = rng() * 0.6 - 0.3;
    city.group.add(boat);
    city.boats.push(boat);
  }

  // Slow clouds: clusters of white blobs high over the city (unlit, so they
  // stay bright against the sky).
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 2);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + rng() * 5, 8, 6), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set((j - puffs / 2) * 7 + rng() * 3, rng() * 2, rng() * 4 - 2);
      cloud.add(puff);
    }
    cloud.position.set(-140 + rng() * 280, 82 + rng() * 22, -140 + rng() * 220);
    city.group.add(cloud);
  }

  /** Push a circle out of every building and clamp it to the walkable world. */
  city.collide = (x, z, r) => {
    let nx = x;
    let nz = z;
    for (const b of city.buildings) {
      const cx = Math.max(b.minX, Math.min(nx, b.maxX));
      const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          // Dead centre: push out along the nearer axis.
          const pushLeft = nx - (b.minX - r);
          const pushRight = b.maxX + r - nx;
          const pushBack = nz - (b.minZ - r);
          const pushFront = b.maxZ + r - nz;
          const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
          if (m === pushLeft) nx = b.minX - r;
          else if (m === pushRight) nx = b.maxX + r;
          else if (m === pushBack) nz = b.minZ - r;
          else nz = b.maxZ + r;
        }
      }
    }
    nx = Math.max(CITY.min, Math.min(CITY.max, nx));
    // The sea is deep: only the beach and the pier are walkable past the city.
    if (nz > CITY.seaZ) {
      const onPier = Math.abs(nx - CITY.pierX) < CITY.pierHalf - 0.4;
      if (!onPier) nz = CITY.seaZ;
      else nz = Math.min(CITY.pierZ1 - 1, nz);
    }
    if (nz < CITY.min) nz = CITY.min;
    return { x: nx, z: nz };
  };

  /** Is this point on a road (not a sidewalk or a block)? */
  city.onRoad = (x, z) => {
    const near = (v, list) => list.some((c) => Math.abs(v - c) <= CITY.roadHalf);
    return near(x, CITY.roadsX) || near(z, CITY.roadsZ);
  };

  return city;
}
