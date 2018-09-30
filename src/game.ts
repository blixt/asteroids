import World, {Maybe} from './lib/world';

interface Globals {
  context?: CanvasRenderingContext2D;
  deltaTime: number;
  size: {width: number; height: number};
}

export type GameWorld = World<Globals>;

export const world = new World<Globals>({deltaTime: 0, size: {width: 0, height: 0}});

/* C O M P O N E N T S */

// Tag components:
const asteroid = world.addComponent('asteroid');
const player = world.addComponent('player');
const wrapsAround = world.addComponent('wrapsAround');

// Data components:
const friction = world.addComponent('friction', (amount: number) => ({amount}));

interface PolygonOptions {
  fillStyle?: string;
  lineWidth?: number;
  strokeStyle?: string;
}

const polygon = world.addComponent(
  'polygon',
  (options: PolygonOptions, ...points: [number, number][]) => {
    return {options, points};
  },
);

const position = world.addComponent('position', (x: number, y: number) => ({x, y}));

const rotation = world.addComponent('rotation', (angle: number, delta: number) => {
  return {angle, delta};
});

const velocity = world.addComponent('velocity', (vx: number, vy: number) => ({vx, vy}));

/* S Y S T E M S */

// Make objects with velocity slow down over time.
world.addSystem(
  'friction',
  [friction, velocity],
  (world, entities, frictions, velocities) => {
    const dt = world.globals.deltaTime;
    for (const {id} of entities) {
      const {amount} = frictions.get(id);
      const velocity = velocities.get(id);
      velocity.vx *= 1 - amount * dt;
      velocity.vy *= 1 - amount * dt;
    }
  },
);

// Make objects with position and velocity move.
world.addSystem(
  'move',
  [position, velocity],
  (world, entities, positions, velocities) => {
    const dt = world.globals.deltaTime;
    for (const {id} of entities) {
      const position = positions.get(id);
      const {vx, vy} = velocities.get(id);
      position.x += vx * dt;
      position.y += vy * dt;
    }
  },
);

// Make objects rotate.
world.addSystem('rotate', [rotation], (world, entities, rotations) => {
  const dt = world.globals.deltaTime;
  for (const {id} of entities) {
    const rotation = rotations.get(id);
    rotation.angle += (rotation.delta * dt) % TAU;
  }
});

// Clear the screen every frame.
world.addSystem('clearScreen', [], (world, entities) => {
  const ctx = world.globals.context!;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
});

// Wrap objects that move outside the screen area around to the other side.
world.addSystem(
  'wrap',
  [wrapsAround, position, velocity],
  (world, entities, positions, velocities) => {
    const {width, height} = world.globals.size;
    const padding = 30;
    // Returns a 2-bit mask for outside horizontally/vertically.
    function outside(x: number, y: number) {
      return (
        (x < -padding || x >= width + padding ? 1 : 0) |
        (y < -padding || y >= height + padding ? 2 : 0)
      );
    }
    for (const {id} of entities) {
      const position = positions.get(id);
      const {vx, vy} = velocities.get(id);
      if (outside(position.x, position.y)) {
        // Ignore objects that were already outside the wrapping area.
        continue;
      }
      const outsideAfterMoving = outside(position.x + vx, position.y + vy);
      if (outsideAfterMoving & 1) {
        // Wrap objects horizontally.
        position.x += vx < 0 ? padding + width + padding : -(padding + width + padding);
      }
      if (outsideAfterMoving & 2) {
        // Wrap objects vertically.
        position.y += vy < 0 ? padding + height + padding : -(padding + height + padding);
      }
    }
  },
);

// Draw all polygons on screen.
world.addSystem(
  'drawPolys',
  [polygon, position, Maybe(rotation)],
  (world, entities, polygons, positions, rotations) => {
    const ctx = world.globals.context!;
    for (const {id} of entities) {
      const {options, points} = polygons.get(id);
      const {x, y} = positions.get(id);
      const rotation = rotations.get(id);
      ctx.save();
      ctx.translate(x, y);
      if (rotation) {
        ctx.rotate(rotation.angle);
      }
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
  },
);

/* E N T I T Y   C R E A T I O N */

const TAU = Math.PI * 2;

export function createAsteroid() {
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
    .tagged(asteroid, wrapsAround)
    .with(polygon, {lineWidth: 1.5, strokeStyle: '#eec'}, ...points)
    .with(position, x, y)
    .with(rotation, Math.random() * TAU, (Math.random() - 0.5) * 0.01)
    .with(velocity, vx, vy)
    .create();
}

export function createPlayer(x: number, y: number, {vx = 0, vy = 0} = {}) {
  return world
    .entity()
    .tagged(player, wrapsAround)
    .with(friction, 0.04)
    .with(polygon, {strokeStyle: '#0f0'}, [9, 0], [-9, 8], [-6, 0], [-9, -8])
    .with(position, x, y)
    .with(rotation, -Math.PI / 2, 0)
    .with(velocity, vx, vy)
    .create();
}
