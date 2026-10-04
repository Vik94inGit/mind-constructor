import mongoose from "mongoose";

// A user's own folder on the dashboard, for sorting their maps. Personal: it
// belongs to one user and only that user sees it — a shared map can sit in a
// different folder (or none) for each of its members. A map is in at most one
// of a user's folders; deleting a folder only puts its maps back at the top
// level, never deletes them.
export const MAX_FOLDER_NAME = 60;

const FolderSchema = new mongoose.Schema(
  {
    folderId: { type: String, required: true, unique: true }, // public id, nanoid — same pattern as Map/Node/Edge
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: MAX_FOLDER_NAME },
    // Public mapIds. May still list a map that was since deleted or that the
    // user lost access to; the dashboard only shows maps it actually lists.
    mapIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        delete ret.ownerId;
        return ret;
      },
    },
  },
);

// ownerId: every folder query is scoped to its owner. mapIds: deleteMapDao's
// cascade and moveMapToFolderDao pull a map out of every folder holding it.
FolderSchema.index({ ownerId: 1 });
FolderSchema.index({ mapIds: 1 });

export const Folder = mongoose.model("Folder", FolderSchema);
