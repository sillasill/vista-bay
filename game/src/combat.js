// Combat: Rico's pistol (raycast from the camera with a tracer), his fists,
// and the thugs who shoot back. Thugs are spawned by the dockside mission and
// fight until they are all down.
import * as THREE from 'three';
import { addWanted } from './police.js';
import { hurtPlayer } from './player.js';
import { knockDownPed } from './pedestrians.js';

const SHOT_DAMAGE = 34;
const PUNCH_DAMAGE = 25;
const FIRE_INTERVAL = 0.18;

function makeThugMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.72;
  group.add(head);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  band.position.y = 1.86;
  group.add(band);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.25, 0.3);
  group.add(gun);
  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.42, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.42, 0);
  group.add(legR);
  return group;
}

export function createCombat(scene) {
  return {
    scene,
    thugs: [],
    tracers: [],
    fireCooldown: 0,
    raycaster: new THREE.Raycaster(),
  };
}

/** Spawn n thugs around a point, facing the player. */
export function spawnThugs(game, x, z, n) {
  const combat = game.combat;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + game.rng() * 0.8;
    const tx = x + Math.sin(angle) * (4 + game.rng() * 5);
    const tz = z + Math.cos(angle) * (4 + game.rng() * 5);
    const fixed = game.city.collide(tx, tz, 0.8);
    const mesh = makeThugMesh();
    mesh.position.set(fixed.x, 0, fixed.z);
    game.scene.add(mesh);
    combat.thugs.push({
      mesh,
      x: fixed.x,
      z: fixed.z,
      health: 100,
      dead: false,
      shootTimer: 0.8 + game.rng() * 1.2,
      strafe: game.rng() < 0.5 ? -1 : 1,
    });
  }
}

/** Remove every thug (mission reset). */
export function clearThugs(game) {
  for (const thug of game.combat.thugs) game.scene.remove(thug.mesh);
  game.combat.thugs = [];
}

/** How many thugs are still standing? */
export function thugsAlive(game) {
  return game.combat.thugs.filter((t) => !t.dead).length;
}

function addTracer(game, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  game.scene.add(line);
  game.combat.tracers.push({ line, life: 0.09 });
}

export function updateTracers(game, dt) {
  const combat = game.combat;
  for (let i = combat.tracers.length - 1; i >= 0; i--) {
    const t = combat.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09);
    if (t.life <= 0) {
      game.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      combat.tracers.splice(i, 1);
    }
  }
  if (combat.fireCooldown > 0) combat.fireCooldown -= dt;
}

/**
 * Fire the pistol from the camera through the crosshair. Hits the nearest
 * thug, pedestrian, car or building; a thug takes damage, a pedestrian goes
 * down and draws the police, a shot near a cruiser raises the heat.
 */
export function shoot(game) {
  const combat = game.combat;
  if (combat.fireCooldown > 0 || game.screen !== 'play') return;
  combat.fireCooldown = FIRE_INTERVAL;
  const camera = game.camera;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  combat.raycaster.set(origin, dir);
  combat.raycaster.far = 120;

  const targets = [];
  for (const thug of combat.thugs) if (!thug.dead) targets.push(thug.mesh);
  for (const ped of game.peds) if (!ped.down) targets.push(ped.mesh);
  for (const car of [...game.traffic, ...game.parked, ...game.police.cars]) targets.push(car.mesh);
  const hits = combat.raycaster.intersectObjects([...targets, game.city.group], true);
  let end = origin.clone().add(dir.clone().multiplyScalar(120));
  let hitThug = null;
  let hitPed = null;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    let node = hit.object;
    while (node) {
      const thug = combat.thugs.find((t) => t.mesh === node);
      if (thug) {
        hitThug = thug;
        break;
      }
      const ped = game.peds.find((p) => p.mesh === node);
      if (ped) {
        hitPed = ped;
        break;
      }
      node = node.parent;
    }
  }
  // The tracer starts at the gun, just below the camera.
  const muzzle = origin.clone().add(dir.clone().multiplyScalar(0.6));
  muzzle.y -= 0.25;
  addTracer(game, muzzle, end);
  if (game.audio) game.audio.gunshot();
  if (hitThug) {
    hitThug.health -= SHOT_DAMAGE;
    if (hitThug.health <= 0 && !hitThug.dead) {
      hitThug.dead = true;
      hitThug.mesh.rotation.x = -Math.PI / 2;
      hitThug.mesh.position.y = 0.25;
    }
  } else if (hitPed) {
    knockDownPed(hitPed);
    addWanted(game, 1);
    if (game.hud) game.hud.showToast('You hit a pedestrian — the cops noticed.');
  } else {
    // A shot fired near a cruiser raises the heat.
    for (const car of game.police.cars) {
      if (Math.hypot(car.x - game.player.x, car.z - game.player.z) < 25) {
        addWanted(game, 1);
        break;
      }
    }
  }
}

