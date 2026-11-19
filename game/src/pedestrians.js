// Pedestrians: people walking the sidewalks — each follows a sidewalk line in
// one direction and, at an intersection, may turn onto the crossing sidewalk.
// A pedestrian who is hit falls and stays down; hitting one draws the police.
import * as THREE from 'three';
import { CITY, PED_COUNT } from './config.js';
import { pick, randInt } from './random.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x4a9e5c, 0x8a5ac2, 0xe07a2a, 0xd8d8d8, 0x2a9e9e];

function makePedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.52;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.13, 0.34, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.13, 0.34, 0);
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const vertical = rng() < 0.5;
    const roads = vertical ? CITY.roadsX : CITY.roadsZ;
    const road = pick(rng, roads);
    const side = rng() < 0.5 ? -1 : 1;
    const offset = CITY.roadHalf + CITY.sidewalk / 2;
    const lane = road + side * offset;
    const along = CITY.min + 8 + rng() * (CITY.max - CITY.min - 16);
    const x = vertical ? lane : along;
    const z = vertical ? along : lane;
    const dir = rng() < 0.5 ? 1 : -1;
    const mesh = makePedMesh(pick(rng, SHIRTS), pick(rng, [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4a30]));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      vertical,
      road,
      side,
      dir,
      speed: 1.1 + rng() * 0.7,
      phase: rng() * Math.PI * 2,
      down: false,
      downTimer: 0,
      turnCooldown: randInt(rng, 2, 9),
    });
  }
  return peds;
}

export function syncPed(ped) {
  ped.mesh.position.set(ped.x, 0, ped.z);
  const heading = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  ped.mesh.rotation.y = heading;
  const u = ped.mesh.userData;
  const swing = ped.down ? 0 : Math.sin(ped.phase) * 0.5;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
}

export function updatePedestrians(game, dt) {
  for (const ped of game.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // They get back up and hurry off.
        ped.down = false;
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
        ped.speed = 2.2;
      }
      continue;
    }
    ped.turnCooldown -= dt;
    ped.phase += dt * ped.speed * 5;
    const step = ped.speed * ped.dir * dt;
    if (ped.vertical) ped.z += step;
    else ped.x += step;
    // At an intersection, sometimes turn onto the crossing sidewalk.
    const roads = ped.vertical ? CITY.roadsZ : CITY.roadsX;
    let crossing = false;
    let crossRoad = 0;
    for (const c of roads) {
      const along = ped.vertical ? ped.z : ped.x;
      if (Math.abs(along - c) < 0.9) {
        crossing = true;
        crossRoad = c;
        break;
      }
    }
    if (crossing && ped.turnCooldown <= 0 && game.rng() < 0.3) {
      ped.turnCooldown = 3 + game.rng() * 5;
      const newSide = game.rng() < 0.5 ? -1 : 1;
      const offset = CITY.roadHalf + CITY.sidewalk / 2;
      const newDir = game.rng() < 0.5 ? 1 : -1;
      if (ped.vertical) {
        ped.z = crossRoad + newSide * offset;
        ped.vertical = false;
        ped.side = newSide;
        ped.dir = newDir;
      } else {
        ped.x = crossRoad + newSide * offset;
        ped.vertical = true;
        ped.side = newSide;
        ped.dir = newDir;
      }
    }
    // Wrap around the far edge so the sidewalks never empty out.
    if (ped.vertical) {
      if (ped.z > CITY.max) ped.z = CITY.min;
      if (ped.z < CITY.min) ped.z = CITY.max;
    } else {
      if (ped.x > CITY.max) ped.x = CITY.min;
      if (ped.x < CITY.min) ped.x = CITY.max;
    }
    syncPed(ped);
  }
}

/** Knock a pedestrian down (a hit, or a car clipping them). */
export function knockDownPed(ped) {
  if (ped.down) return;
  ped.down = true;
  ped.downTimer = 6;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.25;
}
