import { SQSEvent, SQSRecord, Context, Callback } from 'aws-lambda';
import { handler, handleRecord } from '../../product-service/lib/catalogBatchProcess';
import { getValidNewProduct } from '../../utils/validators';
import { createProduct } from '../../utils/productSaver';
import { snsClient } from '../../utils/clients';

// Mock dependencies
jest.mock('../../utils/validators');
jest.mock('../../utils/productSaver');
jest.mock('../../utils/clients');

describe('catalogBatchProcess', () => {
  const mockProduct = {
    id: '1',
    title: 'Test Product',
    price: '100',
  };

  const mockSQSRecord: SQSRecord = {
    body: JSON.stringify(mockProduct),
    messageId: '1',
    receiptHandle: 'handle',
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: '1',
    },
    messageAttributes: {},
    md5OfBody: 'md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs',
    awsRegion: 'us-east-1',
  };

  // Create mock context and callback
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:test',
    memoryLimitInMB: '128',
    awsRequestId: '123',
    logGroupName: 'test-group',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  const mockCallback: Callback = () => {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRecord', () => {
    it('should process a valid record successfully', async () => {
      (getValidNewProduct as jest.Mock).mockReturnValue(mockProduct);
      (createProduct as jest.Mock).mockResolvedValue(mockProduct);

      const result = await handleRecord(mockSQSRecord);

      expect(getValidNewProduct).toHaveBeenCalledWith(mockProduct);
      expect(createProduct).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });

    it('should throw error when record processing fails', async () => {
      const error = new Error('Validation failed');
      (getValidNewProduct as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(handleRecord(mockSQSRecord)).rejects.toThrow(error);
    });
  });

  describe('handler', () => {
    const mockEvent: SQSEvent = {
      Records: [mockSQSRecord],
    };

    it('should handle successful product creation', async () => {
      (getValidNewProduct as jest.Mock).mockReturnValue(mockProduct);
      (createProduct as jest.Mock).mockResolvedValue(mockProduct);
      (snsClient.send as jest.Mock).mockResolvedValue({});

      await handler(mockEvent, mockContext, mockCallback);

      expect(snsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TopicArn: process.env.PRODUCT_CREATION_TOPIC_ARN,
            Subject: 'Product creation report',
            MessageAttributes: {
              status: {
                DataType: 'String',
                StringValue: 'success',
              },
            },
          }),
        }),
      );
    });

    it('should handle failed product creation', async () => {
      const error = new Error('Creation failed');
      (getValidNewProduct as jest.Mock).mockImplementation(() => {
        throw error;
      });
      (snsClient.send as jest.Mock).mockResolvedValue({});

      await handler(mockEvent, mockContext, mockCallback);

      expect(snsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MessageAttributes: {
              status: {
                DataType: 'String',
                StringValue: 'error',
              },
            },
          }),
        }),
      );
    });

    it('should handle partial success', async () => {
      const mockEvent: SQSEvent = {
        Records: [mockSQSRecord, { ...mockSQSRecord, messageId: '2' }],
      };

      (getValidNewProduct as jest.Mock).mockReturnValueOnce(mockProduct).mockImplementationOnce(() => {
        throw new Error('Second record failed');
      });
      (createProduct as jest.Mock).mockResolvedValue(mockProduct);
      (snsClient.send as jest.Mock).mockResolvedValue({});

      await handler(mockEvent, mockContext, mockCallback);

      expect(snsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MessageAttributes: {
              status: {
                DataType: 'String',
                StringValue: 'partial',
              },
            },
          }),
        }),
      );
    });

    it('should handle SNS publishing error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const snsError = new Error('SNS publish failed');

      (getValidNewProduct as jest.Mock).mockReturnValue(mockProduct);
      (createProduct as jest.Mock).mockResolvedValue(mockProduct);
      (snsClient.send as jest.Mock).mockRejectedValue(snsError);

      await handler(mockEvent, mockContext, mockCallback);

      expect(consoleSpy).toHaveBeenCalledWith('Error publishing message to SNS:', snsError);
      consoleSpy.mockRestore();
    });
  });
});
