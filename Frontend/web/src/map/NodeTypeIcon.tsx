import { NODE_TYPE_COLORS } from "../utils/nodeType";
import type { NodeType } from "../types";

interface Props {
  type: NodeType;
  size?: number;
}

// Small glyph shown in place of the node-type text label. Color comes from
// NODE_TYPE_COLORS so the icon carries the same meaning the old text+dot
// pair did; callers should still set a `title`/aria-label with the raw
// type name since the label text itself is now hidden.
export function NodeTypeIcon({ type, size = 15 }: Props) {
  const color = NODE_TYPE_COLORS[type];
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { display: "block", flexShrink: 0 },
    "aria-hidden": true,
  };

  switch (type) {
    case "Problem":
      // Alert triangle: something that needs resolving.
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "Problematic option":
      // Branch with a warning badge: a choice that carries risk.
      return (
        <svg {...common}>
          <line x1="6" y1="3" x2="6" y2="14" />
          <circle cx="6" cy="18" r="3" />
          <path d="M6 14a6 6 0 0 0 6-6" />
          <circle cx="18" cy="6" r="4.5" fill={color} stroke="none" />
          <line x1="18" y1="3.6" x2="18" y2="6.2" stroke="var(--bg, #fff)" strokeWidth="1.4" />
          <line x1="18" y1="8" x2="18.01" y2="8" stroke="var(--bg, #fff)" strokeWidth="1.4" />
        </svg>
      );
    case "Option":
      // Plain branch: a choice among paths.
      return (
        <svg {...common}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case "Solution":
      // Check in a circle: the resolving answer.
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "Success":
      // Star: a winning outcome.
      return (
        <svg {...common}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "Fail":
      // X in a circle: a losing outcome.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    default:
      // unknown
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}
