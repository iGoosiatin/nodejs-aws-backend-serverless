import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

import { environment } from '../../src/utils/environment';

const { PRODUCT_CREATION_NOTIF_EMAIL, PRODUCT_CREATION_NOTIF_ADMIN_EMAIL } = environment;

export class SnsStack extends cdk.Stack {
  public readonly productCreationTopic: sns.Topic;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.productCreationTopic = new sns.Topic(this, 'createProductTopic', {
      topicName: 'createProductTopic',
      displayName: 'Product Creation Notifications',
    });

    this.productCreationTopic.addSubscription(new subscriptions.EmailSubscription(PRODUCT_CREATION_NOTIF_EMAIL));

    this.productCreationTopic.addSubscription(
      new subscriptions.EmailSubscription(PRODUCT_CREATION_NOTIF_ADMIN_EMAIL, {
        filterPolicy: {
          status: sns.SubscriptionFilter.stringFilter({
            allowlist: ['partial', 'error'],
          }),
        },
      }),
    );
  }
}
