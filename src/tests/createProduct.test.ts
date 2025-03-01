import { APIGatewayProxyEvent } from 'aws-lambda';
import * as lambda from '../lib/createProduct';

jest.mock('../lib/helpers', () => ({
  eventLogger: jest.fn(),
}));

const TEST_UUID = '05cd03fd-2787-443f-8d33-d4de7549945b';

const basicMockEvent = {
  httpMethod: 'GET',
  path: '/products/',
  headers: {},
  queryStringParameters: null,
  pathParameters: null,
  body: null,
} as APIGatewayProxyEvent;

const newValidProduct = {
  title: 'Test Product',
  description: 'This is a test product',
  price: 10.99,
  count: 5,
};

describe('createProduct Lambda', () => {
  beforeEach(() => {
    jest.spyOn(lambda, 'createProduct').mockImplementation(async newProduct => ({ id: TEST_UUID, ...newProduct }));
  });

  it('should return product when created successfully', async () => {
    const mockEvent = {
      ...basicMockEvent,
      body: JSON.stringify(newValidProduct),
    };

    const response = await lambda.handler(mockEvent);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(201);
    expect(body).toStrictEqual({ id: TEST_UUID, ...newValidProduct });
  });

  describe('should return bad request if', () => {
    it('body is not provided', async () => {
      const mockEvent = {
        ...basicMockEvent,
        body: null,
      };

      const response = await lambda.handler(mockEvent);

      expect(response.statusCode).toBe(400);
    });

    it('body is not valid JSON', async () => {
      const mockEvent = {
        ...basicMockEvent,
        body: 'not a JSON',
      };

      const response = await lambda.handler(mockEvent);

      expect(response.statusCode).toBe(400);
    });

    it('body is not valid product', async () => {
      const mockEvent = {
        ...basicMockEvent,
        body: JSON.stringify({}),
      };

      const response = await lambda.handler(mockEvent);

      expect(response.statusCode).toBe(400);
    });

    it('title is empty', async () => {
      const mockEvent = {
        ...basicMockEvent,
        body: JSON.stringify({ ...newValidProduct, title: '' }),
      };

      const response = await lambda.handler(mockEvent);

      expect(response.statusCode).toBe(400);
    });
  });
});
