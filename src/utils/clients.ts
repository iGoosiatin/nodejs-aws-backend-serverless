import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const dynamoDbDocClient = DynamoDBDocumentClient.from(client);
export const s3Client = new S3Client({});
export const sqsClient = new SQSClient({});
export const snsClient = new SNSClient({});
