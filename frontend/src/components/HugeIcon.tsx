import { For, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { Component } from 'solid-js';

export interface HugeIconProps {
  icon: readonly (readonly [any, any])[];
  size?: number | string;
  color?: string;
  class?: string;
  strokeWidth?: number | string;
}

export const HugeIcon: Component<HugeIconProps> = (props) => {
  const [local, rest] = splitProps(props, ['icon', 'size', 'color', 'class', 'strokeWidth']);
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={local.size || 18}
      height={local.size || 18}
      fill="none"
      stroke={local.color || "currentColor"}
      class={local.class}
      {...rest}
    >
      <For each={local.icon}>
        {([tag, attrs]) => {
          const finalAttrs = { ...attrs };
          
          // Apply custom stroke width if passed as a prop
          if (local.strokeWidth !== undefined) {
            if (finalAttrs.stroke && finalAttrs.stroke !== 'none') {
              finalAttrs.strokeWidth = local.strokeWidth;
            }
          }
          
          // Apply color to strokes/fills if color prop is provided
          if (local.color) {
            if (finalAttrs.stroke && finalAttrs.stroke !== 'none') {
              finalAttrs.stroke = local.color;
            }
            if (finalAttrs.fill && finalAttrs.fill !== 'none' && finalAttrs.fill !== 'transparent') {
              finalAttrs.fill = local.color;
            }
          }
          
          // Map camelCase SVG properties to kebab-case for SolidJS compatibility
          const mappedAttrs: Record<string, any> = {};
          for (const [key, value] of Object.entries(finalAttrs)) {
            if (key === 'strokeWidth') mappedAttrs['stroke-width'] = value;
            else if (key === 'strokeLinecap') mappedAttrs['stroke-linecap'] = value;
            else if (key === 'strokeLinejoin') mappedAttrs['stroke-linejoin'] = value;
            else mappedAttrs[key] = value;
          }
          
          return <Dynamic component={tag} {...mappedAttrs} />;
        }}
      </For>
    </svg>
  );
};
