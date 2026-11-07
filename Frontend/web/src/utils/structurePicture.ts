import * as nodesApi from "../api/nodes";
import { makeCardImage, shrinkImage } from "./images";
import { pickMapKindPicture, pictureTemplateFile } from "./pictureTemplates";
import type { MapKind, NodeDoc } from "../types";

interface Deps {
  random?: () => number;
  fetchFile?: typeof pictureTemplateFile;
  shrink?: typeof shrinkImage;
  makeCard?: typeof makeCardImage;
  update?: typeof nodesApi.updateNode;
}

/**
 * Gives a starter structure's first node (the canvas menu's "Analyze a
 * problem"…, a new map of that kind, a Think it through map) the kind's
 * painting (MAP_KIND_PICTURES): added as its picture and shown as its picture
 * card. Best-effort: the structure is there either way, so a painting that
 * can't be fetched (offline) or saved leaves the node as it was and gives null.
 */
export async function addStructurePicture(nodeId: string, kind: MapKind, deps: Deps = {}): Promise<NodeDoc | null> {
  try {
    const file = await (deps.fetchFile ?? pictureTemplateFile)(pickMapKindPicture(kind, deps.random));
    const image = await (deps.shrink ?? shrinkImage)(file);
    const cardImage = await (deps.makeCard ?? makeCardImage)(image);
    const update = deps.update ?? nodesApi.updateNode;
    return await update(nodeId, { images: [image], cardImage });
  } catch {
    return null;
  }
}
