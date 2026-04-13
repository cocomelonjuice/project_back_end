import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private sanitizeUser(user: User) {
    const {
      passwordHash: _ph,
      passwordResetTokenHash: _rt,
      passwordResetExpires: _re,
      ...safe
    } = user;
    return safe;
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private getPasswordResetTtlMs(): number {
    const raw = this.configService.get<string>('PASSWORD_RESET_EXPIRES_MS');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 3_600_000;
  }

  private async ensureUniqueUser(dto: RegisterDto) {
    const [existingUsername, existingEmail] = await Promise.all([
      this.usersService.findByUsername(dto.username),
      this.usersService.findByEmailCaseInsensitive(dto.email),
    ]);

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }
  }

  async register(dto: RegisterDto) {
    const normalized: RegisterDto = {
      ...dto,
      username: dto.username.trim(),
      email: dto.email.trim().toLowerCase(),
      displayName: dto.displayName.trim(),
    };
    await this.ensureUniqueUser(normalized);
    const passwordHash = await bcrypt.hash(normalized.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      username: normalized.username,
      email: normalized.email,
      displayName: normalized.displayName,
      passwordHash,
      isActive: true,
    });

    const userWithRoles = await this.usersService.findById(user.id);
    const effective = userWithRoles || user;

    void this.mailService.sendTransactional({
      to: effective.email,
      subject: 'Welcome',
      html: `<p>Hi ${effective.displayName},</p><p>Your account has been created. You can sign in anytime.</p>`,
    });

    return {
      user: this.sanitizeUser(effective),
      accessToken: this.generateToken(effective),
    };
  }

  private async validateUser(identifier: string, password: string) {
    const lookup = identifier.includes('@')
      ? this.usersService.findByEmailCaseInsensitive(identifier)
      : this.usersService.findByUsername(identifier.trim());

    const user = await lookup;

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);
    const userWithRoles = await this.usersService.findById(user.id);
    return {
      user: this.sanitizeUser(userWithRoles || user),
      accessToken: this.generateToken(userWithRoles || user),
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const generic = {
      message:
        'If an account exists for this email, you will receive password reset instructions shortly.',
    };

    const user = await this.usersService.findByEmailCaseInsensitive(email);
    if (!user?.passwordHash) {
      return generic;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expires = new Date(Date.now() + this.getPasswordResetTtlMs());

    await this.usersService.setPasswordResetFields(
      user.id,
      tokenHash,
      expires,
    );

    const base = this.mailService.getFrontendBaseUrl();
    const link = `${base}/reset-password?token=${rawToken}`;

    void this.mailService.sendTransactional({
      to: user.email,
      subject: 'Reset your password',
      html: `<p>Hi ${user.displayName},</p><p><a href="${link}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });

    return generic;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashResetToken(token.trim());
    const user =
      await this.usersService.findByPasswordResetTokenHash(tokenHash);

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersService.updatePasswordClearReset(user.id, passwordHash);

    return { message: 'Password has been reset. You can sign in now.' };
  }

  private generateToken(user: User) {
    const roles = user.roles?.map((role) => role.name) || [];
    const permissions =
      user.roles?.flatMap((role) => role.permissions || []) || [];
    const uniquePermissions = [...new Set(permissions)];

    const payload = {
      sub: user.id,
      username: user.username,
      roles,
      permissions: uniquePermissions,
    };
    return this.jwtService.sign(payload);
  }
}
