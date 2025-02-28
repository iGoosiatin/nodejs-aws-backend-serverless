import * as lambda from '../lib/getProductsList';
import { products } from '../mocks/products';

describe('getProductsList Lambda', () => {
  beforeEach(() => {
    jest
      .spyOn(lambda, 'getProductsList')
      .mockImplementation(async () => products.map(product => ({ ...product, count: 0 })));
  });
  it('should return product list with 200 status code', async () => {
    const response = await lambda.handler();
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(body)).toBeTruthy();
  });
});
