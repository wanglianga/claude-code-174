import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './auth/auth.module';
import { HousesModule } from './houses/houses.module';
import { WorkflowModule } from './workflow/workflow.module';
import { SubsidyModule } from './subsidy/subsidy.module';
import { ConstructionModule } from './construction/construction.module';
import { IssuesModule } from './issues/issues.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'rural',
        password: process.env.DB_PASSWORD || 'rural123',
        database: process.env.DB_NAME || 'rural_safety',
        entities: ALL_ENTITIES,
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    AuthModule,
    HousesModule,
    WorkflowModule,
    SubsidyModule,
    ConstructionModule,
    IssuesModule,
    DashboardModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
