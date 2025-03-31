import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

const BASIC_AUTH_USER = 'iGoosiatin';

export class AuthStack extends cdk.Stack {
  public readonly basicAuthorizer: apigateway_authorizers.HttpLambdaAuthorizer;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const authorizerFunction = new nodejs.NodejsFunction(this, 'BasicAuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/authorization-service/lib/basicAuthorizer.ts',
      handler: 'handler',
      environment: {
        [BASIC_AUTH_USER]: process.env[BASIC_AUTH_USER] || '',
      },
      bundling: {
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    this.basicAuthorizer = new apigateway_authorizers.HttpLambdaAuthorizer('BasicAuthorizer', authorizerFunction, {
      authorizerName: 'basic-authorizer',
      responseTypes: [apigateway_authorizers.HttpLambdaResponseType.IAM],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });
  }
}
