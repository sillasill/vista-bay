// The screenshot scenes behind ?shot=1-chase|2-street|3-mission|4-start.
// Shot mode never steps the simulation: every actor's mesh is placed exactly
// where the camera will see it, so the frame is what a real moment of play
// looks like and the same seed always gives the same frame.
import * as THREE from 'three';
import { CITY } from './config.js';
import { createCar, syncCar } from './vehicles.js';
import { syncPed } from './pedestrians.js';
import { syncPlayer } from './player.js';
import { setMissionStep } from './missions.js';
import { spawnThugs } from './combat.js';

/** Place the camera behind a focus point, looking along a heading. */
function behindCamera(game, x, z, heading, dist, height, lookAhead = 8) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  game.shotCam = {
    pos: new THREE.Vector3(x - fx * dist, height, z - fz * dist),
    look: new THREE.Vector3(x + fx * lookAhead, 1.2, z + fz * lookAhead),
  };
}

/** Put a traffic car on an exact spot, facing an exact heading. */
function placeTrafficCar(game, i, x, z, heading, speed) {
  const car = game.traffic[i % game.traffic.length];
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.targetSpeed = speed;
  car.vertical = Math.abs(Math.sin(heading)) < 0.5;
  syncCar(car);
  return car;
}

/** Put a pedestrian on an exact sidewalk spot. */
function placePed(game, i, x, z, vertical, dir) {
  const ped = game.peds[i % game.peds.length];
  ped.x = x;
  ped.z = z;
  ped.vertical = vertical;
  ped.dir = dir;
  ped.down = false;
  ped.mesh.rotation.x = 0;
  ped.mesh.position.y = 0;
  syncPed(ped);
  return ped;
}

/** 1-chase: Rico driving north on Harbor Row with cruisers closing in. */
function stageChase(game) {
  const player = game.player;
  const hero = game.parked[0];
  hero.x = 0;
  hero.z = 40;
  hero.heading = Math.PI;
  hero.speed = 25;
  syncCar(hero);
  player.inCar = true;
  player.car = hero;
  player.mesh.visible = false;
  player.x = hero.x;
  player.z = hero.z;
  player.camYaw = Math.PI;
  // Two cruisers ahead, turning in to intercept, and one right behind.
  const c1 = createCar(game.scene, -4, 24, 0, 0x1a1a22, 'police', true);
  c1.speed = 24;
  syncCar(c1);
  const c2 = createCar(game.scene, 5, 14, 0, 0x1a1a22, 'police', true);
  c2.speed = 24;
  syncCar(c2);
  const c3 = createCar(game.scene, -4, 43, Math.PI, 0x1a1a22, 'police', true);
  c3.speed = 27;
  syncCar(c3);
  game.police.cars.push(c1, c2, c3);
  game.police.stars = 3;
  game.police.heat = 0;
  // A little traffic ahead so the street feels alive.
  placeTrafficCar(game, 0, 2.6, 0, 0, 9);
  placeTrafficCar(game, 1, -2.6, -18, Math.PI, 9);
  placeTrafficCar(game, 2, 2.6, -38, 0, 8);
  placePed(game, 0, -6.8, 28, true, 1);
  placePed(game, 1, 6.8, 12, true, -1);
  setMissionStep(game, 3, 1, 1850);
  game.hud.showDialogue('Marla Voss', '"The whole city\'s coming for you — run!"', 30);
  behindCamera(game, 0, 40, Math.PI, 13, 4.6, 16);
  game.screen = 'play';
}

/** 2-street: Rico on foot, traffic and pedestrians ahead of him on the street. */
function stageStreet(game) {
  const player = game.player;
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  player.x = 0;
  player.z = 40;
  player.y = 0;
  player.yaw = Math.PI;
  player.camYaw = Math.PI;
  player.camPitch = -0.08;
  syncPlayer(player);
  // Traffic ahead, both directions, on the road in front of the player.
  placeTrafficCar(game, 0, 2.6, 24, 0, 9);
  placeTrafficCar(game, 1, -2.6, 8, Math.PI, 9);
  placeTrafficCar(game, 2, 2.6, -10, 0, 8);
  placeTrafficCar(game, 3, -2.6, -28, Math.PI, 10);
  placeTrafficCar(game, 4, 47.6, -45, Math.PI / 2, 8);
  // Pedestrians ahead on both sidewalks.
  placePed(game, 0, -6.8, 30, true, 1);
  placePed(game, 1, 6.8, 22, true, -1);
  placePed(game, 2, -6.8, 12, true, -1);
  placePed(game, 3, 6.8, 2, true, 1);
  placePed(game, 4, -6.8, -12, true, 1);
  placePed(game, 5, 6.8, -24, true, -1);
  setMissionStep(game, 1, 0, 800);
  game.hud.showDialogue('Marla Voss', '"Three packages, three corners of Vista Bay. Drop them off."', 30);
  behindCamera(game, 0, 40, Math.PI, 6.5, 3.1, 14);
  game.screen = 'play';
}

/** 3-mission: the pier firefight — Rico, three thugs, the beam and the sea. */
function stageMission(game) {
  const player = game.player;
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  player.x = 30;
  player.z = 152;
  player.y = 0;
  player.yaw = 0;
  player.camYaw = 0;
  player.camPitch = -0.06;
  syncPlayer(player);
  spawnThugs(game, 30, 172, 3);
  // The thugs stand between Rico and the beam, flanking it, so none of them
  // is hidden behind the column of light. All three stay on the pier deck.
  const spots = [
    { x: 28, z: 166 },
    { x: 32, z: 166 },
    { x: 30, z: 164 },
  ];
  game.combat.thugs.forEach((thug, i) => {
    thug.x = spots[i].x;
    thug.z = spots[i].z;
    thug.mesh.position.set(thug.x, 0, thug.z);
    thug.mesh.rotation.y = Math.PI;
  });
  setMissionStep(game, 2, 1, 1300);
  game.hud.showDialogue('Marla Voss', '"There they are. Drop them all."', 30);
  behindCamera(game, 30, 152, 0, 6.5, 3.2, 16);
  game.screen = 'play';
}

/** 4-start: the title screen over a wide view of the city, beach and sea. */
function stageStart(game) {
  game.shotCam = {
    pos: new THREE.Vector3(42, 52, -122),
    look: new THREE.Vector3(-6, 0, 60),
  };
  game.screen = 'title';
}

/**
 * Set the game to the named scene (1-chase, 2-street, 3-mission or 4-start;
 * any other name is the start screen).
 */
export function stageShot(name, game) {
  // A clean slate: full health, no stray thugs, no police left over.
  game.player.health = 100;
  game.police.stars = 0;
  for (const car of game.police.cars) game.scene.remove(car.mesh);
  game.police.cars = [];
  for (const thug of game.combat.thugs) game.scene.remove(thug.mesh);
  game.combat.thugs = [];
  if (name === '1-chase') stageChase(game);
  else if (name === '2-street') stageStreet(game);
  else if (name === '3-mission') stageMission(game);
  else stageStart(game);
}
