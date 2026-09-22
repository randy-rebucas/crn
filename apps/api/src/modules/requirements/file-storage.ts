import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { diskStorage } from 'multer';

// Local-disk storage for requirement submission uploads. Dev/single-node
// deployment only — swap for an object-storage engine (S3, GCS, etc.)
// before running multiple API instances, since `filePath` is a relative
// path on this instance's disk.
export const REQUIREMENTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'requirements');

if (!existsSync(REQUIREMENTS_UPLOAD_DIR)) {
  mkdirSync(REQUIREMENTS_UPLOAD_DIR, { recursive: true });
}

// A closed allowlist, not a blocklist — an upload is proof material for a
// human reviewer (transcript, ID, certificate), never executable content.
export const REQUIREMENT_FILE_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const REQUIREMENT_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const requirementFileStorage = diskStorage({
  destination: REQUIREMENTS_UPLOAD_DIR,
  filename: (_req, file, callback) => {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : undefined;
    const safeName = `${randomUUID()}${ext ? `.${ext.replace(/[^a-zA-Z0-9]/g, '')}` : ''}`;
    callback(null, safeName);
  },
});
