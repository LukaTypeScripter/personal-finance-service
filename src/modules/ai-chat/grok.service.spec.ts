import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GrokService } from './grok.service';

function makeService(config: Record<string, string>, httpPost: jest.Mock) {
  return Test.createTestingModule({
    providers: [
      GrokService,
      { provide: HttpService, useValue: { post: httpPost } },
      { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
    ],
  })
    .compile()
    .then((m) => m.get(GrokService));
}

describe('GrokService', () => {
  const baseConfig = {
    XAI_API_KEY: 'test-key',
    XAI_MODEL: 'grok-4',
    XAI_BASE_URL: 'https://api.x.ai/v1',
  };

  it('returns assistant content on success', async () => {
    const post = jest.fn().mockReturnValue(
      of({ data: { choices: [{ message: { content: 'Hello!' } }] } }),
    );
    const svc = await makeService(baseConfig, post);
    const result = await svc.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('Hello!');
    expect(post).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({ model: 'grok-4', stream: false }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('throws ServiceUnavailable when API key is missing', async () => {
    const post = jest.fn();
    const svc = await makeService({ ...baseConfig, XAI_API_KEY: '' }, post);
    await expect(
      svc.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });

  it('throws when response has no choices', async () => {
    const post = jest.fn().mockReturnValue(of({ data: { choices: [] } }));
    const svc = await makeService(baseConfig, post);
    await expect(
      svc.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps upstream errors to ServiceUnavailable', async () => {
    const post = jest.fn().mockReturnValue(
      throwError(() => ({ message: 'timeout', response: { status: 429 } })),
    );
    const svc = await makeService(baseConfig, post);
    await expect(
      svc.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('falls back to default model and base url when unset', async () => {
    const post = jest.fn().mockReturnValue(
      of({ data: { choices: [{ message: { content: 'ok' } }] } }),
    );
    const svc = await makeService({ XAI_API_KEY: 'k' }, post);
    await svc.chat([{ role: 'user', content: 'hi' }]);
    expect(post).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({ model: 'grok-4' }),
      expect.anything(),
    );
  });
});
