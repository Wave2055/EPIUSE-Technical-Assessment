import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HierarchyResponseSchema, type HierarchyResponse } from '@epiuse/shared';
import { openApi } from '../common/swagger/zod-schema.js';
import { HierarchyService } from './hierarchy.service.js';

@ApiTags('Hierarchy')
@ApiBearerAuth()
@Controller('hierarchy')
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  /** Every employee as an org chart node; the client lays out the tree. */
  @Get()
  @ApiOkResponse({ schema: openApi(HierarchyResponseSchema) })
  getChart(): Promise<HierarchyResponse> {
    return this.hierarchy.getChart();
  }
}
