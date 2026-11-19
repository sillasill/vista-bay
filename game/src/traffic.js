// Traffic: cars that drive the road grid on their own — each follows one road
// in one direction on the right-hand side, and at an intersection it may turn
// onto the crossing road. They slow for the car ahead so the streets feel busy
// without pile-ups.
import { CITY, TRAFFIC_COUNT } from './config.js';
import { createCar, driveCar, syncCar, randomCarColor } from './vehicles.js';
import { pick, randInt } from './random.js';

/** Right-hand lane of a road for this direction of travel. */
function roadLaneCoord(road, dir, vertical) {
  return vertical ? road - dir * 2.6 : road + dir * 2.6;
}

export function createTraffic(scene, rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const vertical = rng() < 0.5;
    const roads = vertical ? CITY.roadsX : CITY.roadsZ;
    const road = pick(rng, roads);
    const dir = rng() < 0.5 ? 1 : -1;
    const along = CITY.min + 10 + rng() * (CITY.max - CITY.min - 20);
    const lane = roadLaneCoord(road, dir, vertical);
    const x = vertical ? lane : along;
    const z = vertical ? along : lane;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const car = createCar(scene, x, z, heading, randomCarColor(rng), 'traffic');
    car.speed = 6 + rng() * 5;
    car.targetSpeed = car.speed;
    car.vertical = vertical;
    car.road = road;
    car.dir = dir;
    car.turnCooldown = randInt(rng, 2, 8);
    cars.push(car);
  }
  return cars;
}

/** Is another car close ahead of `car` on the same road? */
function carAhead(car, cars, playerCar) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  let nearest = Infinity;
  const all = playerCar ? [...cars, playerCar] : cars;
  for (const other of all) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 14 && side < 3.2) nearest = Math.min(nearest, ahead);
  }
  return nearest;
}

export function updateTraffic(game, dt) {
  const { traffic, player } = game;
  const playerCar = player.inCar ? player.car : null;
  for (const car of game.traffic) {
    if (car.dead) continue;
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    const roads = car.vertical ? CITY.roadsZ : CITY.roadsX;
    let onCrossing = false;
    let crossRoad = 0;
    for (const c of roads) {
      const along = car.vertical ? car.z : car.x;
      if (Math.abs(along - c) < 1.2) {
        onCrossing = true;
        crossRoad = c;
        break;
      }
    }
    if (onCrossing && car.turnCooldown <= 0 && game.rng() < 0.35) {
      car.turnCooldown = 3 + game.rng() * 4;
      const newDir = game.rng() < 0.5 ? 1 : -1;
      if (car.vertical) {
        // Turn onto the crossing road: take its right-hand lane for the new direction.
        car.z = roadLaneCoord(crossRoad, newDir, false);
        car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.vertical = false;
        car.road = crossRoad;
        car.dir = newDir;
      } else {
        car.x = roadLaneCoord(crossRoad, newDir, true);
        car.heading = newDir > 0 ? 0 : Math.PI;
        car.vertical = true;
        car.road = crossRoad;
        car.dir = newDir;
      }
    }
    const ahead = carAhead(car, game.traffic, playerCar);
    const want = ahead < 12 ? Math.max(0, (ahead - 5) * 0.8) : car.targetSpeed;
    const throttle = car.speed < want ? 1 : 0;
    const brake = car.speed > want + 0.5;
    driveCar(car, { throttle, steer: 0, brake, handbrake: false }, dt, game.city.collide);
    // Keep traffic on the grid: wrap around the far edge instead of leaving town.
    if (car.vertical) {
      if (car.z > CITY.max + 4) car.z = CITY.min - 4;
      if (car.z < CITY.min - 4) car.z = CITY.max + 4;
    } else {
      if (car.x > CITY.max + 4) car.x = CITY.min - 4;
      if (car.x < CITY.min - 4) car.x = CITY.max + 4;
    }
    syncCar(car);
  }
}
