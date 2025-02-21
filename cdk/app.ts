import * as cdk from 'aws-cdk-lib';
import { ProductsApiStack } from './lib/productsApiStack';

const app = new cdk.App();
new ProductsApiStack(app, 'ProductsApiStack');
app.synth();
