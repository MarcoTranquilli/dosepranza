import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';

const bucket = process.env.AUDIT_S3_BUCKET;
const region = process.env.AWS_REGION || 'eu-west-1';
const prefix = process.env.AUDIT_S3_PREFIX || 'uat-audit';

if (!bucket) {
  console.log('AUDIT_S3_BUCKET not set. Skipping audit export.');
  process.exit(0);
}

const client = new S3Client({ region });
const kmsKey = process.env.AUDIT_S3_KMS_KEY;
const content = await fs.readFile('audit_export.json', 'utf8');
const key = `${prefix}/audit-${new Date().toISOString().slice(0,10)}.json`;

await client.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: content,
  ContentType: 'application/json',
  ...(kmsKey ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKey } : {})
}));

console.log(`Audit exported to s3://${bucket}/${key}`);
