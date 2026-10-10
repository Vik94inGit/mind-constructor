import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  value: NodeType;
  /** The types offered — NODE_TYPES, or ATTACK_NODE_TYPES for a weapon/protection node. */
  types: readonly NodeType[];
  onChange: (type: NodeType) => void;
  disabled?: boolean;
}

// A row of the node types' icons, the current one ringed in its color — how
// the node panels (NodePanel, NewNodePanel) change a node's type.
export function TypePicker({ value, types, onChange, disabled = false }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-[0.3rem]" role="radiogroup" aria-label={t.ui.node.clickToChangeType}>
      {types.map((type) => {
        const active = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.ui.types[type]}
            title={t.ui.types[type]}
            disabled={disabled}
            className={`flex h-[1.9rem] w-[1.9rem] cursor-pointer items-center justify-center rounded-full border-2 bg-[var(--node-fill)] p-0 transition-[opacity,transform] duration-100 disabled:cursor-not-allowed ${
              active ? "scale-110 opacity-100 shadow-card" : "opacity-55 hover:opacity-100"
            }`}
            style={{ borderColor: active ? NODE_TYPE_COLORS[type] : "var(--line)" }}
            onClick={() => !active && onChange(type)}
          >
            <NodeTypeIcon type={type} size={15} />
          </button>
        );
      })}
    </div>
  );
}
