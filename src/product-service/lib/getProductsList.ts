import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

import { Product } from '../../types/product';
import { Stock } from '../../types/stock';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';
import { environment } from '../../utils/environment';
import { dynamoDbDocClient } from '../../utils/clients';

const { PRODUCTS_TABLE, STOCKS_TABLE } = environment;

// exported for testing purposes
export const getProductsList = async () => {
  const productsCommand = new ScanCommand({ TableName: PRODUCTS_TABLE });
  const stocksCommand = new ScanCommand({ TableName: STOCKS_TABLE });

  const [productsResponse, stocksResponse] = await Promise.all([
    dynamoDbDocClient.send(productsCommand),
    dynamoDbDocClient.send(stocksCommand),
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
