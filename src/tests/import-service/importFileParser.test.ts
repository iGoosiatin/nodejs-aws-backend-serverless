import { S3Event, S3EventRecord } from 'aws-lambda';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { handler } from '../../import-service/lib/importFileParser';
import { s3Client, sqsClient } from '../../utils/clients';
import { environment } from '../../utils/environment';

// Mocks
jest.mock('../../utils/clients', () => {
  return {
    s3Client: {
      send: jest.fn(),
    },
    sqsClient: {
      send: jest.fn(),
    },
  };
});

const { IMPORT_BUCKET, UPLOAD_DIR, PARSED_DIR } = environment;

const FILE = 'test.csv';

describe('importFileParser handler', () => {
  const mockS3Event: S3Event = {
    Records: [
      {
        s3: {
          bucket: { name: IMPORT_BUCKET },
          object: { key: `${UPLOAD_DIR}/${FILE}` },
        },
      } as S3EventRecord,
    ],
  };

  const mockProduct = {
    title: 'Test Product',
    description: 'Test Description',
    price: '100',
  };

  // Updated createReadStream function to properly simulate CSV data
  const createReadStream = (data: Record<string, unknown>[]) => {
    // Create CSV header
    const headers = Object.keys(data[0]).join(',') + '\n';
    // Create CSV rows
    const rows = data.map(item => Object.values(item).join(',')).join('\n');
    // Combine header and rows
    const csvContent = headers + rows;

    return new Readable({
      read() {
        this.push(Buffer.from(csvContent));
        this.push(null);
      },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock S3 client responses with proper CSV stream
    (s3Client.send as jest.Mock).mockImplementation(async command => {
      if (command instanceof GetObjectCommand) {
        const stream = createReadStream([mockProduct]);
        return {
          Body: stream,
        };
      }
      return {};
    });

    // Mock logger
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  it('should process CSV file successfully', async () => {
    await handler(mockS3Event);

    expect(sqsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { QueueUrl: process.env.PRODUCT_CREATION_QUEUE_URL, MessageBody: JSON.stringify(mockProduct) },
      }),
    );

    // Verify S3 operations
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    expect(s3Client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: IMPORT_BUCKET,
          CopySource: `${IMPORT_BUCKET}/${UPLOAD_DIR}/${FILE}`,
          Key: `${PARSED_DIR}/${FILE}`,
        },
      }),
    );
    expect(s3Client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: IMPORT_BUCKET,
          Key: `${UPLOAD_DIR}/${FILE}`,
        },
      }),
    );
  });

  it('should handle S3 read errors', async () => {
    (s3Client.send as jest.Mock).mockRejectedValueOnce(new Error('S3 read error'));

    await expect(handler(mockS3Event)).rejects.toThrow('S3 read error');
  });

  it('should handle file move errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (s3Client.send as jest.Mock)
      .mockResolvedValueOnce({ Body: createReadStream([mockProduct]) })
      .mockRejectedValueOnce(new Error('File move error'));

    await handler(mockS3Event);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error moving file:', expect.any(Error));
  });
});
