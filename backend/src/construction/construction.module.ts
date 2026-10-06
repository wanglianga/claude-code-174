import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { ConstructionController } from './construction.controller';
import { ConstructionService } from './construction.service';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [ConstructionController],
  providers: [ConstructionService],
})
export class ConstructionModule {}
