import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

import { environment } from '../../src/utils/environment';

interface ImportApiStackProps extends cdk.StackProps {
  productCreationQueue: sqs.Queue;
  basicAuthorizer: apigateway_authorizers.HttpLambdaAuthorizer;
}

export class ImportApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ImportApiStackProps) {
    super(scope, id, props);

    const { productCreationQueue, basicAuthorizer } = props;

    // Import existing bucket
    const bucket = s3.Bucket.fromBucketAttributes(this, 'ImportS3Bucket', {
      bucketName: environment.IMPORT_BUCKET,
    });

    // Create Lambda for creating product
    const importFunction = new nodejs.NodejsFunction(this, 'ImportProductsFileFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/import-service/lib/importProductsFile.ts',
      handler: 'handler',
      environment,
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Create file parser lambda function
    const parserFunction = new nodejs.NodejsFunction(this, 'ProductsParserFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/import-service/lib/importFileParser.ts',
      handler: 'handler',
      environment: { ...environment, PRODUCT_CREATION_QUEUE_URL: productCreationQueue.queueUrl },
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
        nodeModules: ['csv-parser'],
      },
    });

    // Grant permissions to Producer Lambda to send messages to SQS
    productCreationQueue.grantSendMessages(parserFunction);

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

    const productImportHttpApi = new apigateway.HttpApi(this, 'ProductImportHttpApi', {
      apiName: 'import-api',
      description: 'HTTP API for Product Import Service',
      defaultAuthorizationScopes: [''],
      corsPreflight: {
        allowMethods: [apigateway.CorsHttpMethod.GET],
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    const importProductsFileIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'ImportProductsFileIntegration',
      importFunction,
    );

    productImportHttpApi.addRoutes({
      path: '/import',
      methods: [apigateway.HttpMethod.GET],
      integration: importProductsFileIntegration,
      authorizer: basicAuthorizer,
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'Import HTTP Api URL', {
      value: productImportHttpApi.url ?? '',
    });
  }
}
