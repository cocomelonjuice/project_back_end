import { DataSource } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

/**
 * Seed script to create default roles and assign admin role to first user
 * Run this with: npm run seed:roles
 * Or import and call in your app initialization
 */
export async function seedRoles(dataSource: DataSource) {
  const roleRepository = dataSource.getRepository(Role);
  const userRepository = dataSource.getRepository(User);

  console.log('🌱 Starting role seeding...');

  // Define default roles with permissions
  const defaultRoles = [
    {
      name: 'admin',
      description: 'Administrator with full system access',
      permissions: [
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'roles:create',
        'roles:read',
        'roles:update',
        'roles:delete',
        'projects:create',
        'projects:read',
        'projects:update',
        'projects:delete',
        'issues:create',
        'issues:read',
        'issues:update',
        'issues:delete',
        'workflows:create',
        'workflows:read',
        'workflows:update',
        'workflows:delete',
      ],
    },
    {
      name: 'user',
      description: 'Regular user with basic permissions',
      permissions: [
        'projects:read',
        'issues:create',
        'issues:read',
        'issues:update',
        'comments:create',
        'comments:read',
        'attachments:create',
        'attachments:read',
      ],
    },
    {
      name: 'viewer',
      description: 'Read-only user',
      permissions: [
        'projects:read',
        'issues:read',
        'comments:read',
        'attachments:read',
      ],
    },
  ];

  // Create or update roles
  for (const roleData of defaultRoles) {
    let role = await roleRepository.findOne({ where: { name: roleData.name } });

    if (role) {
      console.log(`✅ Role "${roleData.name}" already exists, updating...`);
      role.description = roleData.description;
      role.permissions = roleData.permissions;
      await roleRepository.save(role);
    } else {
      console.log(`➕ Creating role "${roleData.name}"...`);
      role = roleRepository.create(roleData);
      await roleRepository.save(role);
    }
  }

  // Assign admin role to first user OR user with username "admin" (if exists and doesn't have admin role)
  let targetUser = await userRepository.findOne({
    where: { username: 'admin' },
    relations: ['roles'],
  });

  // If no user with username "admin", assign to first user
  if (!targetUser) {
    targetUser = await userRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
      relations: ['roles'],
    });
  }

  if (targetUser) {
    const adminRole = await roleRepository.findOne({ where: { name: 'admin' } });
    if (adminRole) {
      const hasAdminRole = targetUser.roles?.some((r) => r.name === 'admin');
      if (!hasAdminRole) {
        console.log(`👤 Assigning admin role to user: ${targetUser.username}...`);
        if (!targetUser.roles) {
          targetUser.roles = [];
        }
        targetUser.roles.push(adminRole);
        await userRepository.save(targetUser);
        console.log(`✅ Admin role assigned to ${targetUser.username}`);
      } else {
        console.log(`ℹ️  User ${targetUser.username} already has admin role`);
      }
    }
  } else {
    console.log('ℹ️  No users found. Admin role will be assigned to the first registered user.');
  }

  console.log('✨ Role seeding completed!');
}

// If running directly (not imported)
if (require.main === module) {
  // This would need to be called from your app initialization
  console.log('Please import and call seedRoles() from your app initialization');
}

