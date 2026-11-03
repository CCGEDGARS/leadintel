import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';

function fixture(t){
 const DB=storageDb();t.after(()=>DB.raw.close());
 DB.raw.exec('CREATE TABLE fixture_batch_rows (id TEXT PRIMARY KEY)');
 const insert=id=>DB.prepare('INSERT INTO fixture_batch_rows(id) VALUES(?)').bind(id);
 return {DB,insert,ids:()=>DB.raw.prepare('SELECT id FROM fixture_batch_rows ORDER BY rowid').all().map(row=>row.id)};
}

test('concurrent fixture batches settle independently as atomic D1 transactions',async t=>{
 const {DB,insert,ids}=fixture(t);
 const outcomes=await Promise.allSettled([
  DB.batch([insert('first-a'),insert('first-b')]),
  DB.batch([insert('second-a'),insert('second-b')])
 ]);
 assert.deepEqual(outcomes.map(result=>result.status),['fulfilled','fulfilled']);
 assert.deepEqual(ids(),['first-a','first-b','second-a','second-b']);
 assert.ok(outcomes.every(result=>result.value.every(statement=>statement.meta.changes===1)));
});

test('a rolled-back fixture batch does not discard or poison the next concurrent batch',async t=>{
 const {DB,insert,ids}=fixture(t);await insert('existing').run();
 const outcomes=await Promise.allSettled([
  DB.batch([insert('must-roll-back'),insert('existing')]),
  DB.batch([insert('survives-a'),insert('survives-b')])
 ]);
 assert.equal(outcomes[0].status,'rejected');
 assert.match(outcomes[0].reason.message,/UNIQUE constraint failed/);
 assert.equal(outcomes[1].status,'fulfilled');
 assert.deepEqual(ids(),['existing','survives-a','survives-b']);
});
