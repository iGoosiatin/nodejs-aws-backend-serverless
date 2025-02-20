import { APIGatewayProxyResult } from 'aws-lambda';
import { products } from 'mocks/products';

const getProductsList = () => products;

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const products = getProductsList();

  return {
    statusCode: 200,
    body: JSON.stringify(products),
  };
};
