const {
  decryptAdminKeyFile,
  encryptAdminKeyPayload,
} = require('../../src/utils/adminKeyCrypto');

describe('adminKeyCrypto', () => {
  it('encrypts and decrypts an admin key payload', () => {
    const payload = {
      secret: 'admin-key-secret',
      label: 'Owner',
      keyId: 'admin-owner',
      createdAt: '2026-06-24T00:00:00.000Z',
    };

    const encrypted = encryptAdminKeyPayload(payload, 'super-secure-passphrase');
    const decrypted = decryptAdminKeyFile(encrypted, 'super-secure-passphrase');

    expect(encrypted).toMatchObject({
      version: 1,
      algorithm: 'aes-256-gcm',
      kdf: 'scrypt',
    });
    expect(decrypted).toEqual(payload);
  });

  it('rejects short passphrases', () => {
    expect(() => encryptAdminKeyPayload({ secret: 'x' }, 'short')).toThrow(
      'A passphrase with at least 12 characters is required.',
    );
  });

  it('rejects unsupported file versions', () => {
    expect(() =>
      decryptAdminKeyFile(
        {
          version: 2,
          algorithm: 'aes-256-gcm',
          kdf: 'scrypt',
          salt: 'salt',
          iv: 'iv',
          authTag: 'authTag',
          ciphertext: 'ciphertext',
        },
        'super-secure-passphrase',
      ),
    ).toThrow('Unsupported admin key file version.');
  });

  it('rejects unsupported file formats', () => {
    expect(() =>
      decryptAdminKeyFile(
        {
          version: 1,
          algorithm: 'aes-128-gcm',
          kdf: 'pbkdf2',
          salt: 'salt',
          iv: 'iv',
          authTag: 'authTag',
          ciphertext: 'ciphertext',
        },
        'super-secure-passphrase',
      ),
    ).toThrow('Unsupported admin key file format.');
  });
});
