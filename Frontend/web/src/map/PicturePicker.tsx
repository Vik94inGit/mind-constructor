import { Modal } from "../components/Modal";
import { useI18n } from "../i18n/I18nContext";
import { PICTURES, PICTURE_KINDS, pictureDots } from "../utils/pictures";
import type { PictureKind } from "../utils/pictures";

interface Props {
  onPick: (kind: PictureKind) => void;
  onClose: () => void;
}

const BOX = 96;
const PAD = 12;

// One picture in miniature, the way it starts on the map: its dots, joined
// by the faint dotted guides that ink in as the dots are written.
export function PictureThumb({ kind, size = BOX }: { kind: PictureKind; size?: number }) {
  const def = PICTURES[kind];
  const dots = pictureDots(kind, { x: 0, y: 0 });
  const minX = Math.min(...dots.map((p) => p.x));
  const maxX = Math.max(...dots.map((p) => p.x));
  const minY = Math.min(...dots.map((p) => p.y));
  const maxY = Math.max(...dots.map((p) => p.y));
  const scale = (size - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
  const at = (i: number) => ({
    x: size / 2 + (dots[i].x - (minX + maxX) / 2) * scale,
    y: size / 2 + (dots[i].y - (minY + maxY) / 2) * scale,
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {def.paths.map((path, pi) => (
        <polyline
          key={pi}
          points={path.map((i) => `${at(i).x},${at(i).y}`).join(" ")}
          fill="none"
          stroke={def.color}
          strokeWidth={2}
          strokeOpacity={0.55}
          strokeDasharray="2 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots.map((_, i) => (
        <circle key={i} cx={at(i).x} cy={at(i).y} r={4} fill={def.color} />
      ))}
    </svg>
  );
}

// "Draw a picture" (utils/pictures.ts): the pictures to choose from. Picking
// one lays its dots out on the map as ghosts (useNodeCreation's drawPicture).
export function PicturePicker({ onPick, onClose }: Props) {
  const { t } = useI18n();
  const p = t.ui.pictures;
  return (
    <Modal title={p.title} onClose={onClose}>
      <p className="mb-4 text-[0.85rem] text-ink-soft">{p.hint}</p>
      <div className="grid grid-cols-3 gap-2">
        {PICTURE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="flex cursor-pointer flex-col items-center gap-1 rounded-card border border-line bg-surface p-2 text-[0.8rem] text-ink hover:bg-surface-2"
            onClick={() => onPick(kind)}
            title={p.questions[kind]}
          >
            <PictureThumb kind={kind} />
            <span className="font-semibold">{p.names[kind]}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="cursor-pointer rounded-[6px] px-3 py-1.5 text-[0.85rem] text-ink-soft hover:bg-surface-2" onClick={onClose}>
          {t.ui.common.cancel}
        </button>
      </div>
    </Modal>
  );
}
