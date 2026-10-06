import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { SubsidyController } from './subsidy.controller';
import { SubsidyService } from './subsidy.service';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [SubsidyController],
  providers: [SubsidyService],
  exports: [SubsidyService],
})
export class SubsidyModule {}
