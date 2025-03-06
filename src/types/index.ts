import { Product } from './product';
import { Stock } from './stock';

export type AvailableProduct = Product & Stock;
export type NewProduct = Omit<AvailableProduct, 'id'>;
