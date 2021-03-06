import { polyPoly } from "./collision";
import World, { Maybe } from "./lib/world";

interface Globals {
  context?: CanvasRenderingContext2D;
  deltaTime: number;
  input: { accelerate: boolean; shoot: boolean; turnLeft: boolean; turnRight: boolean };
  size: { width: number; height: number };
}

export type GameWorld = World<Globals>;

export const world = new World<Globals>({
  deltaTime: 0,
  input: { accelerate: false, shoot: false, turnLeft: false, turnRight: false },
  size: { width: 0, height: 0 },
});

/* C O M P O N E N T S */

const asteroid = world.addComponent("asteroid", (timesExploded: number = 0) => ({ exploding: false, timesExploded }));

const collider = world.addComponent("collider", () => ({ collidingWith: 0 }));

const friction = world.addComponent("friction", (amount: number) => ({ amount }));

const player = world.addComponent("player");

interface PolygonOptions {
  fillStyle?: string;
  lineWidth?: number;
  strokeStyle?: string;
}

const polygon = world.addComponent("polygon", (options: PolygonOptions, ...points: [number, number][]) => {
  return { options, points };
});

const position = world.addComponent("position", (x: number, y: number) => ({ x, y }));

const projectile = world.addComponent("projectile");

const rotation = world.addComponent("rotation", (angle: number, delta: number) => {
  return { angle, delta, lastAngle: 0 };
});

const selfDestruct = world.addComponent("selfDestruct", (time: number) => {
  return { age: 0, time };
});

const shooter = world.addComponent("shooter", (rate: number, shooting: boolean = false) => {
  return { cooldown: 0, rate, shooting };
});

const velocity = world.addComponent("velocity", (vx: number, vy: number) => ({ vx, vy }));

const wrapsAround = world.addComponent("wrapsAround");

/* S Y S T E M S */

// Make objects with velocity slow down over time.
world.addSystem("friction", [friction, velocity], (world, entities, frictions, velocities) => {
  const dt = world.globals.deltaTime;
  for (const { id } of entities) {
    const { amount } = frictions.get(id);
    const velocity = velocities.get(id);
    velocity.vx *= 1 - amount * dt;
    velocity.vy *= 1 - amount * dt;
  }
});

// Wrap objects that move outside the screen area around to the other side.
world.addSystem("wrap", [wrapsAround, position, velocity], (world, entities, positions, velocities) => {
  // TODO: Handle extreme cases where objects should wrap 2+ times.
  const dt = world.globals.deltaTime;
  const { width, height } = world.globals.size;
  const padding = 30;
  // Returns a 2-bit mask for outside horizontally/vertically.
  function outside(x: number, y: number) {
    return (x < -padding || x >= width + padding ? 1 : 0) | (y < -padding || y >= height + padding ? 2 : 0);
  }
  for (const { id } of entities) {
    const position = positions.get(id);
    const { vx, vy } = velocities.get(id);
    if (outside(position.x, position.y)) {
      // Ignore objects that were already outside the wrapping area.
      continue;
    }
    const outsideAfterMoving = outside(position.x + vx * dt, position.y + vy * dt);
    if (outsideAfterMoving & 1) {
      // Wrap objects horizontally.
      position.x += vx < 0 ? padding + width + padding : -(padding + width + padding);
    }
    if (outsideAfterMoving & 2) {
      // Wrap objects vertically.
      position.y += vy < 0 ? padding + height + padding : -(padding + height + padding);
    }
  }
});

// Make objects with position and velocity move.
world.addSystem("move", [position, velocity], (world, entities, positions, velocities) => {
  const dt = world.globals.deltaTime;
  for (const { id } of entities) {
    const position = positions.get(id);
    const { vx, vy } = velocities.get(id);
    position.x += vx * dt;
    position.y += vy * dt;
  }
});

// Let the player control player entities.
world.addSystem(
  "playerControl",
  [player, rotation, velocity, Maybe(shooter)],
  (world, entities, rotations, velocities, shooters) => {
    const ACCELERATION = 0.1;
    const MAX_VELOCITY = 3;
    const TURN_SPEED = 0.05;
    const { accelerate, shoot, turnLeft, turnRight } = world.globals.input;
    for (const { id } of entities) {
      const rotation = rotations.get(id);
      rotation.delta = turnLeft !== turnRight ? (turnLeft ? -TURN_SPEED : TURN_SPEED) : 0;
      // Accelerate the ship in its current direction up to a max velocity.
      if (accelerate) {
        const velocity = velocities.get(id);
        const dx = Math.cos(rotation.angle) * ACCELERATION;
        const dy = Math.sin(rotation.angle) * ACCELERATION;
        [velocity.vx, velocity.vy] = limitVector(velocity.vx + dx, velocity.vy + dy, MAX_VELOCITY);
      }
      const shooter = shooters.get(id);
      if (shooter) shooter.shooting = shoot;
    }
  }
);

