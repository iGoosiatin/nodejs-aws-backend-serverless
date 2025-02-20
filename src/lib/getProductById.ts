import { products } from 'mocks/products';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const getProductById = (id: string) => products.find(product => product.id === id);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'productId is required',
      }),
    };
  }

  const product = getProductById(productId);

  if (!product) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'Product not found',
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(product),
  };
};
