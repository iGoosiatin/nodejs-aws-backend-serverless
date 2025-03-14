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

if (!process.env.PRODUCT_CREATION_NOTIF_EMAIL) {
  throw new Error('No PRODUCT_CREATION_NOTIF_EMAIL environment variable found');
}

if (!process.env.PRODUCT_CREATION_NOTIF_ADMIN_EMAIL) {
  throw new Error('No PRODUCT_CREATION_NOTIF_ADMIN_EMAIL environment variable found');
}

export const environment = {
  PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
  STOCKS_TABLE: process.env.STOCKS_TABLE,
  IMPORT_BUCKET: process.env.IMPORT_BUCKET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  PARSED_DIR: process.env.PARSED_DIR,
  PRODUCT_CREATION_NOTIF_EMAIL: process.env.PRODUCT_CREATION_NOTIF_EMAIL,
  PRODUCT_CREATION_NOTIF_ADMIN_EMAIL: process.env.PRODUCT_CREATION_NOTIF_ADMIN_EMAIL,
} as const;
