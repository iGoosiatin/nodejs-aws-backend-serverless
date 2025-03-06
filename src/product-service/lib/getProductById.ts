import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from '../../types/product';
import { Stock } from '../../types/stock';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';
import { dynamoDbDocClient } from '../../utils/clients';

import { environment } from '../../utils/environment';

const { PRODUCTS_TABLE, STOCKS_TABLE } = environment;

// exported for testing purposes
export const getProductById = async (id: string) => {
  const productCommand = new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id } });
  const stockCommand = new GetCommand({ TableName: STOCKS_TABLE, Key: { id } });

  const [productResponse, stockResponse] = await Promise.all([
    dynamoDbDocClient.send(productCommand),
    dynamoDbDocClient.send(stockCommand),
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
