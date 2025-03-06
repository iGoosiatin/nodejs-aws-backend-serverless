import { APIGatewayProxyEvent } from 'aws-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../../import-service/lib/importProductsFile';
import { environment } from '../../utils/environment';
import { s3Client } from '../../utils/clients';

const MOCK_UUID = 'uuid';
const FILE = 'file.csv';
const [fileName, fileExtension] = FILE.split('.');

jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('crypto', () => ({
  randomUUID: () => MOCK_UUID,
}));
jest.mock('../../utils/clients', () => ({
  s3Client: {},
}));

const basicMockEvent = {
  httpMethod: 'GET',
  path: '/import',
  headers: {},
  queryStringParameters: null,
  pathParameters: null,
  body: null,
} as APIGatewayProxyEvent;

const mockSignedUrl = 'https://mock-signed-url.com';

describe('importProductsFile handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);
  });

  it('should generate signed URL for valid CSV file', async () => {
    const event = {
      ...basicMockEvent,
      queryStringParameters: {
        name: FILE,
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toBe(mockSignedUrl);
    expect(getSignedUrl).toHaveBeenCalledWith(
      s3Client,
      expect.objectContaining({
        input: {
          Bucket: environment.IMPORT_BUCKET,
          Key: `${environment.UPLOAD_DIR}/${fileName}-${MOCK_UUID}.${fileExtension}`,
          ContentType: 'text/csv',
        },
      }),
      expect.objectContaining({
        expiresIn: 3600,
      }),
    );
  });

  it('should return 400 when filename is missing', async () => {
    const response = await handler(basicMockEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Invalid file name. Please provide a CSV file.',
    });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('should return 400 when file is not a CSV', async () => {
    const event = {
      ...basicMockEvent,
      queryStringParameters: {
        name: 'test.txt',
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Invalid file name. Please provide a CSV file.',
    });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('should return 500 when signed URL generation fails', async () => {
    const event = {
      ...basicMockEvent,
      queryStringParameters: {
        name: FILE,
      },
    };

    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 Error'));

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Internal server error',
    });
  });
});
