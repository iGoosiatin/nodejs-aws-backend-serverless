import { SQSEvent, SQSRecord, SQSHandler } from 'aws-lambda';
import { AvailableProduct } from '../../types';
import { getValidNewProduct } from '../../utils/validators';
import { createProduct } from '../../utils/productSaver';
import { snsClient } from '../../utils/clients';
import { PublishCommand } from '@aws-sdk/client-sns';

const PRODUCT_CREATION_QUEUE_URL = process.env.PRODUCT_CREATION_QUEUE_URL;
if (!PRODUCT_CREATION_QUEUE_URL) {
  throw new Error('PRODUCT_CREATION_QUEUE_URL environment variable is not set');
}

const PRODUCT_CREATION_TOPIC_ARN = process.env.PRODUCT_CREATION_TOPIC_ARN;
if (!PRODUCT_CREATION_TOPIC_ARN) {
  throw new Error('PRODUCT_CREATION_TOPIC_ARN environment variable is not set');
}

export async function handleRecord(record: SQSRecord): Promise<AvailableProduct> {
  const validProduct = getValidNewProduct(JSON.parse(record.body));
  return createProduct(validProduct);
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const promises = await Promise.allSettled(event.Records.map(async record => await handleRecord(record)));

  const successfulCreations = promises.filter(promise => promise.status === 'fulfilled').map(promise => promise.value);
  const unsuccessfulCreations = promises
    .filter(promise => promise.status === 'rejected')
    .map(promise => promise.reason.message);

  let statusValue = 'success';
  if (unsuccessfulCreations.length && !successfulCreations.length) {
    statusValue = 'error';
  } else if (unsuccessfulCreations.length) {
    statusValue = 'partial';
  }

  const command = new PublishCommand({
    TopicArn: PRODUCT_CREATION_TOPIC_ARN,
    Subject: 'Product creation report',
    Message: JSON.stringify(
      {
        ...(successfulCreations.length ? { successfulCreations } : {}),
        ...(unsuccessfulCreations.length ? { unsuccessfulCreations } : {}),
      },
      null,
      '\t',
    ),
    MessageAttributes: {
      ['status']: {
        DataType: 'String',
        StringValue: statusValue,
      },
    },
  });

  try {
    await snsClient.send(command);
  } catch (error) {
    console.error('Error publishing message to SNS:', error);
  }
};
