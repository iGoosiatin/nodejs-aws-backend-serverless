import * as cdk from 'aws-cdk-lib';
import { ProductsApiStack } from './lib/productsApiStack';
import { SnsStack } from './lib/snsStack';

const app = new cdk.App();

const productCreationSnsStack = new SnsStack(app, 'ProductCreationSnsStack');

new ProductsApiStack(app, 'ProductsApiStack', {
  productCreationTopic: productCreationSnsStack.productCreationTopic,
});

app.synth();
