import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeService } from './me.service';

@Module({ controllers: [AuthController], providers: [AuthService, MeService], exports: [AuthService] })
export class AuthModule {}
