import * as React from "react";
import { GameWorld } from "./game";

interface ViewportProps {
  run: boolean;
  world: GameWorld;
}

export default class Viewport extends React.Component<ViewportProps> {
  private lastTs = 0;
  private ref = React.createRef<HTMLCanvasElement>();
  private running = false;

  constructor(props: ViewportProps) {
    super(props);
    this.frame = this.frame.bind(this);
  }

  componentDidMount() {
    if (!this.ref.current) return;
    const context = this.ref.current.getContext("2d");
    if (!context) return;
    // Handle retina screens.
    const dpr = window.devicePixelRatio || 1;
    context.scale(dpr, dpr);
    this.props.world.globals.context = context;
    if (this.props.run) {
      this.running = true;
      this.frame(0);
    }
  }

  componentDidUpdate() {
    if (this.props.run && !this.running) {
      this.running = true;
      this.frame(0);
    }
  }

  componentWillUnmount() {
    this.props.world.globals.context = undefined;
    this.running = false;
  }

  render() {
    const { width, height } = this.props.world.globals.size;
    // Handle retina screens.
    const dpr = window.devicePixelRatio || 1;
    return (
      <div className="viewport">
        <canvas ref={this.ref} width={width * dpr} height={height * dpr} style={{ width, height }} />
      </div>
    );
  }

  private frame(ts: number) {
    let dt = 1;
    if (ts) {
      if (ts - this.lastTs < 250) {
        dt = (ts - this.lastTs) / (1000 / 60);
      }
      this.lastTs = ts;
    } else {
      this.lastTs = 0;
    }
    this.props.world.globals.deltaTime = dt;
    this.props.world.step();
    if (this.running) {
      // TODO: Fix corner cases where this causes multiple rAF per frame.
      requestAnimationFrame(this.frame);
    }
  }
}
