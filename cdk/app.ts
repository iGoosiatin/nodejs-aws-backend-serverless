import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { ProductsApiStack } from './lib/productsApiStack';
import { SqsStack } from './lib/sqsStack';
import { ImportApiStack } from './lib/importApiStack';
import { AuthStack } from './lib/authStack';

const app = new cdk.App();

const { productCreationQueue } = new SqsStack(app, 'ProductCreationQueueStack');
const { basicAuthorizer } = new AuthStack(app, 'AuthStack');

new ProductsApiStack(app, 'ProductsApiStack', {
  productCreationQueue,
});

new ImportApiStack(app, 'ImportApiStack', { productCreationQueue, basicAuthorizer });

app.synth();
