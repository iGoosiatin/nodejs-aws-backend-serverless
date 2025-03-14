import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SqsStack extends cdk.Stack {
  public readonly productCreationQueue: sqs.Queue;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.productCreationQueue = new sqs.Queue(this, 'ProductCreationQueue', {
      queueName: 'ProductCreationQueue',
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });
  }
}
