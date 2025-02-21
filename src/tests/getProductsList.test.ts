import { handler } from '../lib/getProductsList';

describe('getProductsList Lambda', () => {
  it('should return product list with 200 status code', async () => {
    const response = await handler();
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(body)).toBeTruthy();
  });
});
