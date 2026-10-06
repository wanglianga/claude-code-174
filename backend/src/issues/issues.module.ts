import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
