import { Modal } from "../components/Modal";
import { useI18n } from "../i18n/I18nContext";
import { FUN_PICTURE_KINDS, PICTURES, TYPE_PICTURE_KINDS, pictureDots } from "../utils/pictures";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import type { PictureKind } from "../utils/pictures";

interface Props {
  onPick: (kind: PictureKind) => void;
  onClose: () => void;
}

const BOX = 96;
const PAD = 12;

// "Draw a picture" at icon size: a few dots joined into a little star, in
// the toolbar's monochrome ink.
export function PictureIcon({ size = 16 }: { size?: number }) {
  const pts = [
    [8, 1.8],
    [10, 6],
    [14.2, 6.4],
    [11, 9.4],
    [12, 14],
    [8, 11.6],
    [4, 14],
    [5, 9.4],
    [1.8, 6.4],
    [6, 6],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
        strokeLinejoin="round"
      />
      {pts.filter((_, i) => i % 2 === 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

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

const THUMB = 72;

// "Draw a picture" (utils/pictures.ts): the pictures to choose from. Picking
// one lays its dots out on the map as ghosts (useNodeCreation's drawPicture).
// The first group has one picture per node type (a bulb for an Idea, a stop
// sign for a Problem…), whose dots arrive as thoughts of that type; the
// second is pictures just for fun, whose dots are Ideas.
export function PicturePicker({ onPick, onClose }: Props) {
  const { t } = useI18n();
  const p = t.ui.pictures;
  const tile = (kind: PictureKind) => {
    const type = PICTURES[kind].type;
    return (
      <button
        key={kind}
        type="button"
        className="flex cursor-pointer flex-col items-center gap-0.5 rounded-card border border-line bg-surface p-1.5 text-[0.75rem] leading-tight text-ink hover:bg-surface-2"
        onClick={() => onPick(kind)}
        title={p.questions[kind]}
        data-picture={kind}
      >
        <PictureThumb kind={kind} size={THUMB} />
        <span className="text-center font-semibold">{p.names[kind]}</span>
        {type && (
          <span className="flex items-center gap-1 text-center text-[0.7rem] text-ink-soft">
            <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: NODE_TYPE_COLORS[type] }} />
            {t.ui.types[type]}
          </span>
        )}
      </button>
    );
  };
  return (
    <Modal title={p.title} onClose={onClose}>
      <p className="mb-3 text-[0.85rem] text-ink-soft">{p.hint}</p>
      <h3 className="mb-0.5 text-[0.85rem] font-semibold text-ink">{p.forTypes}</h3>
      <p className="mb-2 text-[0.75rem] text-ink-soft">{p.forTypesHint}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{TYPE_PICTURE_KINDS.map(tile)}</div>
      <h3 className="mb-2 mt-4 text-[0.85rem] font-semibold text-ink">{p.forFun}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{FUN_PICTURE_KINDS.map(tile)}</div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="cursor-pointer rounded-[6px] px-3 py-1.5 text-[0.85rem] text-ink-soft hover:bg-surface-2" onClick={onClose}>
          {t.ui.common.cancel}
        </button>
      </div>
    </Modal>
  );
}
