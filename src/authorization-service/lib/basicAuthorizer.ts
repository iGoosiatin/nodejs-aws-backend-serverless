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
  const authorizationHeader = Object.entries(event.headers || {}).find(
    ([key]) => key.toLowerCase() === 'authorization',
  )?.[1];
  // Return 401 if Authorization header is missing
  if (!authorizationHeader) {
    throw new Error('Unauthorized');
  }

  const encodedCredentials = authorizationHeader.split(' ')[1];
  const [username, password] = Buffer.from(encodedCredentials, 'base64').toString().split(':');

  // Return 403 if credentials are invalid
  if (!password || process.env[username] !== password) {
    return generatePolicy(username, 'Deny', event.methodArn, {
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
