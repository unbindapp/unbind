import { cn } from "@/components/ui/utils";
import { Children, cloneElement, isValidElement, ReactNode, useState } from "react";

export function Toggleable({
  children,
  toggledInitial = false,
}: {
  children: ReactNode;
  toggledInitial?: boolean;
}) {
  const [toggled, setToggled] = useState(toggledInitial);

  const childrenArray = Children.toArray(children);

  const toggle = (toggled?: boolean) =>
    setToggled((current) => (toggled !== undefined ? toggled : !current));

  const UntoggledChild = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === Untoggled,
  );

  const ToggledChild = childrenArray.find(
    (child) => isValidElement(child) && typeof child.type === "function" && child.type === Toggled,
  );

  if (toggled && ToggledChild && isValidElement(ToggledChild)) {
    // TODO - Fix these types later
    return cloneElement(ToggledChild, { toggle } as unknown as {
      toggle: (toggled?: boolean) => void;
    });
  }

  if (UntoggledChild && isValidElement(UntoggledChild)) {
    // TODO - Fix these types later
    return cloneElement(UntoggledChild, { toggle } as unknown as {
      toggle: (toggled?: boolean) => void;
    });
  }

  return null;
}

export function Untoggled({
  children,
  toggle,
  ...rest
}: {
  children: ({ toggle }: { toggle: (toggled?: boolean) => void }) => ReactNode;
  toggle?: (toggled?: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  const actualToggle = toggle || (() => {});

  const renderedChildren = children({ toggle: actualToggle });

  if (isValidElement(renderedChildren)) {
    const childrenProps = (renderedChildren.props || {}) as { className?: string };
    const { className: restClassName, ...restWithoutClassName } = rest;
    const mergedProps = {
      ...childrenProps,
      ...restWithoutClassName,
    };
    if (childrenProps.className || restClassName) {
      mergedProps.className = cn(childrenProps.className, restClassName);
    }
    return cloneElement(renderedChildren, mergedProps);
  }

  return renderedChildren;
}

export function Toggled({
  children,
  toggle,
  ...rest
}: {
  children: ({ toggle }: { toggle: (toggled?: boolean) => void }) => ReactNode;
  toggle?: (toggled?: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  const actualToggle = toggle || (() => {});

  const renderedChildren = children({ toggle: actualToggle });

  if (isValidElement(renderedChildren)) {
    const childrenProps = (renderedChildren.props || {}) as { className?: string };
    const { className: restClassName, ...restWithoutClassName } = rest;
    const mergedProps = {
      ...childrenProps,
      ...restWithoutClassName,
    };
    if (childrenProps.className || restClassName) {
      mergedProps.className = cn(childrenProps.className, restClassName);
    }
    return cloneElement(renderedChildren, mergedProps);
  }

  return renderedChildren;
}
