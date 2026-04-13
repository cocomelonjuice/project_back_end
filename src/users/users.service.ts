import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

interface CreateUserInput {
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create(input);
    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['roles'],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: [
        'id',
        'username',
        'email',
        'displayName',
        'passwordHash',
        'isActive',
        'createdAt',
        'updatedAt',
        'passwordResetTokenHash',
        'passwordResetExpires',
      ],
    });
  }

  async findByEmailCaseInsensitive(email: string): Promise<User | null> {
    const trimmed = email.trim();
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:e)', { e: trimmed })
      .getOne();
  }

  async findByPasswordResetTokenHash(
    tokenHash: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { passwordResetTokenHash: tokenHash },
    });
  }

  async setPasswordResetFields(
    userId: string,
    tokenHash: string,
    expires: Date,
  ): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { passwordResetTokenHash: tokenHash, passwordResetExpires: expires },
    );
  }

  async updatePasswordClearReset(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    );
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'displayName', 'passwordHash', 'isActive', 'createdAt', 'updatedAt'],
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User | null> {
    await this.usersRepository.update({ id }, dto);
    return this.findById(id); // This will load relations including roles
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete({ id });
  }
}

