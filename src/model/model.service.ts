import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ModelService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public&pool_timeout=0&connection_limit=5',
        },
      },
    });
  }

  cleanDb() {
    return this.$transaction([
      this.restaurant.deleteMany(),
      this.user.deleteMany(),
    ]);
  }
}