// Make polygons rotate.
world.addSystem("rotatePolygons", [rotation, polygon], (world, entities, rotations, polygons) => {
  for (const { id } of entities) {
    const rotation = rotations.get(id);
    const amount = rotation.angle - rotation.lastAngle;
    const polygon = polygons.get(id);
    for (let i = 0; i < polygon.points.length; i++) {
      const [x, y] = polygon.points[i];
      const angle = Math.atan2(y, x) + amount;
      const distance = Math.sqrt(x * x + y * y);
      // TODO: If this drifts too much, replace with two arrays.
      polygon.points[i] = [distance * Math.cos(angle), distance * Math.sin(angle)];
    }
  }
});

// Update rotation angle with the rotation delta.
world.addSystem("rotate", [rotation], (world, entities, rotations) => {
  const dt = world.globals.deltaTime;
  for (const { id } of entities) {
    const rotation = rotations.get(id);
    // Store the angle on the component in case angle is changed by another system.
    rotation.lastAngle = rotation.angle;
    rotation.angle += (rotation.delta * dt) % TAU;
  }
});

// Destroy objects after a certain time if they have the component.
world.addSystem("selfDestruction", [selfDestruct], (world, entities, selfDestructors) => {
  const dt = world.globals.deltaTime;
  for (const { id } of entities) {
    const selfDestructor = selfDestructors.get(id);
    selfDestructor.age += dt;
    if (selfDestructor.age < selfDestructor.time) continue;
    world.destroyEntity(id);
  }
});

// Allow objects to shoot projectiles.
world.addSystem("shooting", [position, rotation, shooter], (world, entities, positions, rotations, shooters) => {
  const dt = world.globals.deltaTime;
  for (const { id } of entities) {
    const { x, y } = positions.get(id);
    const { angle } = rotations.get(id);
    const shooter = shooters.get(id);
    shooter.cooldown = Math.max(shooter.cooldown - dt, 0);
    if (!shooter.shooting || shooter.cooldown > 0) continue;
    shooter.cooldown = shooter.rate;
    createProjectile(x, y, angle, 5);
  }
});

// Make polygons collide when they overlap.
world.addSystem("collidePolygons", [collider, position, polygon], (world, entities, colliders, positions, polygons) => {
  // Reset collisions every step.
  for (const { id } of entities) {
    const collider = colliders.get(id);
    collider.collidingWith = 0;
  }
  // WARNING: Naïve "check every pair" logic. Needs to use spatial mapping for performance!
  for (let i = 0; i < entities.length; i++) {
    const { id: id1, mask: mask1 } = entities[i];
    const collider1 = colliders.get(id1);
    // Check all other entities (but no duplicate pairs).
    for (let j = i + 1; j < entities.length; j++) {
      const { id: id2, mask: mask2 } = entities[j];
      // Check if the two polygons are overlapping.
      const pos1 = positions.get(id1);
      const points1 = polygons.get(id1).points.map(([x, y]) => [x + pos1.x, y + pos1.y] as [number, number]);
      const pos2 = positions.get(id2);
      const points2 = polygons.get(id2).points.map(([x, y]) => [x + pos2.x, y + pos2.y] as [number, number]);
      if (!polyPoly(points1, points2)) continue;
      // There's a collision! Keep a record of all component types they're colliding with.
      const collider2 = colliders.get(id2);
      collider1.collidingWith |= mask2;
      collider2.collidingWith |= mask1;
    }
  }
});

// Set all asteroids that have collided with a projectile to explode.
world.addSystem("collideAsteroids", [collider, asteroid], (world, entities, colliders, asteroids) => {
  for (const { id } of entities) {
    const collider = colliders.get(id);
    if (collider.collidingWith & world.bit(projectile)) {
      asteroids.get(id).exploding = true;
    }
  }
});

// Destroy all projectiles that have collided with an asteroid.
world.addSystem("destroyProjectiles", [collider, projectile], (world, entities, colliders) => {
  for (const { id } of entities) {
    const collider = colliders.get(id);
    if (collider.collidingWith & world.bit(asteroid)) {
      world.destroyEntity(id);
    }
  }
});

