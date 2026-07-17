const { Client } = require('pg');
const client = new Client({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'root',
  database: 'flow_db',
  port: 5432
});

client.connect().then(async () => {
  // 1. Get all tasks in Sprint 4 (sprint_id = 36)
  const taskRes = await client.query("SELECT id, title, status FROM tasks WHERE sprint_id = '36'");
  const tasks = taskRes.rows;
  console.log(`Found ${tasks.length} tasks in Sprint 4.`);

  for (const task of tasks) {
    // 2. Query task histories for status changes of this task
    const historyRes = await client.query(`
      SELECT from_value, to_value, created_at 
      FROM task_histories 
      WHERE task_id = $1 AND change_type = 'STATUS_CHANGE'
      ORDER BY created_at DESC
    `, [String(task.id)]);
    
    // Find the latest status change where the target status was not 'Overdue'
    const originalStatusChange = historyRes.rows.find(h => h.to_value !== 'Overdue');
    if (originalStatusChange) {
      const origStatus = originalStatusChange.to_value;
      console.log(`Restoring task [${task.title}] (ID: ${task.id}) to historical status: ${origStatus}`);
      await client.query("UPDATE tasks SET status = $1 WHERE id = $2", [origStatus, task.id]);
    } else {
      // If no history exists, default to 'To Do'
      console.log(`No history for task [${task.title}] (ID: ${task.id}), defaulting to 'To Do'`);
      await client.query("UPDATE tasks SET status = 'To Do' WHERE id = $2", [task.id]);
    }
  }

  console.log("Restoration completed successfully!");
  await client.end();
}).catch(console.error);
