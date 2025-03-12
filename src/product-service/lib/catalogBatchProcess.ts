import { SQSEvent, SQSRecord, SQSHandler } from 'aws-lambda';
import { AvailableProduct } from '../../types';
import { getValidNewProduct } from '../../utils/validators';
import { createProduct } from '../../utils/productSaver';

const PRODUCT_CREATION_QUEUE_URL = process.env.PRODUCT_CREATION_QUEUE_URL;
if (!PRODUCT_CREATION_QUEUE_URL) {
  throw new Error('PRODUCT_CREATION_QUEUE_URL environment variable is not set');
}

async function handleRecord(record: SQSRecord): Promise<AvailableProduct> {
  const validProduct = getValidNewProduct(JSON.parse(record.body));
  return createProduct(validProduct);
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const promises = await Promise.allSettled(event.Records.map(async record => await handleRecord(record)));

  const successfulCreations = promises.filter(promise => promise.status === 'fulfilled').map(promise => promise.value);
  const unsuccessfulCreations = promises
    .filter(promise => promise.status === 'rejected')
    .map(promise => promise.reason);

  console.log('Successful creations:', successfulCreations);
  console.log('Unsuccessful creations:', unsuccessfulCreations);
};
