import { APIGatewayProxyEvent } from 'aws-lambda';

export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST',
};

export const eventLogger = (event: APIGatewayProxyEvent): void =>
  console.log('Received request:', JSON.stringify(event, null, 2));
