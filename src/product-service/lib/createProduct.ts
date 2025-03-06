import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { eventLogger } from '../../utils/logger';
import { headers } from '../../utils/http';
import { getValidNewProduct } from '../../utils/validators';
import { NewProduct } from '../../types';
import { createProduct } from '../../utils/productSaver';

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

  let validNewProduct: NewProduct;

  try {
    validNewProduct = getValidNewProduct(possiblyProduct);
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
    const product = await createProduct(validNewProduct);
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
