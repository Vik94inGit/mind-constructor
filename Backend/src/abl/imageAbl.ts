import { findImageDao, readImageDataDao } from "../dao/imageDao.js";
import { findNodeByInternalIdDao, findNodeDao } from "../dao/nodeDao.js";

// One stored picture (models/Image.ts), for whoever may open its node: a
// member of the node's map, and for an invited member only while the node
// isn't in a branch the owner hid (findNodeDao applies both rules). null
// otherwise, the same as for a picture that doesn't exist. Its bytes are
// only read once that check has passed.
export const getImageAbl = async (imageId: string, userId: string) => {
  const image = await findImageDao(imageId);
  if (!image) return null;
  const node = await findNodeByInternalIdDao(image.nodeId);
  if (!node || !(await findNodeDao(node.nodeId, userId))) return null;
  return { mime: image.mime, data: await readImageDataDao(image) };
};
