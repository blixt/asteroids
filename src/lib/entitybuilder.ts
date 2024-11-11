import type World from "./world";
import type { ComponentId, EntityId } from "./world";

export default class EntityBuilder<Globals> {
  private components? = new Map<ComponentId, any[]>();
  private world?: World<Globals>;

  constructor(world: World<Globals>) {
    this.world = world;
  }

  create(): EntityId {
    if (!this.components || !this.world) throw Error("invalid builder use");
    const id = this.world.createEntity(this.components.entries());
    this.components = undefined;
    this.world = undefined;
    return id;
  }

  with<Args extends any[]>(component: ComponentId<Args, any>, ...properties: Args) {
    if (!this.components || !this.world) throw Error("invalid builder use");
    this.components.set(component, properties);
    return this;
  }
}
