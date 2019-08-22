import * as React from "react";
import { useEffect, useRef } from "react";
import { GameWorld } from "./game";

interface ViewportProps {
  run: boolean;
  world: GameWorld;
}

export function Viewport({ run, world }: ViewportProps) {
  const { width, height } = world.globals.size;
  const ref = useRef<HTMLCanvasElement>(null);

  // Handle retina screens.
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    if (!run || !ref.current) return;

    const context = ref.current.getContext("2d");
    if (!context) return;
    context.save();

    // Communicate the canvas context to the world.
    world.globals.context = context;

    // Set up context for retina screens.
    context.scale(dpr, dpr);

    // As long as this is true, we'll keep rendering the next frame.
    let shouldContinue = true;
    let lastTime = 0;
    // Every frame run this code.
    function frame(now: number) {
      if (!shouldContinue) return;
      let dt = 1;
      if (now) {
        if (now - lastTime < 250) {
          dt = (now - lastTime) / (1000 / 60);
        }
        lastTime = now;
      } else {
        lastTime = 0;
      }
      world.globals.deltaTime = dt;
      world.step();
      requestAnimationFrame(frame);
    }

    // Kick off the render loop.
    frame(0);

    return () => {
      world.globals.context = undefined;
      world.globals.deltaTime = 0;
      shouldContinue = false;
      context.restore();
    };
  }, [dpr, run, world]);

  return (
    <div className="viewport">
      <canvas ref={ref} width={width * dpr} height={height * dpr} style={{ width, height }} />
    </div>
  );
}
