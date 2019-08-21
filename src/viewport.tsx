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

    let lastTS = 0;
    // As long as this is true, we'll keep rendering the next frame.
    let scheduleNextFrame = true;

    function frame(ts: number) {
      let dt = 1;
      if (ts) {
        if (ts - lastTS < 250) {
          dt = (ts - lastTS) / (1000 / 60);
        }
        lastTS = ts;
      } else {
        lastTS = 0;
      }
      world.globals.deltaTime = dt;
      world.step();
      if (scheduleNextFrame) {
        // TODO: Fix corner cases where this causes multiple rAF per frame.
        requestAnimationFrame(frame);
      }
    }

    // Kick off the render loop.
    frame(0);

    return () => {
      world.globals.context = undefined;
      scheduleNextFrame = false;
      context.restore();
    };
  }, [dpr, run, world]);

  return (
    <div className="viewport">
      <canvas ref={ref} width={width * dpr} height={height * dpr} style={{ width, height }} />
    </div>
  );
}
