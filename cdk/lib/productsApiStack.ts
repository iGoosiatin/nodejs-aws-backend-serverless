import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

import { environment } from '../../src/utils/environment';

const { PRODUCTS_TABLE, STOCKS_TABLE, PRODUCT_CREATION_NOTIF_ADMIN_EMAIL, PRODUCT_CREATION_NOTIF_EMAIL } = environment;

interface ProductsApiStackProps extends cdk.StackProps {
  productCreationQueue: sqs.Queue;
}

export class ProductsApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ProductsApiStackProps) {
    super(scope, id, props);

    const { productCreationQueue } = props;

    // Reference DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', PRODUCTS_TABLE);
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', STOCKS_TABLE);

    // Create SNS topic
    const productCreationTopic = new sns.Topic(this, 'createProductTopic', {
      topicName: 'createProductTopic',
      displayName: 'Product Creation Notifications',
    });

    productCreationTopic.addSubscription(new subscriptions.EmailSubscription(PRODUCT_CREATION_NOTIF_EMAIL));

    productCreationTopic.addSubscription(
      new subscriptions.EmailSubscription(PRODUCT_CREATION_NOTIF_ADMIN_EMAIL, {
        filterPolicy: {
          status: sns.SubscriptionFilter.stringFilter({
            allowlist: ['partial', 'error'],
          }),
        },
      }),
    );

    // Create Lambda for getting products list
    const getProductsListFunction = new nodejs.NodejsFunction(this, 'GetProductsListHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/getProductsList.ts',
      handler: 'handler',
      environment,
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create Lambda for getting product by ID
    const getProductByIdFunction = new nodejs.NodejsFunction(this, 'GetProductByIdHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/getProductById.ts',
      handler: 'handler',
      environment,
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create Lambda for creating product
    const createProductFunction = new nodejs.NodejsFunction(this, 'CreateProductHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/createProduct.ts',
      handler: 'handler',
      environment,
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create Lambda for creating product
    const createBatchProductFunction = new nodejs.NodejsFunction(this, 'CreateBatchProductHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/catalogBatchProcess.ts',
      handler: 'handler',
      environment: {
        ...environment,
        PRODUCT_CREATION_QUEUE_URL: productCreationQueue.queueUrl,
        PRODUCT_CREATION_TOPIC_ARN: productCreationTopic.topicArn,
      },
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Add SQS as event source for Consumer Lambda
    const eventSource = new lambdaEventSources.SqsEventSource(productCreationQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(30),
      reportBatchItemFailures: true,
    });

    createBatchProductFunction.addEventSource(eventSource);

    productCreationTopic.grantPublish(createBatchProductFunction);

    // Grant DynamoDB read permissions to the function
    productsTable.grantReadData(getProductsListFunction);
    productsTable.grantReadData(getProductByIdFunction);
    productsTable.grantWriteData(createProductFunction);
    productsTable.grantWriteData(createBatchProductFunction);
    stocksTable.grantReadData(getProductsListFunction);
    stocksTable.grantReadData(getProductByIdFunction);
    stocksTable.grantWriteData(createProductFunction);
    stocksTable.grantWriteData(createBatchProductFunction);

    // Create HTTP API
    const productHttpApi = new apigateway.HttpApi(this, 'ProductsHttpApi', {
      apiName: 'products-api',
      description: 'HTTP API for Products Service',
      corsPreflight: {
        allowMethods: [apigateway.CorsHttpMethod.GET, apigateway.CorsHttpMethod.POST],
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Create Lambda integrations
    const getProductsListIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'GetProductsListIntegration',
      getProductsListFunction,
    );

    const getProductByIdIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'GetProductByIdIntegration',
      getProductByIdFunction,
    );

    const createProductIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'CreateProductntegration',
      createProductFunction,
    );

    // Add routes
    productHttpApi.addRoutes({
      path: '/products',
      methods: [apigateway.HttpMethod.GET],
      integration: getProductsListIntegration,
    });

    productHttpApi.addRoutes({
      path: '/products',
      methods: [apigateway.HttpMethod.POST],
      integration: createProductIntegration,
    });

    productHttpApi.addRoutes({
      path: '/products/{productId}',
      methods: [apigateway.HttpMethod.GET],
      integration: getProductByIdIntegration,
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'Product HTTP Api URL', {
      value: productHttpApi.url ?? '',
    });
  }
}
