import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto, RegisterDto, TopUpDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimit } from '../common/guards/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @RateLimit(10, 60_000)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @RateLimit(12, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

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
}
