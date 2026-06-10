import { DataSource } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

/**
 * Script to manually assign admin role to a specific user
 * Usage: Call assignAdminRoleToUser(dataSource, 'username') or assignAdminRoleToUser(dataSource, null, 'email@example.com')
 */
export async function assignAdminRoleToUser(
  dataSource: DataSource,
  username?: string,
  email?: string,
) {
  const roleRepository = dataSource.getRepository(Role);
  const userRepository = dataSource.getRepository(User);

  if (!username && !email) {
    throw new Error('Either username or email must be provided');
  }

  // Find user
  let user: User | null = null;
  if (username) {
    user = await userRepository.findOne({
      where: { username },
      relations: ['roles'],
    });
  } else if (email) {
    user = await userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  if (!user) {
    throw new Error(`User not found: ${username || email}`);
  }

  // Find admin role
  const adminRole = await roleRepository.findOne({ where: { name: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin role not found. Please run seed script first.');
  }

  // Check if user already has admin role
  const hasAdminRole = user.roles?.some((r) => r.name === 'admin');
  if (hasAdminRole) {
    console.log(`✅ User ${user.username} already has admin role`);
    return user;
  }

  // Assign admin role
  console.log(`👤 Assigning admin role to user: ${user.username}...`);
  if (!user.roles) {
    user.roles = [];
  }
  user.roles.push(adminRole);
  await userRepository.save(user);
  console.log(`✅ Admin role assigned to ${user.username}`);

  return user;
}
