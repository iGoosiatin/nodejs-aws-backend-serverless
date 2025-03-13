if (!process.env.PRODUCTS_TABLE) {
  throw new Error('No PRODUCTS_TABLE environment variable found');
}

if (!process.env.STOCKS_TABLE) {
  throw new Error('No STOCKS_TABLE environment variable found');
}

if (!process.env.UPLOAD_DIR) {
  throw new Error('No UPLOAD_DIR environment variable found');
}

if (!process.env.PARSED_DIR) {
  throw new Error('No PARSED_DIR environment variable found');
}

if (!process.env.IMPORT_BUCKET) {
  throw new Error('No IMPORT_BUCKET environment variable found');
}

export const environment = {
  PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
  STOCKS_TABLE: process.env.STOCKS_TABLE,
  IMPORT_BUCKET: process.env.IMPORT_BUCKET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  PARSED_DIR: process.env.PARSED_DIR,
} as const;
