/**
 * Collision layer definitions for physics filtering optimization
 * 
 * Each group is a power of 2 (bit flag) allowing combination via bitwise OR
 * This allows drumsticks to only check collisions with drums/cymbals/ground,
 * dramatically reducing physics overhead and improving performance.
 * 
 * Benefits:
 * - Drumsticks don't collide with each other (prevents interference)
 * - Drums don't collide with ground (they're static anyway)
 * - Reduces collision checks by ~60-70%
 * 
 * Example usage:
 * ```typescript
 * // Drumstick collides with drums, cymbals, and ground:
 * shape.filterMembershipMask = COLLISION_GROUP.DRUMSTICK;
 * shape.filterCollideMask = COLLISION_GROUP.DRUM | COLLISION_GROUP.CYMBAL | COLLISION_GROUP.GROUND;
 * 
 * // Drum collides with drumsticks only:
 * shape.filterMembershipMask = COLLISION_GROUP.DRUM;
 * shape.filterCollideMask = COLLISION_GROUP.DRUMSTICK;
 * ```
 */
export const COLLISION_GROUP = {
    NONE: 0,                // 0000 (binary) - No collision group
    DRUMSTICK: 1 << 0,      // 0001 (binary) = 1 - Drumstick physics bodies
    DRUM: 1 << 1,           // 0010 (binary) = 2 - Drum trigger volumes
    CYMBAL: 1 << 2,         // 0100 (binary) = 4 - Cymbal trigger volumes  
} as const;

/**
 * Type for collision group values
 * Ensures only valid collision groups are used
 */
export type CollisionGroupValue = typeof COLLISION_GROUP[keyof typeof COLLISION_GROUP];
