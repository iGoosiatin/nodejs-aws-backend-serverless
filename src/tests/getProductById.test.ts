import { APIGatewayProxyEvent } from 'aws-lambda';
import * as lambda from '../product-service/lib/getProductById';
import { products } from '../mocks/products';

jest.mock('../utils/logger', () => ({
  eventLogger: jest.fn(),
}));

const product = { ...products[0], count: 0 };

const basicMockEvent = {
  httpMethod: 'GET',
  path: '/products/',
  headers: {},
  queryStringParameters: null,
  pathParameters: null,
  body: null,
} as APIGatewayProxyEvent;

describe('getProductById Lambda', () => {
  beforeEach(() => {
    jest.spyOn(lambda, 'getProductById').mockImplementation(async (id: string) => {
      const product = products.find(product => product.id === id);
      return product ? { ...product, count: 0 } : null;
    });
  });

  it('should return product when valid productId is provided', async () => {
    const mockEvent = {
      ...basicMockEvent,
      pathParameters: { productId: product.id },
    };

    const response = await lambda.handler(mockEvent);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual(product);
  });

  it('should return 404 when product is not found', async () => {
    const mockEvent = {
      ...basicMockEvent,
      pathParameters: { productId: 'non-existing-product-id' },
    };

    const response = await lambda.handler(mockEvent);

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 when productId is missing', async () => {
    const response = await lambda.handler(basicMockEvent);

    expect(response.statusCode).toBe(400);
  });
});
