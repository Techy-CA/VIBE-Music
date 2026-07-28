import { getAdminDb } from '../api/_lib/firebaseAdmin.ts';
import { isCompilationTitle } from '../api/_lib/titleFilters.ts';

const BATCH_LIMIT = 400;

async function main() {
  const db = getAdminDb();

  console.log('Scanning library for compilation-style titles...');
  const snap = await db.collection('songs').select('title').get();

  const toDelete = snap.docs.filter(d => isCompilationTitle(d.data().title as string));
  console.log(`Found ${toDelete.length} of ${snap.size} songs to remove:`);
  toDelete.slice(0, 30).forEach(d => console.log('  -', d.data().title));
  if (toDelete.length > 30) console.log(`  ...and ${toDelete.length - 30} more`);

  if (toDelete.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  let batch = db.batch();
  let opsInBatch = 0;
  let deleted = 0;

  for (const doc of toDelete) {
    batch.delete(doc.ref);
    opsInBatch++;
    deleted++;
    if (opsInBatch === BATCH_LIMIT) {
      await batch.commit();
      console.log(`  deleted ${deleted}/${toDelete.length} so far...`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log(`\nDone. Deleted ${deleted} compilation-titled songs.`);
}

main().catch(err => { console.error(err); process.exit(1); });
