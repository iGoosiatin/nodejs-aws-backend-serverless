import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../lib/getProductById';
import { products } from '../mocks/products';

const product = products[0];

const basicMockEvent = {
  httpMethod: 'GET',
  path: '/products/',
  headers: {},
  queryStringParameters: null,
  pathParameters: null,
  body: null,
} as APIGatewayProxyEvent;

describe('getProductById Lambda', () => {
  it('should return product when valid productId is provided', async () => {
    const mockEvent = {
      ...basicMockEvent,
      pathParameters: { productId: product.id },
    };

    const response = await handler(mockEvent);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual(product);
  });

  it('should return 404 when product is not found', async () => {
    const mockEvent = {
      ...basicMockEvent,
      pathParameters: { productId: 'non-existing-product-id' },
    };

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 when productId is missing', async () => {
    const response = await handler(basicMockEvent);

    expect(response.statusCode).toBe(400);
  });
});
