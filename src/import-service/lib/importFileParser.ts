import { S3Event } from 'aws-lambda';
import { GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { environment } from '../../utils/environment';
import { NewProduct, AvailableProduct } from '../../types';
import { dynamoDbDocClient, s3Client } from '../../utils/clients';

const { UPLOAD_DIR, PARSED_DIR, PRODUCTS_TABLE, STOCKS_TABLE } = environment;

const createProduct = async (product: NewProduct): Promise<AvailableProduct> => {
  const id = crypto.randomUUID();
  const { title, description, price, count } = product;

  const transactionCommand = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: PRODUCTS_TABLE,
          Item: {
            id,
            title,
            description,
            price,
          },
        },
      },
      {
        Put: {
          TableName: STOCKS_TABLE,
          Item: {
            id,
            count,
          },
        },
      },
    ],
  });

  await dynamoDbDocClient.send(transactionCommand);

  return {
    id,
    ...product,
  };
};

const getValidProduct = (product: unknown): NewProduct => {
  if (typeof product !== 'object' || !product) {
    throw new Error('Invalid product format');
  }

  ['title', 'description', 'price', 'count'].forEach(field => {
    if (!(field in product)) {
      throw new Error(`Invalid product data: ${field} is missing!`);
    }
  });

  if (!('title' in product && 'description' in product && 'price' in product && 'count' in product)) {
    // This part of code is just to please TS
    throw new Error();
  }

  const { title, description } = product;
  let { price, count } = product;
  price = Number(price);
  count = Number(count);

  if (!title) {
    throw new Error('Invalid product data: title should not be empty!');
  }
  if (!description) {
    throw new Error('Invalid product data: description should not be empty!');
  }
  if (typeof price !== 'number' || isNaN(price)) {
    throw new Error('Invalid product data: price should be a number!');
  }
  if (price <= 0) {
    throw new Error('Invalid product data: price should be greater than 0!');
  }
  if (typeof count !== 'number' || isNaN(count)) {
    throw new Error('Invalid product data: count should be a number!');
  }
  if (count < 0) {
    throw new Error('Invalid product data: count should not be less than 0!');
  }

  return product as NewProduct;
};

const handleProduct = async (product: unknown): Promise<void> => {
  console.log('Product to process:', product);
  let validProduct: NewProduct;
  try {
    validProduct = getValidProduct(product);
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
