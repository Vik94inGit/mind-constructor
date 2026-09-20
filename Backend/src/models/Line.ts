import mongoose from "mongoose";

// A drawn separator line on a map — a polyline of canvas points a member
// draws to split groups of nodes apart visually. Purely a drawing: nothing
// about nodes, zones or edges reads it. Shared with every member of the map
// (see the line:created / line:deleted broadcasts), deletable by whoever drew
// it or by the map's owner.
export const MAX_LINE_POINTS = 200;

const PointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

const LineSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true, unique: true }, // public id, nanoid — same pattern as Map/Node/Edge
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // creator
    points: {
      type: [PointSchema],
      validate: {
        validator: (v: unknown[]) => v.length >= 2 && v.length <= MAX_LINE_POINTS,
        message: `a line needs between 2 and ${MAX_LINE_POINTS} points`,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// mapId: every map-load query (getLinesByMapDao, deleteMapDao's cascade)
// filters on this.
LineSchema.index({ mapId: 1 });

export const Line = mongoose.model("Line", LineSchema);
