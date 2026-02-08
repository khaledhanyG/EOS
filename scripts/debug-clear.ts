
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL is not defined in environment.");
    process.exit(1);
}

const sql = neon(connectionString);

async function checkAndClear() {
    try {
        console.log('Checking row counts...');
        const beforeCount = await sql('SELECT COUNT(*) FROM employees');
        console.log(`Employees count BEFORE: ${beforeCount[0].count}`);

        if (Number(beforeCount[0].count) > 0) {
            console.log('Deleting...');
            await sql('DELETE FROM employees');

            const afterCount = await sql('SELECT COUNT(*) FROM employees');
            console.log(`Employees count AFTER: ${afterCount[0].count}`);
        } else {
            console.log('Table was already empty.');
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAndClear();
