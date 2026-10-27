import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { useI18n } from "../i18n/I18nContext";
import { moveRovingFocus } from "../utils/roving";

interface Props {
  value: NodeType;
  /** The types offered — NODE_TYPES, or ATTACK_NODE_TYPES for a weapon/protection node. */
  types: readonly NodeType[];
  onChange: (type: NodeType) => void;
  disabled?: boolean;
}

// A row of the node types' symbols, the current one ringed in its color — how
// the node panels (NodePanel, NewNodePanel) change a node's type. Same
// symbols the node itself and the quick-add ghosts draw (NodeTypeSymbol).
// One Tab stop, on the current type; the arrow keys move between types and
// Enter/Space picks one (moving alone doesn't, since every pick saves the node).
export function TypePicker({ value, types, onChange, disabled = false }: Props) {
  const { t } = useI18n();
  const tabStop = types.includes(value) ? value : types[0];
  return (
    <div
      className="flex flex-wrap items-center gap-[0.3rem]"
      role="radiogroup"
      aria-label={t.ui.node.clickToChangeType}
      onKeyDown={(e) => moveRovingFocus(e, '[role="radio"]')}
    >
      {types.map((type) => {
        const active = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={type === tabStop ? 0 : -1}
            aria-label={t.ui.types[type]}
            title={t.ui.types[type]}
            disabled={disabled}
            className={`flex h-[1.9rem] w-[1.9rem] cursor-pointer items-center justify-center rounded-full border-2 bg-[var(--node-fill)] p-0 transition-[opacity,transform] duration-100 disabled:cursor-not-allowed ${
              active ? "scale-110 opacity-100 shadow-card" : "opacity-55 hover:opacity-100"
            }`}
            style={{ borderColor: active ? NODE_TYPE_COLORS[type] : "var(--line)" }}
            onClick={() => !active && onChange(type)}
          >
            <NodeTypeSymbol type={type} size={17} />
          </button>
        );
      })}
    </div>
  );
}
