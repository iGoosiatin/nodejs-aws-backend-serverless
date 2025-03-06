import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

import { Product } from '../types/product';
import { Stock } from '../types/stock';

import { AvailableProduct, NewProduct } from '../types';
import { environment } from '../utils/environment';
import { dynamoDbDocClient } from '../utils/clients';

const { PRODUCTS_TABLE, STOCKS_TABLE } = environment;

// exported for testing purposes
export const createProduct = async (newProduct: NewProduct): Promise<AvailableProduct> => {
  const id = crypto.randomUUID();
  const { title, description, price, count } = newProduct;

  const product: Product = {
    id,
    title,
    description,
    price,
  };
  const stock: Stock = {
    id,
    count,
  };

  const transactionCommand = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: PRODUCTS_TABLE,
          Item: product,
        },
      },
      {
        Put: {
          TableName: STOCKS_TABLE,
          Item: stock,
        },
      },
    ],
  });

  await dynamoDbDocClient.send(transactionCommand);

  return {
    id,
    ...newProduct,
  };
};
