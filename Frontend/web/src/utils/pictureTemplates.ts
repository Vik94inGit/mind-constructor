import eyesThumb from "../assets/picture-templates/eyes.webp";
import clockHeadsThumb from "../assets/picture-templates/clock-heads.webp";
import martiniThumb from "../assets/picture-templates/martini.webp";
import fishingThumb from "../assets/picture-templates/fishing.webp";
import yoyoThumb from "../assets/picture-templates/yoyo.webp";
import clockJuiceThumb from "../assets/picture-templates/clock-juice.webp";
import orangeClockThumb from "../assets/picture-templates/orange-clock.webp";
import puppetThumb from "../assets/picture-templates/puppet.webp";
import heartMirrorThumb from "../assets/picture-templates/heart-mirror.webp";
import lightbulbThumb from "../assets/picture-templates/lightbulb.webp";

// Ready-made pictures for a node: a set of paintings offered under
// "✨ Template" in a node's pictures (map/nodePanel/ImagesSection.tsx).
// Picking one adds it like any other picture, so it can then be the node's
// icon or card. Each comes twice: a small thumbnail built into the app (so the
// picker shows offline too) and the full painting in public/picture-templates/,
// fetched only when it is picked (useNodeImages' add then shrinks it to a
// stored picture like any other).

export const PICTURE_TEMPLATES = [
  "eyes",
  "clockHeads",
  "martini",
  "fishing",
  "yoyo",
  "clockJuice",
  "orangeClock",
  "puppet",
  "heartMirror",
  "lightbulb",
] as const;

export type PictureTemplate = (typeof PICTURE_TEMPLATES)[number];

const FILES: Record<PictureTemplate, { thumb: string; file: string }> = {
  eyes: { thumb: eyesThumb, file: "eyes" },
  clockHeads: { thumb: clockHeadsThumb, file: "clock-heads" },
  martini: { thumb: martiniThumb, file: "martini" },
  fishing: { thumb: fishingThumb, file: "fishing" },
  yoyo: { thumb: yoyoThumb, file: "yoyo" },
  clockJuice: { thumb: clockJuiceThumb, file: "clock-juice" },
  orangeClock: { thumb: orangeClockThumb, file: "orange-clock" },
  puppet: { thumb: puppetThumb, file: "puppet" },
  heartMirror: { thumb: heartMirrorThumb, file: "heart-mirror" },
  lightbulb: { thumb: lightbulbThumb, file: "lightbulb" },
};

/** Template `kind`'s small thumbnail, for the picker. */
export function pictureTemplateThumb(kind: PictureTemplate): string {
  return FILES[kind].thumb;
}

/** Where template `kind`'s full painting is served from. */
export function pictureTemplateUrl(kind: PictureTemplate): string {
  return `/picture-templates/${FILES[kind].file}.webp`;
}

/** Template `kind` as a file, to add to a node like a picked one. Rejects when it can't be fetched (offline). */
export async function pictureTemplateFile(kind: PictureTemplate, fetcher: typeof fetch = fetch): Promise<File> {
  const res = await fetcher(pictureTemplateUrl(kind));
  if (!res.ok) throw new Error(`template ${kind}: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], `${FILES[kind].file}.webp`, { type: "image/webp" });
}
