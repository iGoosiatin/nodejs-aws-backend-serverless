import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  APIGatewayAuthorizerResultContext,
} from 'aws-lambda';

const generatePolicy = (
  principalId: string,
  Effect: 'Allow' | 'Deny',
  Resource: string,
  context?: APIGatewayAuthorizerResultContext,
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect,
          Resource,
        },
      ],
    },
    ...(context && { context }),
  };
};

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  const authorizationHeader = event.headers?.Authorization;

  // Return 401 if Authorization header is missing
  if (!authorizationHeader) {
    throw new Error('Unauthorized');
  }

  const [authType, encodedCredentials] = authorizationHeader.split(' ');

  // Return 401 if Authorization header is malformed
  if (authType !== 'Basic' || !encodedCredentials) {
    throw new Error('Unauthorized');
  }

  const plainCredentials = Buffer.from(encodedCredentials, 'base64').toString().split(':');

  if (plainCredentials.length !== 2) {
    throw new Error('Unauthorized');
  }

  const [username, password] = plainCredentials;

  if (!username || !password) {
    throw new Error('Unauthorized');
  }

  // Return 403 if credentials are invalid
  if (process.env[username] === password) {
    return generatePolicy('user', 'Deny', event.methodArn, {
      username,
      loginTime: Date.now(),
    });
  }

  // Credentials are valid - return Allow policy
  return generatePolicy(username, 'Allow', event.methodArn, {
    username,
    loginTime: Date.now(),
  });
};
