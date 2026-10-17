import { gravatarUrl } from './gravatar.js';

describe('gravatarUrl', () => {
  it('hashes the trimmed, lower-cased email with SHA-256 and asks for a 404 when missing', () => {
    // sha256("test@example.com")
    expect(gravatarUrl('  Test@Example.com ')).toBe(
      'https://gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?s=160&d=404',
    );
  });
});
