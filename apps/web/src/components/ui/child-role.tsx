import { isValidElement, ReactElement, ReactNode } from "react";

// Identifying a specific child component among `children` must not rely on
// referential identity (`child.type === SomeComponent`). React Fast Refresh
// replaces component function instances on every dev save, so that comparison
// breaks across hot updates and the matched child silently disappears until a
// full reload. Instead we tag components with a stable role marker keyed by a
// global symbol (the same approach Radix uses for its `Slottable` via
// `Symbol.for("radix.slottable")`). `Symbol.for` resolves to the identical
// symbol across module re-evaluations, and the role is compared by value, so it
// survives Fast Refresh and duplicate module instances.
const ROLE_KEY = Symbol.for("unbind.child.role");

type RoleTagged = { [ROLE_KEY]?: string };

/** Tag a component with a stable, HMR-safe role marker and return it. */
export function withChildRole<T extends object>(component: T, role: string): T {
  (component as RoleTagged)[ROLE_KEY] = role;
  return component;
}

/** Match a child by role — compares by value, so it survives Fast Refresh. */
export function hasChildRole(child: ReactNode, role: string): child is ReactElement {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    (child.type as RoleTagged)[ROLE_KEY] === role
  );
}
