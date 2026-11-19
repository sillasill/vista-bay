// Rico Santana on foot: third-person movement relative to the camera, sprint,
// jump and gravity, plus getting into and out of cars. The mesh is a simple
// figure — torso, head, arms and legs — with a walk swing while moving.
import * as THREE from 'three';
import { PLAYER } from './config.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e8f86 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.72;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
  cap.position.y = 1.9;
  group.add(cap);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.4, 1.2, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.4, 1.2, 0);
  group.add(armR);
  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.42, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.42, 0);
  group.add(legR);
  group.userData = { armL, armR, legL, legR, torso };
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    y: 0,
    vy: 0,
    yaw: Math.PI,
    pitch: -0.12,
    camYaw: Math.PI,
    camPitch: -0.12,
    onGround: true,
    health: PLAYER.health,
    inCar: false,
    car: null,
    moving: false,
    walkPhase: 0,
    hurtCooldown: 0,
  };
}

/** Copy the player's state onto its mesh, with a walk swing while moving. */
export function syncPlayer(player) {
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.yaw;
  const u = player.mesh.userData;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
  u.torso.position.y = 1.18 + (player.moving ? Math.abs(Math.sin(player.walkPhase)) * 0.05 : 0);
}

/**
 * Move on foot: WASD relative to the camera yaw, sprint with Shift, jump with
 * Space, gravity, and building collision. `move` is { f, s } from input.
 */
export function updatePlayerOnFoot(player, move, sprint, jump, dt, city) {
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  let mx = 0;
  let mz = 0;
  if (move.f !== 0 || move.s !== 0) {
    // Forward is where the camera looks; strafe is perpendicular to it.
    const fx = sin;
    const fz = cos;
    const sx = -cos;
    const sz = sin;
    mx = fx * move.f + sx * move.s;
    mz = fz * move.f + sz * move.s;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    player.yaw = Math.atan2(mx, mz);
  }
  player.moving = move.f !== 0 || move.s !== 0;
  if (player.moving) player.walkPhase += dt * (sprint ? 13 : 9);
  const targetVX = mx * speed;
  const targetVZ = mz * speed;
  const nx = player.x + targetVX * dt;
  const nz = player.z + targetVZ * dt;
  const fixed = city.collide(nx, nz, PLAYER.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  if (jump && player.onGround) {
    player.vy = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  player.vy -= PLAYER.gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.onGround = true;
  }
  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
  syncPlayer(player);
}

/** Step into the nearest car within reach; returns the car or null. */
export function enterCar(player, cars) {
  let best = null;
  let bestD = 4.5;
  for (const car of cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  player.inCar = true;
  player.car = best;
  player.mesh.visible = false;
  best.kind = 'player';
  return best;
}

/** Step out beside the car, on the driver's side. */
export function exitCar(player, city) {
  const car = player.car;
  if (!car) return;
  const sideX = car.x + Math.cos(car.heading) * 2.2;
  const sideZ = car.z - Math.sin(car.heading) * 2.2;
  const fixed = city.collide(sideX, sideZ, PLAYER.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  player.y = 0;
  player.vy = 0;
  player.yaw = car.heading;
  player.camYaw = car.heading;
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  syncPlayer(player);
}

/** Hurt the player; returns true when this hit busts them. */
export function hurtPlayer(player, amount) {
  if (player.hurtCooldown > 0 || player.health <= 0) return false;
  player.health -= amount;
  player.hurtCooldown = 0.5;
  if (player.health < 0) player.health = 0;
  return player.health <= 0;
}
