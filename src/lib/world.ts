import EntityBuilder from "./entitybuilder";

// This is an Entity Component System (ECS) engine.

// An ENTITY is a thing in the game world, with any number of components.
// Examples: player avatar, asteroid, NPC
interface Entity {
  id: EntityId;
  // A bitmask of the components this entity has.
  mask: number;
}

// A COMPONENT represents a single aspect of an entity, and its associated data.
// Examples: position, health, keyboard control
interface Component<Args extends any[] = unknown[], Data = unknown> {
  bit: number;
  factory?: FactoryFn<Args, Data>;
  storage?: Storage<Data>;
}

// A SYSTEM is something that runs and updates one or more components.
// Examples: gravity, burning, drawing the screen
interface System<Globals> {
  components: ComponentId[];
  require: number;
  exclude: number;
  step: StepFn<Globals, AnyComponentId[]>;
}

// Refers to an individual entity in the world.
// TODO: Make this id include generation.
export type EntityId = number;

// Refers to a component (the concept - not its storage) in the world.
// Args is the argument list type of the function that creates the data of this component.
// Data is the type of the data that gets stored in the storage for this component.
export interface ComponentId<Args extends any[] = unknown[], Data = unknown> extends Symbol {}

// Refers to a system in the world.
export interface SystemId extends Symbol {}

// A marker type for differentating between undefined data and no storage.
// (This type is never actually exposed to JavaScript in the form of a value.)
type NoStorage = "__NO_STORAGE__";

// The type of a function that can create data from a set of arguments (a component data factory).
type FactoryFn<Args extends any[], Data> = (...args: Args) => Data;

// The interface of a storage that contains all data for the entities with a specific component.
// Different components need different types of storage. For example:
// - Hash maps for sparse components (only few entities have this component)
// - Regular arrays for dense components (almost every entity has this component)
interface Storage<Data> {
  delete(id: EntityId): void;
  get(id: EntityId): Data | undefined;
  set(id: EntityId, data: Data): void;
}

interface ReadonlyStorage<Data> {
  get(id: EntityId): Data;
}

// Infers a tuple of storages for the provided set of component id types.
type InferStorageTuple<Ids> = {
  [K in keyof Ids]: Ids[K] extends AnyComponentId<any[], infer Data>
    ? ReadonlyStorage<Data extends NoStorage ? NoStorage : Data>
    : never
};

// A function that moves a system one step forward.
// The rest arguments are the storages for components, skipping the components without storage.
type StepFn<Globals, Ids extends AnyComponentId[]> = (
  world: World<Globals>,
  entities: Entity[],
  // Infers the storages from the component ids, then drops the ones marked with NoStorage.
  ...data: Drop<InferStorageTuple<Ids>, ReadonlyStorage<NoStorage>>
) => void;

// Modifiers allow more complex component filters for systems.
interface Modifier extends Symbol {}

const MAYBE: Modifier = Symbol("maybe");

// Include entities even if they don't have this component type, but if they have it, give us the data.
// Example: Draw all entities with "polygon" and if they (MAYBE) have "rotation" also rotate them.
// The storage will return `undefined` for entities that do not have the component.
export function Maybe<Args extends any[], Data>(
  component: ComponentId<Args, Data>
): ModComponentId<Args, Data | undefined> {
  return [MAYBE, component];
}

const NOT: Modifier = Symbol("not");

// Exclude entities with a certain component type.
// Example: Damage all entities with "health" but NOT the ones tagged "invulnerable".
export function Not<Args extends any[]>(component: ComponentId<Args>): ModComponentId<Args, NoStorage> {
  return [NOT, component];
}

// These additional types make it easier to accept both component ids and modifiers.
type ModComponentId<Args extends any[], Data> = [Modifier, ComponentId<Args, Data>];
type AnyComponentId<Args extends any[] = unknown[], Data = unknown> =
  | ComponentId<Args, Data>
  | ModComponentId<Args, Data>;
// Convenience tuples that makes the addSystem overloads look cleaner.
type AnyComponentId1 = [AnyComponentId];
type AnyComponentId2 = [AnyComponentId, AnyComponentId];
type AnyComponentId3 = [AnyComponentId, AnyComponentId, AnyComponentId];
type AnyComponentId4 = [AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId];
type AnyComponentId5 = [AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId];
type AnyComponentId6 = [AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId, AnyComponentId];

// The World class puts the three concepts entity, component, and system together.
// TODO: Add world.forEach(entity => { /* system code */ })
//       - Run every forEach in lock step so entities are only iterated once
//       - Support boundaries that force multiple iterations
//       - Look into `const entity = yield`
export default class World<Globals> {
  components = new Map<ComponentId, Component>();
  entities: (Entity | null)[] = [];
  globals: Globals;
  systems = new Map<SystemId, System<Globals>>();

  private entitiesIndex = new Map<string, Entity[]>();
  private entitiesToDestroy = new Set<number>();

  constructor(globals: Globals) {
    this.globals = globals;
  }

  addComponent<Args extends any[], Data = NoStorage>(name: string, factory?: FactoryFn<Args, Data>) {
    const component: Component<Args, Data> = { bit: 1 << this.components.size };
    if (factory) {
      component.factory = factory;
      component.storage = new Map();
    }
    const id: ComponentId<Args, Data> = Symbol(`${name} component`);
    // TODO: Figure out what's needed to not have to cast below.
    this.components.set(id, component as Component);
    return id;
  }

