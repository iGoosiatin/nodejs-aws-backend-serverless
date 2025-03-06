import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

import { Product } from '../../types/product';
import { Stock } from '../../types/stock';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';
import { AvailableProduct, NewProduct } from '../../types';
import { environment } from '../../utils/environment';
import { dynamoDbDocClient } from '../../utils/clients';

const { PRODUCTS_TABLE, STOCKS_TABLE } = environment;

const isValidNewProduct = (possiblyProduct: unknown): possiblyProduct is NewProduct => {
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
export const createProduct = async (newProduct: NewProduct): Promise<AvailableProduct> => {
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
          TableName: PRODUCTS_TABLE,
          Item: product,
        },
      },
      {
        Put: {
          TableName: STOCKS_TABLE,
          Item: stock,
        },
      },
    ],
  });

  await dynamoDbDocClient.send(transactionCommand);

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
