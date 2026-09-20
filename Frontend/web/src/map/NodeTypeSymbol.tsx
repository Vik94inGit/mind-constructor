import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeType } from "../types";

interface Props {
  type: NodeType;
  size: number;
}

// The symbol a real node of this type actually renders (OutcomeBadge), not
// NodeTypeIcon's own separate glyph set — a legend that taught a different
// symbol than the one on the map was the bug this replaces. "unknown" alone
// has no outcome symbol, so it keeps its plain NodeTypeIcon glyph, same as a
// real "unknown" node does.
export function NodeTypeSymbol({ type, size }: Props) {
  return ringKindFor(type) ? (
    <OutcomeBadge type={type as OutcomeType} size={size} />
  ) : (
    <NodeTypeIcon type={type} size={size} />
  );
}
