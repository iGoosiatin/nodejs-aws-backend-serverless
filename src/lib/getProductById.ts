import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import { eventLogger, headers } from './helpers';
import { Product } from 'types/product';
import { Stock } from 'types/stock';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// exported for testing purposes
export const getProductById = async (id: string) => {
  const productsTable = process.env.PRODUCTS_TABLE;
  const stocksTable = process.env.STOCKS_TABLE;

  if (!(productsTable && stocksTable)) {
    throw new Error('No PRODUCTS_TABLE and STOCKS_TABLE environment variable found');
  }

  const productCommand = new GetCommand({ TableName: productsTable, Key: { id } });
  const stockCommand = new GetCommand({ TableName: stocksTable, Key: { id } });

  const [productResponse, stockResponse] = await Promise.all([
    docClient.send(productCommand),
    docClient.send(stockCommand),
  ]);

  const product = productResponse.Item as Product | undefined;

  if (!product) {
    return null;
  }

  const stock = stockResponse.Item as Stock | undefined;
  return {
    ...product,
    count: stock?.count ?? 0,
  };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  eventLogger(event);
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: 'productId is required',
      }),
    };
  }

  try {
    const product = await getProductById(productId);

    if (!product) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: 'Product not found',
        }),
      };
    }

    return {
      statusCode: 200,
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
