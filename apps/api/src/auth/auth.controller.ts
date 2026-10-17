import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AccessTokenResponseSchema,
  LoginSchema,
  type AccessTokenResponse,
  type LoginInput,
} from '@epiuse/shared';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { AppConfig } from '../config/app-config.js';
import { AuthService, type IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiBody({ schema: openApi(LoginSchema, 'input') })
  @ApiOkResponse({ schema: openApi(AccessTokenResponseSchema) })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    return this.respond(res, await this.auth.login(body));
  }

  /** Rotates the refresh cookie and returns a fresh access token. */
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApi(AccessTokenResponseSchema) })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    try {
      return this.respond(res, await this.auth.refresh(readCookie(req)));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private respond(res: Response, session: IssuedSession): AccessTokenResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshExpiresAt,
    });
    const { accessToken, expiresIn, user } = session;
    return { accessToken, expiresIn, user };
  }

  /** Scoped to the auth routes, so the cookie never rides along on ordinary API calls. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/api/auth',
    };
  }
}

function readCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}