// Make asteroids split into fragments when they are set to explode.
world.addSystem("explodingAsteroids", [asteroid, position], (world, entities, asteroids, positions) => {
  for (const { id } of entities) {
    // Check if asteroid is exploding, and skip it if it isn't.
    const { exploding, timesExploded } = asteroids.get(id);
    if (!exploding) continue;
    // Remove this asteroid instance from the world.
    world.destroyEntity(id);
    // Don't explode infinitely.
    if (timesExploded >= 2) continue;
    // Create smaller fragments.
    const { x, y } = positions.get(id);
    const NUM_FRAGMENTS = 3;
    let angle = (Math.random() * TAU) / NUM_FRAGMENTS;
    const size = 10 / (timesExploded + 1);
    const radius = size * 2;
    for (let i = 0; i < NUM_FRAGMENTS; i++) {
      createAsteroid(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        Math.cos(angle),
        Math.sin(angle),
        size,
        timesExploded + 1
      );
      angle += TAU / NUM_FRAGMENTS;
    }
  }
});

// Clear the screen every frame.
world.addSystem("clearScreen", [], (world, entities) => {
  const ctx = world.globals.context;
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
});

// Draw all polygons on screen.
world.addSystem("drawPolys", [polygon, position], (world, entities, polygons, positions) => {
  const ctx = world.globals.context;
  if (!ctx) return;
  for (const { id } of entities) {
    const { options, points } = polygons.get(id);
    const { x, y } = positions.get(id);
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let j = 1; j < points.length; j++) {
      ctx.lineTo(...points[j]);
    }
    ctx.closePath();
    if (options.fillStyle) {
      ctx.fillStyle = options.fillStyle;
      ctx.fill();
    }
    if (options.strokeStyle) {
      if (options.lineWidth) ctx.lineWidth = options.lineWidth;
      ctx.strokeStyle = options.strokeStyle;
      ctx.stroke();
    }
    ctx.restore();
  }
});

/* E N T I T Y   C R E A T I O N */

const TAU = Math.PI * 2;

function createAsteroid(x: number, y: number, vx: number, vy: number, size: number, timesExploded?: number) {
  // Create a list of points for the asteroid.
  const points: [number, number][] = [];
  for (let a = 0; a < TAU; a += TAU / 12) {
    // Vary the point distance from the center of the asteroid.
    const variation = Math.random() * 8;
    // Add the point to the list of polygon points.
    points.push([Math.cos(a) * (size + variation), Math.sin(a) * (size + variation)]);
  }
  return world
    .entity()
    .with(asteroid, timesExploded)
    .with(wrapsAround)
    .with(collider)
    .with(polygon, { lineWidth: 1.5, strokeStyle: "#eec" }, ...points)
    .with(position, x, y)
    .with(rotation, Math.random() * TAU, (Math.random() - 0.5) * 0.01)
    .with(velocity, vx, vy)
    .create();
}

export function createRandomAsteroid() {
  const cx = world.globals.size.width / 2;
  const cy = world.globals.size.height / 2;
  const radius = Math.max(cx, cy) + 60;
  // The asteroid will be placed randomly along a circle around the viewport.
  const angle = Math.random() * TAU;
  // Place the asteroid at the specified radius from center.
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  // The angle that the asteroid will be moving in (~opposite of position angle).
  const antiAngle = angle - Math.PI + ((Math.random() - 0.5) * TAU) / 6;
  // Set a random velocity for the asteroid.
  const velocityMagnitude = 0.3 + Math.random() * 0.5;
  const vx = velocityMagnitude * Math.cos(antiAngle);
  const vy = velocityMagnitude * Math.sin(antiAngle);
  // Determine minimum size for the asteroid.
  const size = 10 + Math.random() * 8;
  // Create the asteroid.
  return createAsteroid(x, y, vx, vy, size);
}

export function createPlayer(x: number, y: number, { vx = 0, vy = 0 } = {}) {
  return world
    .entity()
    .with(player)
    .with(wrapsAround)
    .with(collider)
    .with(friction, 0.04)
    .with(polygon, { strokeStyle: "#0f0" }, [9, 0], [-9, 8], [-6, 0], [-9, -8])
    .with(position, x, y)
    .with(rotation, -Math.PI / 2, 0)
    .with(shooter, 10)
    .with(velocity, vx, vy)
    .create();
}

function createProjectile(x: number, y: number, direction: number, speed: number, offset: number = 10) {
  return world
    .entity()
    .with(projectile)
    .with(collider)
    .with(polygon, { fillStyle: "#ff0" }, [2, 0], [-2, 1], [-2, -1])
    .with(position, x + Math.cos(direction) * offset, y + Math.sin(direction) * offset)
    .with(rotation, direction, 0)
    .with(selfDestruct, 50)
    .with(velocity, Math.cos(direction) * speed, Math.sin(direction) * speed)
    .create();
}

/* U T I L I T I E S */

function limitVector(x: number, y: number, maxLength: number) {
  const length = Math.sqrt(x * x + y * y);
  if (length > maxLength) {
    const d = maxLength / length;
    return [x * d, y * d];
  }
  return [x, y];
}
