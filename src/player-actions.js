import { applyPlayerEdit } from './player-edit-simulation.js';
import { copyBucketTarget } from './buckets-simulation.js';
import { releaseHeldBow } from './player-throw-simulation.js';
import { placeHeldMinecart } from './vehicle-simulation.js';

// Version 2 adds the held bucket's own captured eye-ray trace (`bucket`, null otherwise).
const VERSION = 2;
const TYPE = 'player-edit';
const RELEASE_TYPE = 'player-release-use';
// EntityWorld restores exactly /^mob-\d+$/ IDs (including legacy mob-0).
const mobIdPattern = /^mob-\d+$/;

// The ray's exact hit vector (onBlockPlaced's hit x/y/z); kept only when it is three finite numbers.
const copyHit = (value) => (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? { hit: [...value] } : {});
const copyPosition = (value) => {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isSafeInteger)) return undefined;
  return [...value];
};

function selectedEntityId(aimedEntity) {
  if (!aimedEntity) return null;
  const entity = aimedEntity.entity ?? aimedEntity;
  return typeof entity?.id === 'string' && mobIdPattern.test(entity.id) ? entity.id : null;
}

/** Capture the inputs to one live edit call as plain JSON-safe data. */
// `bucket` is captureBucketTarget(world, heldTool, eyeRay) from buckets-simulation.js,
// taken at the same input instant as the block/entity targets, or null.
export function capturePlayerAction({ place = false, target = null, aimedEntity = null, heldTool, bucket = null } = {}) {
  const block = target ? copyPosition(target.block) : null;
  const adjacent = target?.adjacent == null ? null : copyPosition(target.adjacent);
  const distance = target?.distance;
  if (target && (block === null || block === undefined) || adjacent === undefined ||
      (distance !== undefined && !Number.isFinite(distance)))
    throw new TypeError('Player edit target must contain finite coordinates and distance');
  if (!Number.isSafeInteger(heldTool)) throw new TypeError('Player edit requires the current held item id');
  const bucketTarget = copyBucketTarget(bucket);
  if (bucketTarget === undefined) throw new TypeError('Player edit bucket target must contain a finite ray and integer hit');
  return {
    version: VERSION,
    type: TYPE,
    place: Boolean(place),
    heldTool,
    target: target ? { block, adjacent, ...(distance === undefined ? {} : { distance }), ...copyHit(target.hit) } : null,
    // Null means no entity was selected. An object with id:null means an entity
    // was selected but cannot be addressed safely, and must never become a block click.
    aimedEntity: aimedEntity ? { id: selectedEntityId(aimedEntity) } : null,
    bucket: bucketTarget,
  };
}

function normalizeAction(action) {
  if (!action || action.version !== VERSION || action.type !== TYPE || typeof action.place !== 'boolean' ||
      !Number.isSafeInteger(action.heldTool)) return null;
  let target = null;
  if (action.target !== null) {
    if (!action.target || typeof action.target !== 'object') return null;
    const block = copyPosition(action.target.block);
    const adjacent = action.target.adjacent == null ? null : copyPosition(action.target.adjacent);
    if (block === null || block === undefined || adjacent === undefined ||
        (action.target.distance !== undefined && !Number.isFinite(action.target.distance))) return null;
    target = { block, adjacent, ...(action.target.distance === undefined ? {} : { distance: action.target.distance }), ...copyHit(action.target.hit) };
  }
  let aimedEntity = null;
  if (action.aimedEntity !== null) {
    if (!action.aimedEntity || typeof action.aimedEntity !== 'object') return null;
    const id = action.aimedEntity.id;
    if (typeof id !== 'string' || !mobIdPattern.test(id)) return { invalidEntity: true };
    aimedEntity = { id };
  }
  if (!Object.hasOwn(action, 'bucket')) return null;
  const bucket = copyBucketTarget(action.bucket);
  if (bucket === undefined) return null;
  return { place: action.place, heldTool: action.heldTool, target, aimedEntity, bucket };
}

function currentHeldTool(state) {
  if (state.survival) {
    const held = state.survival.held ?? state.survival.inventory?.held;
    return Number.isSafeInteger(held?.id) ? held.id : 0;
  }
  return Number.isSafeInteger(state.heldTool) ? state.heldTool : 0;
}

/** Resolve and apply a captured action immediately against the live authoritative state. */
export function dispatchPlayerAction(state, action, hooks = {}) {
  const captured = normalizeAction(action);
  if (!captured) return { handled: true, branch: 'invalid-player-action', skipped: true };
  if (captured.invalidEntity) return { handled: true, branch: 'missing-entity-target', skipped: true };
  if (captured.heldTool !== currentHeldTool(state))
    return { handled: true, branch: 'held-item-mismatch', skipped: true };

  let aimedEntity = null;
  if (captured.aimedEntity) {
    const entity = state.mobs?.entities?.find((candidate) => candidate.id === captured.aimedEntity.id && candidate.health > 0) ?? state.mobs?._fireballs?.find(captured.aimedEntity.id); // a deflectable fireball (fireballs.js)
    if (!entity) return { handled: true, branch: 'missing-entity-target', skipped: true };
    aimedEntity = { entity };
  }

  // The helper consumes this state field as its current tool. Reconcile stale
  // caller snapshots from live inventory before invoking it; never take the
  // tool from the captured action record.
  state.heldTool = currentHeldTool(state);
  if (captured.place && !aimedEntity && captured.target && state.minecarts?.railKind(state.world, ...captured.target.block)) {
    const placed = placeHeldMinecart(state, captured, hooks);
    if (placed.handled) return placed;
  }
  const { apply = applyPlayerEdit, ...editHooks } = hooks;
  // Coordinates are copied during normalization and this call stays synchronous:
  // recorded input never becomes a delayed action queue.
  return apply(state, { place: captured.place, target: captured.target, aimedEntity, bucket: captured.bucket }, editHooks);
}

/** Capture a use-button release (ItemBow.onPlayerStoppedUsing input) as plain data. */
export function captureReleaseAction() {
  return { version: VERSION, type: RELEASE_TYPE };
}

/**
 * Apply a captured release immediately against live state. The draw state and the held
 * item are read from `state` at dispatch, as the old pointer-up handler read them.
 */
export function dispatchReleaseAction(state, action, hooks = {}) {
  if (!action || action.version !== VERSION || action.type !== RELEASE_TYPE)
    return { released: false, branch: 'invalid-release-action', skipped: true };
  const { release = releaseHeldBow, ...releaseHooks } = hooks;
  return release(state, releaseHooks);
}
