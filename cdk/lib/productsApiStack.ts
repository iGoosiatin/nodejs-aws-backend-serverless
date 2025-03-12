import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

import { Duration } from 'aws-cdk-lib';

import { environment } from '../../src/utils/environment';

export class ProductsApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', environment.PRODUCTS_TABLE);
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', environment.STOCKS_TABLE);

    // Import existing bucket
    const bucket = s3.Bucket.fromBucketAttributes(this, 'ImportS3Bucket', {
      bucketName: environment.IMPORT_BUCKET,
    });

    // SQS Queue
    const queue = new sqs.Queue(this, 'ProductCreationQueue', {
      queueName: 'ProductCreationQueue',
    });

    // Create Lambda for getting products list
    const getProductsListFunction = new nodejs.NodejsFunction(this, 'GetProductsListHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/getProductsList.ts',
      handler: 'handler',
      environment,
      bundling: {
        minify: true,
        sourceMap: false,
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
        minify: true,
        sourceMap: false,
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
        minify: true,
        sourceMap: false,
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create Lambda for creating product
    const createBatchProductFunction = new nodejs.NodejsFunction(this, 'CreateBatchProductHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/product-service/lib/catalogBatchProcess.ts',
      handler: 'handler',
      environment: { ...environment, PRODUCT_CREATION_QUEUE_URL: queue.queueUrl },
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create Lambda for creating product
    const importFunction = new nodejs.NodejsFunction(this, 'ImportProductsFileFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/import-service/lib/importProductsFile.ts',
      handler: 'handler',
      environment,
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create file parser lambda function
    const parserFunction = new nodejs.NodejsFunction(this, 'ProductsParserFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/import-service/lib/importFileParser.ts',
      handler: 'handler',
      environment: { ...environment, PRODUCT_CREATION_QUEUE_URL: queue.queueUrl },
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2022',
        externalModules: ['aws-sdk'],
        nodeModules: ['csv-parser'],
      },
    });

    // Grant permissions to Producer Lambda to send messages to SQS
    queue.grantSendMessages(parserFunction);

    // Grant Lambda permissions to access S3
    bucket.grantReadWrite(importFunction);

    // Grant permissions to read from uploaded folder
    const s3ParserPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
      resources: [
        // Permission for the bucket itself (for ListBucket)
        bucket.bucketArn,
        // Permissions for objects in both directories
        `${bucket.bucketArn}/${environment.UPLOAD_DIR}/*`,
        `${bucket.bucketArn}/${environment.PARSED_DIR}/*`,
      ],
    });

    parserFunction.addToRolePolicy(s3ParserPolicy);

    // Add S3 notification for uploaded files
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(parserFunction), {
      prefix: `${environment.UPLOAD_DIR}/`,
    });

    // Add SQS as event source for Consumer Lambda
    const eventSource = new lambdaEventSources.SqsEventSource(queue, {
      batchSize: 5,
      maxBatchingWindow: Duration.seconds(30),
      reportBatchItemFailures: true,
    });

    createBatchProductFunction.addEventSource(eventSource);

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

    const productImportHttpApi = new apigateway.HttpApi(this, 'ProductImportHttpApi', {
      apiName: 'import-api',
      description: 'HTTP API for Product Import Service',
      corsPreflight: {
        allowMethods: [apigateway.CorsHttpMethod.GET],
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

    const importProductsFileIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'ImportProductsFileIntegration',
      importFunction,
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

    productImportHttpApi.addRoutes({
      path: '/import',
      methods: [apigateway.HttpMethod.GET],
      integration: importProductsFileIntegration,
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'Product HTTP Api URL', {
      value: productHttpApi.url ?? '',
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'Import HTTP Api URL', {
      value: productImportHttpApi.url ?? '',
    });
  }
}
