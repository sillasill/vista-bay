// The wanted system: stars rise with crimes and decay when Rico lies low.
// Police cars spawn at the edge of town, chase the player and ram them; their
// light bars flash while the chase is on.
import { CITY, MAX_POLICE, WANTED } from './config.js';
import { createCar, driveCar, syncCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function createPolice() {
  return {
    stars: 0,
    heat: 0,
    cars: [],
    spawnTimer: 0,
    flash: 0,
  };
}

/** Raise the wanted level by n stars (capped) and reset the decay clock. */
export function addWanted(game, n) {
  const police = game.police;
  police.stars = Math.min(WANTED.maxStars, police.stars + n);
  police.heat = 0;
}

/** Drop the wanted level to zero (mission escapes and clean getaways). */
export function clearWanted(game) {
  game.police.stars = 0;
  game.police.heat = 0;
  for (const car of game.police.cars) game.scene.remove(car.mesh);
  game.police.cars = [];
}

function spawnPoliceCar(game) {
  const player = game.player;
  const angle = game.rng() * Math.PI * 2;
  const dist = 55 + game.rng() * 20;
  let x = player.x + Math.sin(angle) * dist;
  let z = player.z + Math.cos(angle) * dist;
  x = Math.max(CITY.min + 4, Math.min(CITY.max - 4, x));
  z = Math.max(CITY.min + 4, Math.min(CITY.max - 4, z));
  const fixed = game.city.collide(x, z, 2);
  const car = createCar(game.scene, fixed.x, fixed.z, game.rng() * Math.PI * 2, 0x1a1a22, 'police', true);
  car.targetSpeed = 26;
  game.police.cars.push(car);
  return car;
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updatePolice(game, dt) {
  const police = game.police;
  const player = game.player;
  police.flash += dt;

  // Stars decay after lying low with no new crime.
  if (police.stars > 0) {
    police.heat += dt;
    if (police.heat > WANTED.decaySeconds) {
      police.stars -= 1;
      police.heat = 0;
      if (police.stars === 0) {
        for (const car of police.cars) game.scene.remove(car.mesh);
        police.cars = [];
      }
    }
  }

  // Keep the right number of cruisers on the road.
  const wanted = police.stars > 0 ? Math.min(police.stars, MAX_POLICE) : 0;
  police.spawnTimer -= dt;
  if (police.cars.length < wanted && police.spawnTimer <= 0) {
    spawnPoliceCar(game);
    police.spawnTimer = 1.5;
  }
  while (police.cars.length > wanted) {
    const car = police.cars.pop();
    game.scene.remove(car.mesh);
  }

  // Chase: steer toward the player, ram them, flash the light bar.
  const px = player.inCar && player.car ? player.car.x : player.x;
  const pz = player.inCar && player.car ? player.car.z : player.z;
  for (const car of police.cars) {
    const desired = Math.atan2(px - car.x, pz - car.z);
    const turn = angleDelta(desired, car.heading);
    const steer = Math.max(-1, Math.min(1, turn * 1.8));
    const dist = Math.hypot(px - car.x, pz - car.z);
    const targetSpeed = dist > 30 ? 30 : 24;
    const throttle = car.speed < targetSpeed ? 1 : 0;
    driveCar(car, { throttle, steer, brake: false, handbrake: false }, dt, game.city.collide);
    syncCar(car);
    // Ram: bump the player's car, or knock Rico down on foot.
    if (dist < 3.4) {
      if (player.inCar && player.car) {
        player.car.speed *= 0.82;
        if (game.audio && game.rng() < 0.5) game.audio.crash();
      } else if (hurtPlayer(player, 12)) {
        game.onBusted('BUSTED');
      }
    }
    // Flash the light bar, red and blue alternating.
    const on = Math.floor(police.flash * 4) % 2 === 0;
    const red = car.mesh.userData.lightRed;
    const blue = car.mesh.userData.lightBlue;
    if (red && blue) {
      red.material.emissive.setHex(on ? 0xff0000 : 0x220000);
      blue.material.emissive.setHex(on ? 0x000022 : 0x0022ff);
    }
  }
}
