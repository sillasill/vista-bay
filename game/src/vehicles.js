// Cars: one mesh builder and one arcade driving model, shared by the player's
// car, parked cars, traffic and the police. A car is a low box body, a cabin, a
// windshield and four wheels; its state is a position, a heading and a speed.
import * as THREE from 'three';
import { CAR, CITY } from './config.js';

const BODY_COLORS = [0xc23b3b, 0x3b6ec2, 0xe8c84a, 0x4a9e5c, 0x8a5ac2, 0xd8d8d8, 0x2a2a2e, 0xe07a2a];

let wheelGeo = null;
let bodyGeo = null;
let cabinGeo = null;

/** Build the mesh for a car of the given body colour. */
export function makeCarMesh(color, police = false) {
  if (!wheelGeo) {
    wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    bodyGeo = new THREE.BoxGeometry(CAR.width, 0.62, CAR.length);
    cabinGeo = new THREE.BoxGeometry(CAR.width * 0.82, 0.55, CAR.length * 0.45);
  }
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.08, -0.2);
  group.add(cabin);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4e0 });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(CAR.width * 0.8, 0.4, 0.08), glassMat);
  shield.position.set(0, 1.0, 0.95);
  shield.rotation.x = -0.35;
  group.add(shield);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so cars read at a glance.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x555533 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
    head.position.set(x, 0.62, CAR.length / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.06),
      new THREE.MeshLambertMaterial({ color: 0xc22a2a, emissive: 0x330000 }),
    );
    tail.position.set(x, 0.62, -CAR.length / 2 - 0.01);
    group.add(tail);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x881111 }));
    red.position.set(-0.27, 1.52, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x111188 }));
    blue.position.set(0.27, 1.52, -0.2);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

/** Create a car entity and add its mesh to the scene. */
export function createCar(scene, x, z, heading, color, kind = 'parked', police = false) {
  const mesh = makeCarMesh(color, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    kind,
    police,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    color,
    dead: false,
    wheelSpin: 0,
  };
}

/** Copy a car's state onto its mesh (position, heading, spinning wheels). */
export function syncCar(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * 0.06;
  const wheels = car.mesh.userData.wheels;
  for (const wheel of wheels) wheel.rotation.x = car.wheelSpin;
}

/**
 * Arcade driving: accelerate, brake and reverse on the forward axis, steer
 * harder the slower the car goes, drag bleeds speed, and a handbrake cuts grip
 * so the car slides. `drive` is { throttle: -1..1, steer: -1..1, brake, handbrake }.
 */
export function driveCar(car, drive, dt, collide) {
  const forward = Math.abs(car.speed) > 0.3;
  let accel = 0;
  if (drive.throttle > 0) accel = CAR.accel * drive.throttle;
  else if (drive.throttle < 0) accel = car.speed > 0.5 ? -CAR.brake : CAR.reverseAccel * drive.throttle;
  if (drive.brake) accel = car.speed > 0.5 ? -CAR.brake : car.speed < -0.5 ? CAR.brake : 0;
  car.speed += accel * dt;
  if (drive.handbrake) car.speed -= car.speed * CAR.handbrake * 0.12 * dt * 4;
  car.speed -= car.speed * 0.35 * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;
  const steerAmount = drive.steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 8) * (car.speed < 0 ? -1 : 1);
  car.heading += steerAmount * dt * (drive.handbrake ? 1.6 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (collide) {
    const fixed = collide(nx, nz, 1.6);
    if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
      // A wall stops the car, hard.
      car.speed *= 0.35;
    }
    car.x = fixed.x;
    car.z = fixed.z;
  } else {
    car.x = nx;
    car.z = nz;
  }
  if (forward) syncCar(car);
  return car.speed;
}

/** A parked-car colour the player has not claimed yet. */
export function randomCarColor(rng) {
  return BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
}

/** Clamp a car inside the drivable world (city, beach and pier). */
export function clampCarToWorld(car) {
  car.x = Math.max(CITY.min, Math.min(CITY.max, car.x));
  if (car.z > CITY.seaZ) {
    const onPier = Math.abs(car.x - CITY.pierX) < CITY.pierHalf - 0.6;
    car.z = onPier ? Math.min(CITY.pierZ1 - 2, car.z) : CITY.seaZ;
  }
  if (car.z < CITY.min) car.z = CITY.min;
}
