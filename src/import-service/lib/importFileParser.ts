import { S3Event } from 'aws-lambda';
import { GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { environment } from '../../utils/environment';
import { NewProduct } from '../../types';
import { s3Client } from '../../utils/clients';
import { getValidNewProduct } from '../../utils/validators';
import { createProduct } from '../../utils/productSaver';

const { UPLOAD_DIR, PARSED_DIR } = environment;

const handleProduct = async (product: unknown): Promise<void> => {
  console.log('Product to process:', product);
  let validProduct: NewProduct;
  try {
    validProduct = getValidNewProduct(product);
    console.log('Valid product to be saved:', validProduct);
  } catch (error) {
    console.error('Error processing product:', (error as Error).message);
    return;
  }

  const savedProduct = await createProduct(validProduct);
  console.log('Saved product:', savedProduct);
};

const handleFile = async (Bucket: string, Key: string): Promise<void> => {
  const getCommand = new GetObjectCommand({ Bucket, Key });
  const response = await s3Client.send(getCommand);
  const stream = response.Body as Readable;

  return new Promise((resolve, reject) => {
    const promises: Promise<void>[] = [];

    stream.pipe(
      csv().on('data', record => {
        promises.push(handleProduct(record));
      }),
    );

    stream.on('error', reject);
    stream.on('end', async () => {
      await Promise.all(promises);

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
