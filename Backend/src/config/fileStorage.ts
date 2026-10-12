import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

// File storage for node pictures (models/Image.ts): any S3-compatible bucket —
// Cloudflare R2 by default, though Amazon S3, Backblaze B2 or MinIO work the
// same. Set all of these to turn it on:
//
//   S3_BUCKET             the bucket's name
//   S3_ENDPOINT           R2: https://<account id>.r2.cloudflarestorage.com
//                         (leave unset for Amazon S3 itself)
//   S3_ACCESS_KEY_ID      an API token's access key id
//   S3_SECRET_ACCESS_KEY  and its secret
//   S3_REGION             optional: "auto" for R2 (the default), e.g.
//                         "eu-central-1" for Amazon S3
//
// The bucket stays private: pictures are only ever read back through
// GET /api/images/:imageId, which checks who may open the node first. With no
// bucket configured, pictures are kept in MongoDB instead (Image.data), so
// local dev and tests need none of this.

let client: S3Client | null | undefined;

function bucket(): string | null {
  return process.env.S3_BUCKET || null;
}

function getClient(): S3Client | null {
  if (client !== undefined) return client;
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION } = process.env;
  client =
    S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
      ? new S3Client({
          region: S3_REGION || "auto",
          endpoint: S3_ENDPOINT || undefined,
          credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
        })
      : null;
  return client;
}

/** Whether pictures go to the bucket (true) or into MongoDB (false). */
export function fileStorageEnabled(): boolean {
  return getClient() !== null;
}

export async function putFile(key: string, data: Buffer, contentType: string): Promise<void> {
  const s3 = getClient();
  if (!s3) throw new Error("File storage is not configured");
  await s3.send(new PutObjectCommand({ Bucket: bucket()!, Key: key, Body: data, ContentType: contentType }));
}

export async function getFile(key: string): Promise<Buffer> {
  const s3 = getClient();
  if (!s3) throw new Error("File storage is not configured");
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket()!, Key: key }));
  if (!res.Body) throw new Error(`File ${key} is empty`);
  return Buffer.from(await res.Body.transformToByteArray());
}

// Best effort: a file left behind costs a little space, while failing the
// node or map deletion that triggered this would be worse.
export async function deleteFiles(keys: string[]): Promise<void> {
  const s3 = getClient();
  if (!s3 || keys.length === 0) return;
  try {
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket()!,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  } catch (err) {
    console.error("deleteFiles failed:", err);
  }
}
