import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MeSchema, type Me } from '@epiuse/shared';
import { AllowDuringPasswordChange } from '../common/decorators/allow-during-password-change.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../common/request-user.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { MeService } from './me.service.js';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Everything the home screen needs about the signed-in person. */
  @Get()
  @AllowDuringPasswordChange()
  @ApiOkResponse({ schema: openApi(MeSchema) })
  get(@CurrentUser() user: RequestUser): Promise<Me> {
    return this.me.get(user);
  }
}
