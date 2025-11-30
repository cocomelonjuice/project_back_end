import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: User) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private async ensureUniqueUser(dto: RegisterDto) {
    const [existingUsername, existingEmail] = await Promise.all([
      this.usersService.findByUsername(dto.username),
      this.usersService.findByEmail(dto.email),
    ]);

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }
  }

  async register(dto: RegisterDto) {
    await this.ensureUniqueUser(dto);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
      isActive: true,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken: this.generateToken(user),
    };
  }

  private async validateUser(identifier: string, password: string) {
    const lookup =
      identifier.includes('@')
        ? this.usersService.findByEmail(identifier)
        : this.usersService.findByUsername(identifier);

    const user = await lookup;

    if (!user) {
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
    return {
      user: this.sanitizeUser(user),
      accessToken: this.generateToken(user),
    };
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, username: user.username };
    return this.jwtService.sign(payload);
  }
}

