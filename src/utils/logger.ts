import { APIGatewayProxyEvent } from 'aws-lambda';

export const eventLogger = (event: APIGatewayProxyEvent): void =>
  console.log('Received request:', JSON.stringify(event, null, 2));