  addSystem<Ids extends []>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId1>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId2>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId3>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId4>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId5>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem<Ids extends AnyComponentId6>(name: string, components: Ids, step: StepFn<Globals, Ids>): void;
  addSystem(name: string, components: any[], step: StepFn<Globals, any>) {
    const [componentIds, require, exclude] = this.resolveAnyComponentIds(components);
    const id: SystemId = Symbol(`${name} system`);
    this.systems.set(id, { components: componentIds, require, exclude, step });
    return id;
  }

  createEntity(componentEntries: Iterable<[ComponentId, any[]]>): EntityId {
    let mask = 0;
    // TODO: Generations for entity ids.
    // TODO: Reuse empty slots.
    // TODO: Track lowest empty index? (Compare perf with tracking highest.)
    const id: EntityId = this.entities.length;
    for (const [componentId, properties] of componentEntries) {
      const component = this.components.get(componentId);
      if (!component) {
        throw Error(`invalid component ${componentId}`);
      }
      mask |= component.bit;
      // The component may not have a data structure if it's only used as a tag.
      if (component.factory && component.storage) {
        component.storage.set(id, component.factory(...properties));
      }
    }
    const entity = { id, mask };
    this.entities.push(entity);
    // Update existing indexes.
    for (const [indexKey, indexList] of this.entitiesIndex) {
      const [require, exclude] = indexKey.split("-").map(parseInt);
      if ((mask & require) !== require || mask & exclude) continue;
      indexList.push(entity);
      console.log("Added entity %d to index for filter %s (new count: %d)", id, indexKey, indexList.length);
    }
    // Just expose the id of the entity object.
    return id;
  }

  destroyEntity(id: EntityId) {
    this.entitiesToDestroy.add(id);
  }

  entity() {
    return new EntityBuilder<Globals>(this);
  }

  hasComponent(entity: Entity, componentId: ComponentId): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;
    return (entity.mask & component.bit) > 0;
  }

  query(...components: AnyComponentId[]): Entity[] {
    const [, require, exclude] = this.resolveAnyComponentIds(components);
    return this.filterEntities(require, exclude);
  }

  step() {
    // ~ One small step for a system, a giant leap for World. ~
    // Remove entities marked for destruction.
    this.purgeDestroyedEntities();
    // Loop through every system...
    for (const system of this.systems.values()) {
      // Get only the entities that have the components this system acts upon.
      const entities = this.filterEntities(system.require, system.exclude);
      // Collect a list of storages for each component (except tag components).
      const storageList = [];
      for (const componentId of system.components) {
        const component = this.components.get(componentId);
        if (!component) throw Error("internal state error");
        const storage = component.storage;
        if (!storage) {
          // This is a tag component so it has no data. No need to waste cycles.
          continue;
        }
        // Add the storage to the step function parameter list.
        storageList.push(storage);
      }
      system.step(this, entities, ...storageList);
    }
  }

  private filterEntities(require: number, exclude: number) {
    const indexKey = `${require}-${exclude}`;
    const cachedEntities = this.entitiesIndex.get(indexKey);
    if (cachedEntities) return cachedEntities;
    const entities = this.entities.filter(e => e && (e.mask & require) === require && !(e.mask & exclude)) as Entity[];
    this.entitiesIndex.set(indexKey, entities);
    console.log("Built index for filter %s (count: %d)", indexKey, entities.length);
    return entities;
  }

  private purgeDestroyedEntities() {
    if (this.entitiesToDestroy.size === 0) return;
    // TODO: Generations for entity ids to avoid referencing wrong entity.
    // Remove component data for deleted entities.
    for (const component of this.components.values()) {
      if (!component.storage) continue;
      for (const id of this.entitiesToDestroy) {
        const { mask } = this.entities[id]!;
        if (!(mask & component.bit)) continue;
        component.storage.delete(id);
      }
    }
    // Update indexes.
    for (const [indexKey, indexList] of this.entitiesIndex) {
      const [require, exclude] = indexKey.split("-").map(parseInt);
      for (const id of this.entitiesToDestroy) {
        const entity = this.entities[id]!;
        if ((entity.mask & require) !== require || entity.mask & exclude) continue;
        const i = indexList.indexOf(entity);
        indexList.splice(i, 1);
        console.log("Removed entity %d from index for filter %s (new count: %d)", id, indexKey, indexList.length);
      }
    }
    // Make entity ids unused.
    for (const id of this.entitiesToDestroy) {
      this.entities[id] = null;
    }
    this.entitiesToDestroy.clear();
  }

  private resolveAnyComponentIds(ids: AnyComponentId[]): [ComponentId[], number, number] {
    const componentIds: ComponentId[] = [];
    let require = 0;
    let exclude = 0;
    for (let id of ids) {
      let modifier: Modifier | undefined;
      if (Array.isArray(id)) {
        [modifier, id] = id;
      }
      const component = this.components.get(id);
      if (!component) throw Error(`invalid component ${id}`);
      // Only require this component in the default case (no modifier is set).
      if (!modifier) require |= component.bit;
      if (modifier === NOT) exclude |= component.bit;
      componentIds.push(id);
    }
    return [componentIds, require, exclude];
  }
}

// Adds type V to the start of tuple T.
type Unshift<T extends any[], V> = ((_: V, ...t: T) => any) extends ((...m: infer M) => any) ? M : never;

// Drops any value that extends X in tuple T.
// TODO: Try to get rid of this recursive type.
type Drop<T extends any[], X> = {
  0: T;
  1: ((...t: T) => any) extends ((h: infer H, ...R: infer R) => any)
    ? (H extends X ? Drop<R, X> : Unshift<Drop<R, X>, H>)
    : never;
}[T extends [any, ...any[]] ? 1 : 0];
