import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  src: path.resolve(__dirname, '../client'),
  build: path.resolve(__dirname, '../build/public'),
  public: path.resolve(__dirname, '../public'),
};
