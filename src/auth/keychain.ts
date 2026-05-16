import keytar from 'keytar';

const SERVICE_NAME = 'imara-cli';
const ACCOUNT_NAME = 'api-key';

export class Keychain {
  static async save(apiKey: string) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
  }

  static async get(): Promise<string | null> {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  }

  static async delete() {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  }
}
