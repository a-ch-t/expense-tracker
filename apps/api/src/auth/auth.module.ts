import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../common/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [AuthCoreModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
