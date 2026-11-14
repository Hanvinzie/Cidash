import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto, RegisterDto, TopUpDto, UpdateStatusDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimit } from '../common/guards/rate-limit.guard';

const COOKIE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSecureAuthCookie(res: Response | undefined, token: string) {
    if (!res?.cookie) return;
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('cidash_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }

  @RateLimit(10, 60_000)
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setSecureAuthCookie(res, result.accessToken);
    return result;
  }

  @RateLimit(12, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setSecureAuthCookie(res, result.accessToken);
    return result;
  }

  @RateLimit(60, 60_000)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @RateLimit(15, 60_000)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('top-up')
  async topUp(
    @CurrentUser('id') userId: string,
    @Body() topUpDto: TopUpDto,
  ) {
    return this.authService.topUpCoins(userId, topUpDto.coins);
  }

  @RateLimit(15, 60_000)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('buy-shield')
  async buyShield(@CurrentUser('id') userId: string) {
    return this.authService.buyShieldTicket(userId);
  }

  @RateLimit(15, 60_000)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('status')
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.authService.updateAvailabilityStatus(
      userId,
      updateStatusDto.status,
    );
  }
}
