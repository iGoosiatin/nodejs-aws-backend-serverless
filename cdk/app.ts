import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { ProductsApiStack } from './lib/productsApiStack';
import { SnsStack } from './lib/snsStack';
import { SqsStack } from './lib/sqsStack';
import { ImportApiStack } from './lib/importApiStack';

const app = new cdk.App();

const { productCreationTopic } = new SnsStack(app, 'ProductCreationSnsStack');
const { productCreationQueue } = new SqsStack(app, 'ProductCreationQueueStack');

new ProductsApiStack(app, 'ProductsApiStack', {
  productCreationTopic,
  productCreationQueue,
});

new ImportApiStack(app, 'ImportApiStack', { productCreationQueue });

app.synth();
