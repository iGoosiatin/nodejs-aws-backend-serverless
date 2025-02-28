import { APIGatewayProxyResult } from 'aws-lambda';
import { products } from '../mocks/products';
import { headers } from './helpers';

const getProductsList = () => products;

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const products = getProductsList();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(products),
  };
};
