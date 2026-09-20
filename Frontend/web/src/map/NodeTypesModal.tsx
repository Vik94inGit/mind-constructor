import { Modal } from "../components/Modal";
import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPES } from "../types";
import { NodeTypeSymbol } from "./NodeTypeSymbol";

// The "Node types" reference opened from the + menu: each type beside the
// symbol a real node of that type renders.
export function NodeTypesModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t.map.addMenu.nodeTypes} onClose={onClose}>
      <div className="flex flex-col gap-[0.6rem]">
        {NODE_TYPES.map((nt) => (
          <div key={nt} className="flex items-center gap-[0.6rem] text-[0.88rem] text-ink">
            <NodeTypeSymbol type={nt} size={20} />
            {nt}
          </div>
        ))}
      </div>
    </Modal>
  );
}
