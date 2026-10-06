import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { HousesController } from './houses.controller';
import { HousesService } from './houses.service';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [HousesController],
  providers: [HousesService],
  exports: [HousesService, TypeOrmModule],
})
export class HousesModule {}
