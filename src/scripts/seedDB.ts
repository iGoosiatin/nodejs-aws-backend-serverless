import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { products } from 'mocks/products';
import { stocks } from 'mocks/stocks';

const productsTable = process.env.PRODUCTS_TABLE;
const stocksTable = process.env.STOCKS_TABLE;
const region = process.env.AWS_REGION || 'us-east-1';

if (!(productsTable && stocksTable)) {
  throw new Error('No PRODUCTS_TABLE and STOCKS_TABLE environment variable found');
}

// Initialize the DynamoDB client
const client = new DynamoDBClient({ region }); // adjust region as needed
const docClient = DynamoDBDocumentClient.from(client);

// DynamoDB can process up to 25 items in one batch
const BATCH_SIZE = 25;

async function batchWriteItems(table: string, items: Array<Record<string, unknown>>) {
  try {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const params = {
        RequestItems: {
          [table]: batch.map(Item => ({
            PutRequest: {
              Item,
            },
          })),
        },
      };

      const command = new BatchWriteCommand(params);
      await docClient.send(command);

      console.log(`Processed batch of ${batch.length} products`);
    }

    console.log('Data import completed successfully');
  } catch (error) {
    console.error('Error importing data:', error);
  }
}

// Execute the function
batchWriteItems(productsTable, products);
batchWriteItems(stocksTable, stocks);
