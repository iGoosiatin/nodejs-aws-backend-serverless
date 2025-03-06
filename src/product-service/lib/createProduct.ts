import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

import { Product } from '../../types/product';
import { Stock } from '../../types/stock';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

type AvailableProduct = Product & Stock;
type NewValidProduct = Omit<AvailableProduct, 'id'>;

const isValidNewProduct = (possiblyProduct: unknown): possiblyProduct is NewValidProduct => {
  if (typeof possiblyProduct !== 'object' || !possiblyProduct) {
    return false;
  }

  ['title', 'description', 'price', 'count'].forEach(field => {
    if (!(field in possiblyProduct)) {
      throw new Error(`Invalid product data: ${field} is missing!`);
    }
  });

  if (
    !(
      'title' in possiblyProduct &&
      'description' in possiblyProduct &&
      'price' in possiblyProduct &&
      'count' in possiblyProduct
    )
  ) {
    return false;
  }

  const { title, description, price, count } = possiblyProduct;

  if (!title) {
    throw new Error('Invalid product data: title should not be empty!');
  }
  if (!description) {
    throw new Error('Invalid product data: description should not be empty!');
  }
  if (typeof price !== 'number') {
    throw new Error('Invalid product data: price should be a number!');
  }
  if (price <= 0) {
    throw new Error('Invalid product data: price should be greater than 0!');
  }
  if (typeof count !== 'number') {
    throw new Error('Invalid product data: count should be a number!');
  }
  if (count < 0) {
    throw new Error('Invalid product data: count should not be less than 0!');
  }
  return (
    typeof title === 'string' &&
    typeof description === 'string' &&
    typeof price === 'number' &&
    typeof count === 'number'
  );
};

// exported for testing purposes
export const createProduct = async (newProduct: NewValidProduct): Promise<AvailableProduct> => {
  const productsTable = process.env.PRODUCTS_TABLE;
  const stocksTable = process.env.STOCKS_TABLE;

  if (!(productsTable && stocksTable)) {
    throw new Error('No PRODUCTS_TABLE and STOCKS_TABLE environment variable found');
  }

  const id = crypto.randomUUID();
  const { title, description, price, count } = newProduct;

  const product: Product = {
    id,
    title,
    description,
    price,
  };
  const stock: Stock = {
    id,
    count,
  };

  const transactionCommand = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: productsTable,
          Item: product,
        },
      },
      {
        Put: {
          TableName: stocksTable,
          Item: stock,
        },
      },
    ],
  });

  await docClient.send(transactionCommand);

  return {
    id,
    ...newProduct,
  };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  eventLogger(event);
  const body = event.body as string | Record<string, unknown> | undefined;
  if (!body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: 'No product data provided',
      }),
    };
  }

  let possiblyProduct: string | Record<string, unknown>;
  try {
    possiblyProduct = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: 'Failed to parse body',
      }),
    };
  }

  try {
    if (!isValidNewProduct(possiblyProduct)) {
      throw new Error('Invalid product data provided');
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: (error as Error).message,
      }),
    };
  }

  try {
    const product = await createProduct(possiblyProduct);
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(product),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(error),
    };
  }
};
