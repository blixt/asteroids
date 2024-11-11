import * as React from "react";
import { createRoot } from "react-dom/client";
import { createPlayer, createRandomAsteroid, world } from "./game";
import "./index.css";
import { Viewport } from "./Viewport";

const size = { width: 270, height: 480 };
world.globals.size = size;

// Create the player.
createPlayer(size.width / 2, size.height + 10, { vy: -10 });

// Create some asteroids.
for (let i = 0; i < 10; i++) {
  createRandomAsteroid();
}

// Handle input.
const handleKey = (e: KeyboardEvent) => {
  const isDown = e.type === "keydown";
  switch (e.key) {
    case "ArrowDown":
      break;
    case "ArrowLeft":
      world.globals.input.turnLeft = isDown;
      break;
    case "ArrowRight":
      world.globals.input.turnRight = isDown;
      break;
    case "ArrowUp":
      world.globals.input.accelerate = isDown;
      break;
    case " ":
      world.globals.input.shoot = isDown;
      break;
    default:
      return;
  }
  e.preventDefault();
};

document.addEventListener("keydown", handleKey);
document.addEventListener("keyup", handleKey);

// Create root and render
const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");
const root = createRoot(container);
root.render(<Viewport run={true} world={world} />);
