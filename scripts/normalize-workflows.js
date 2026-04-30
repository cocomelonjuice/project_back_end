/* eslint-disable no-console */
require('dotenv').config();
const { Client } = require('pg');

async function normalizeWorkflows() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const deactivateGlobal = await client.query(
      'UPDATE workflows SET "isActive" = false WHERE "projectId" IS NULL AND "isActive" = true'
    );

    const duplicatedProjects = await client.query(`
      SELECT "projectId"
      FROM workflows
      WHERE "projectId" IS NOT NULL AND "isActive" = true
      GROUP BY "projectId"
      HAVING COUNT(*) > 1
    `);

    let deactivatedDuplicateCount = 0;
    for (const row of duplicatedProjects.rows) {
      const projectId = row.projectId;
      const keep = await client.query(
        `SELECT id
         FROM workflows
         WHERE "projectId" = $1 AND "isActive" = true
         ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC, id DESC
         LIMIT 1`,
        [projectId]
      );

      if (!keep.rows.length) continue;

      const keepId = keep.rows[0].id;
      const deactivated = await client.query(
        `UPDATE workflows
         SET "isActive" = false
         WHERE "projectId" = $1 AND id <> $2 AND "isActive" = true`,
        [projectId, keepId]
      );
      deactivatedDuplicateCount += deactivated.rowCount || 0;
    }

    await client.query('COMMIT');

    console.log('Workflow normalization completed');
    console.log(`- Deactivated active global workflows: ${deactivateGlobal.rowCount || 0}`);
    console.log(`- Deactivated duplicate active workflows on same project: ${deactivatedDuplicateCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Workflow normalization failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

normalizeWorkflows();
