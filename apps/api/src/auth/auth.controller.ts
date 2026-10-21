import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AccessTokenResponseSchema,
  ChangePasswordSchema,
  LoginSchema,
  type AccessTokenResponse,
  type ChangePasswordInput,
  type LoginInput,
} from '@epiuse/shared';
import type { CookieOptions, Request, Response } from 'express';
import { AllowDuringPasswordChange } from '../common/decorators/allow-during-password-change.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../common/request-user.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { LOGIN_RATE_LIMIT } from '../common/throttling/rate-limits.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { AppConfig } from '../config/app-config.js';
import { AuthService, type IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: LOGIN_RATE_LIMIT })
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
  @Public()
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
  @Public()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  /**
   * Signed in, and allowed while a one-time password is still in force: this is how it is
   * replaced (ADR-0036). Rate-limited like sign-in, since it checks a password.
   */
  @Post('password')
  @AllowDuringPasswordChange()
  @HttpCode(200)
  @Throttle({ default: LOGIN_RATE_LIMIT })
  @ApiBearerAuth()
  @ApiBody({ schema: openApi(ChangePasswordSchema, 'input') })
  @ApiOkResponse({ schema: openApi(AccessTokenResponseSchema) })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    return this.respond(res, await this.auth.changePassword(user.id, body));
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
