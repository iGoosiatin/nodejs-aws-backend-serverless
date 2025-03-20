import { S3Event } from 'aws-lambda';
import { GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { environment } from '../../utils/environment';
import { s3Client, sqsClient } from '../../utils/clients';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

const PRODUCT_CREATION_QUEUE_URL = process.env.PRODUCT_CREATION_QUEUE_URL;
if (!PRODUCT_CREATION_QUEUE_URL) {
  throw new Error('PRODUCT_CREATION_QUEUE_URL environment variable is not set');
}

const { UPLOAD_DIR, PARSED_DIR } = environment;

const handleProduct = async (product: unknown): Promise<void> => {
  const command = new SendMessageCommand({
    QueueUrl: process.env.PRODUCT_CREATION_QUEUE_URL,
    MessageBody: JSON.stringify(product),
  });

  await sqsClient.send(command);
};

const handleFile = async (Bucket: string, Key: string): Promise<void> => {
  const getCommand = new GetObjectCommand({ Bucket, Key });
  const response = await s3Client.send(getCommand);
  const stream = response.Body as Readable;

  return new Promise((resolve, reject) => {
    stream.pipe(
      csv().on('data', async record => {
        await handleProduct(record);
      }),
    );

    stream.on('error', reject);
    stream.on('end', async () => {
      try {
        // Move file to parsed folder
        const newKey = Key.replace(UPLOAD_DIR, PARSED_DIR);

        await s3Client.send(
          new CopyObjectCommand({
            Bucket,
            CopySource: `${Bucket}/${Key}`,
            Key: newKey,
          }),
        );

        // Delete from uploaded folder
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket,
            Key,
          }),
        );

        resolve();
      } catch (error) {
        console.error('Error moving file:', error);
      }

      resolve();
    });
  });
};

export const handler = async ({ Records }: S3Event) => {
  try {
    await Promise.all(
      Records.map(async ({ s3 }) => {
        await handleFile(s3.bucket.name, s3.object.key);
      }),
    );
  } catch (error) {
    console.error('Error processing CSV:', error);
    throw error;
  }
};
