import { NewProduct } from '../types';

export const getValidNewProduct = (product: unknown): NewProduct => {
  if (typeof product !== 'object' || !product) {
    throw new Error('Invalid product format');
  }

  ['title', 'description', 'price', 'count'].forEach(field => {
    if (!(field in product)) {
      throw new Error(`Invalid product data: ${field} is missing!`);
    }
  });

  if (!('title' in product && 'description' in product && 'price' in product && 'count' in product)) {
    // This part of code is just to please TS
    throw new Error();
  }

  const { title, description } = product;
  let { price, count } = product;
  price = Number(price);
  count = Number(count);

  if (!title) {
    throw new Error('Invalid product data: title should not be empty!');
  }
  if (!description) {
    throw new Error('Invalid product data: description should not be empty!');
  }
  if (typeof price !== 'number' || isNaN(price)) {
    throw new Error('Invalid product data: price should be a number!');
  }
  if (price <= 0) {
    throw new Error('Invalid product data: price should be greater than 0!');
  }
  if (typeof count !== 'number' || isNaN(count)) {
    throw new Error('Invalid product data: count should be a number!');
  }
  if (count < 0) {
    throw new Error('Invalid product data: count should not be less than 0!');
  }

  return product as NewProduct;
};
