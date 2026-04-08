import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';

/**
 * Upload a buffer to S3 at the given key.
 */
export const uploadToS3 = async (
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
};

/**
 * Generate a pre-signed GET URL for the given S3 key.
 * Default expiry: 1 hour (3600 seconds).
 */
export const getPresignedUrl = async (
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete an object from S3 by key.
 */
export const deleteFromS3 = async (bucket: string, key: string): Promise<void> => {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await s3Client.send(command);
};
