import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import XLSX from 'xlsx';

const excelPath = process.argv[2] || '/home/ubuntu/upload/StrengthLevel.xlsx';

async function importExcelData() {
  try {
    // Read Excel file
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Loaded ${data.length} athletes from Excel`);

    // Connect to database
    const connection = await createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'manus',
    });

    // Parse connection string if DATABASE_URL is provided
    let dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'manus',
    };

    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      dbConfig = {
        host: url.hostname,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
      };
    }

    const conn = await createConnection(dbConfig);

    // Insert athletes
    for (const row of data) {
      const name = row.Name?.trim();
      if (!name) continue;

      const bodyWeight = row.Bw ? parseFloat(row.Bw) : null;
      const squat = row.Squat ? parseFloat(row.Squat) : null;
      const bench = row.Bench ? parseFloat(row.Bench) : null;
      const deadlift = row.Deadlift ? parseFloat(row.Deadlift) : null;
      
      // Calculate total from main lifts
      let total = null;
      if (squat && bench && deadlift) {
        total = squat + bench + deadlift;
      }

      const ohp = row.OHP ? parseFloat(row.OHP) : null;
      const inclineBench = row['Incline Bench'] ? parseFloat(row['Incline Bench']) : null;
      const rdl = row.RDL ? parseFloat(row.RDL) : null;
      const revBandBench = row['Rev Band Bench'] ? parseFloat(row['Rev Band Bench']) : null;
      const revBandSquat = row['Rev Band Squat'] ? parseFloat(row['Rev Band Squat']) : null;
      const revBandDl = row['Rev Band DL'] ? parseFloat(row['Rev Band DL']) : null;
      const slingshotBench = row['Slingshot Bench'] ? parseFloat(row['Slingshot Bench']) : null;

      try {
        await conn.execute(
          `INSERT INTO athletes (name, bodyWeight, squat, bench, deadlift, total, ohp, inclineBench, rdl, revBandBench, revBandSquat, revBandDl, slingshotBench)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           bodyWeight = VALUES(bodyWeight),
           squat = VALUES(squat),
           bench = VALUES(bench),
           deadlift = VALUES(deadlift),
           total = VALUES(total),
           ohp = VALUES(ohp),
           inclineBench = VALUES(inclineBench),
           rdl = VALUES(rdl),
           revBandBench = VALUES(revBandBench),
           revBandSquat = VALUES(revBandSquat),
           revBandDl = VALUES(revBandDl),
           slingshotBench = VALUES(slingshotBench)`,
          [name, bodyWeight, squat, bench, deadlift, total, ohp, inclineBench, rdl, revBandBench, revBandSquat, revBandDl, slingshotBench]
        );
        console.log(`✓ Imported: ${name}`);
      } catch (error) {
        console.error(`✗ Failed to import ${name}:`, error.message);
      }
    }

    await conn.end();
    console.log('\n✓ Import complete!');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importExcelData();