/** A punch: the nearest thug or pedestrian in front, within arm's reach. */
export function punch(game) {
  const player = game.player;
  if (player.inCar) return;
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  let best = null;
  let bestD = 2.4;
  for (const thug of game.combat.thugs) {
    if (thug.dead) continue;
    const dx = thug.x - player.x;
    const dz = thug.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && dx * fx + dz * fz > 0) {
      bestD = d;
      best = { kind: 'thug', ref: thug };
    }
  }
  for (const ped of game.peds) {
    if (ped.down) continue;
    const dx = ped.x - player.x;
    const dz = ped.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && dx * fx + dz * fz > 0) {
      bestD = d;
      best = { kind: 'ped', ref: ped };
    }
  }
  if (!best) return;
  if (game.audio) game.audio.punch();
  if (best.kind === 'thug') {
    best.ref.health -= PUNCH_DAMAGE;
    if (best.ref.health <= 0 && !best.ref.dead) {
      best.ref.dead = true;
      best.ref.mesh.rotation.x = -Math.PI / 2;
      best.ref.mesh.position.y = 0.25;
    }
  } else {
    knockDownPed(best.ref);
    addWanted(game, 1);
  }
}

/** Thugs shoot back: they face the player, keep their distance and fire with a miss chance that grows with range. */
export function updateThugs(game, dt) {
  const player = game.player;
  for (const thug of game.combat.thugs) {
    if (thug.dead) continue;
    const dx = player.x - thug.x;
    const dz = player.z - thug.z;
    const dist = Math.hypot(dx, dz);
    thug.mesh.rotation.y = Math.atan2(dx, dz);
    // Keep a fighting distance: close in when far, back off when crowded.
    let move = 0;
    if (dist > 16) move = 2.2;
    else if (dist < 7) move = -1.6;
    if (move !== 0) {
      const nx = thug.x + (dx / dist) * move * dt;
      const nz = thug.z + (dz / dist) * move * dt;
      const fixed = game.city.collide(nx, nz, 0.6);
      thug.x = fixed.x;
      thug.z = fixed.z;
      thug.mesh.position.set(thug.x, 0, thug.z);
    }
    thug.shootTimer -= dt;
    if (thug.shootTimer <= 0 && dist < 42 && game.screen === 'play') {
      thug.shootTimer = 1.3 + game.rng() * 1.1;
      const from = new THREE.Vector3(thug.x, 1.3, thug.z);
      const to = new THREE.Vector3(player.x, 1.2, player.z);
      addTracer(game, from, to);
      if (game.audio) game.audio.thugShot();
      // A thug hits more often up close; far shots mostly miss.
      const hitChance = Math.max(0.12, 0.55 - dist * 0.012);
      if (game.rng() < hitChance) {
        if (hurtPlayer(player, 7 + Math.floor(game.rng() * 7))) {
          game.onBusted('WASTED');
        }
      }
    }
  }
}
