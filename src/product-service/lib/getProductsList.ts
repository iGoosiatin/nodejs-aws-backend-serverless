import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { Product } from '../../types/product';
import { Stock } from '../../types/stock';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// exported for testing purposes
export const getProductsList = async () => {
  const productsTable = process.env.PRODUCTS_TABLE;
  const stocksTable = process.env.STOCKS_TABLE;

  if (!(productsTable && stocksTable)) {
    throw new Error('No PRODUCTS_TABLE and STOCKS_TABLE environment variable found');
  }

  const productsCommand = new ScanCommand({ TableName: productsTable });
  const stocksCommand = new ScanCommand({ TableName: stocksTable });

  const [productsResponse, stocksResponse] = await Promise.all([
    docClient.send(productsCommand),
    docClient.send(stocksCommand),
  ]);

  const products = (productsResponse.Items || []) as Product[];
  const stocks = (stocksResponse.Items || []) as Stock[];

  const stockMap = stocks.reduce<Record<string, number>>((map, { id, count }) => {
    map[id] = count;
    return map;
  }, {});

  const productsWithStocks = products.map(product => {
    return {
      ...product,
      count: stockMap[product.id] ?? 0,
    };
  });

  return productsWithStocks;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  eventLogger(event);
  try {
    const products = await getProductsList();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(products),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(error),
    };
  }
};
