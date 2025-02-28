import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

if (!(process.env.PRODUCTS_TABLE && process.env.STOCKS_TABLE)) {
  throw new Error('No PRODUCTS_TABLE and STOCKS_TABLE environment variable found');
}

const environment = {
  PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
  STOCKS_TABLE: process.env.STOCKS_TABLE,
};

export class ProductsApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', environment.PRODUCTS_TABLE);
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', environment.STOCKS_TABLE);

    // Create Lambda for getting products list
    const getProductsListFunction = new lambda.Function(this, 'GetProductsListHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lib/getProductsList.handler',
      code: lambda.Code.fromAsset('build'),
      environment,
    });

    // Create Lambda for getting product by ID
    const getProductByIdFunction = new lambda.Function(this, 'GetProductByIdHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lib/getProductById.handler',
      code: lambda.Code.fromAsset('build'),
      environment,
    });

    // Grant DynamoDB read permissions to the function
    productsTable.grantReadData(getProductsListFunction);
    productsTable.grantReadData(getProductByIdFunction);
    stocksTable.grantReadData(getProductsListFunction);
    stocksTable.grantReadData(getProductByIdFunction);

    // Create HTTP API
    const httpApi = new apigateway.HttpApi(this, 'ProductsHttpApi', {
      apiName: 'products-api',
      description: 'HTTP API for Products Service',
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

    // Add routes
    httpApi.addRoutes({
      path: '/products',
      methods: [apigateway.HttpMethod.GET],
      integration: getProductsListIntegration,
    });

    httpApi.addRoutes({
      path: '/products/{productId}',
      methods: [apigateway.HttpMethod.GET],
      integration: getProductByIdIntegration,
    });

    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url ?? '',
    });
  }
}
