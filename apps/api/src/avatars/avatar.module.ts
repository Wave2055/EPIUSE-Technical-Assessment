import { Module } from '@nestjs/common';
import { AvatarService } from './avatar.service.js';

@Module({ providers: [AvatarService], exports: [AvatarService] })
export class AvatarModule {}
