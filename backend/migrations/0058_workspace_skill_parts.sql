-- Stable child checkpoints let large legacy sections be split without discarding
-- completed methods or changing the meaning of their existing chunk indices.
CREATE TABLE workspace_skill_parts (
 skill_id TEXT NOT NULL REFERENCES workspace_skills(id),
 chunk_index INTEGER NOT NULL,
 part_index INTEGER NOT NULL,
 object_key TEXT NOT NULL,
 PRIMARY KEY(skill_id,chunk_index,part_index)
);

-- One-time recovery under the new bounded-request strategy. Other failure
-- categories still require the owner's explicit retry after correcting the cause.
UPDATE workspace_skills SET status='Processing',retry_attempts=0,error='',
 error_code='',error_phase='',next_at=0,lease_id='',lease_until=0,revision=revision+1
 WHERE status='Failed' AND error_code='AI_TIMEOUT' AND input_key<>'';
