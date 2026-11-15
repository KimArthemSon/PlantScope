-- =====================================================================
-- DELETE ALL TREE GROWER USERS EXCEPT THE ONES YOU KEEP
-- (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Deletes every user with user_role = 'treeGrowers' whose id is NOT in
-- the keep list, plus all their related records. Other roles are never
-- touched. Sites are NOT deleted.
--
-- HOW TO USE:
--   1. Edit the keep list on the lines marked  <<< KEEP LIST
--      (it appears in STEP 1 and STEP 2)
--   2. Run STEP 1 (preview) and check the list and counts.
--   3. Run STEP 2 (delete). One transaction: if anything fails,
--      nothing is deleted.
-- =====================================================================


-- =====================================================================
-- STEP 1: PREVIEW (read-only)
-- =====================================================================

-- 1a. Users that WILL BE DELETED
SELECT id, email, user_role, created_at
FROM accounts_user
WHERE user_role = 'treeGrowers'
  AND id <> ALL (ARRAY[84, 83, 74]::bigint[])   -- <<< KEEP LIST
ORDER BY id;

-- 1b. Row counts that will be removed
WITH u AS (
  SELECT id FROM accounts_user
  WHERE user_role = 'treeGrowers'
    AND id <> ALL (ARRAY[84, 83, 74]::bigint[]) -- <<< KEEP LIST
),
apps AS (
  SELECT application_id FROM tree_planting_programs_application
  WHERE user_id IN (SELECT id FROM u)
),
prs AS (
  SELECT progress_report_id FROM tree_planting_programs_progressreport
  WHERE application_id IN (SELECT application_id FROM apps)
     OR submitted_by_id IN (SELECT id FROM u)
),
srs AS (
  SELECT seedling_request_id FROM tree_planting_programs_seedlingrequest
  WHERE application_id IN (SELECT application_id FROM apps)
     OR created_by_id IN (SELECT id FROM u)
)
SELECT 'users'                    AS item, COUNT(*) FROM u
UNION ALL SELECT 'profiles',                 COUNT(*) FROM accounts_profile WHERE users_id IN (SELECT id FROM u)
UNION ALL SELECT 'tree grower groups',       COUNT(*) FROM accounts_treegrowergroup WHERE users_id IN (SELECT id FROM u)
UNION ALL SELECT 'applications',             COUNT(*) FROM apps
UNION ALL SELECT 'seedling requests',        COUNT(*) FROM srs
UNION ALL SELECT 'seedling request species', COUNT(*) FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id IN (SELECT seedling_request_id FROM srs)
UNION ALL SELECT 'progress reports',         COUNT(*) FROM prs
UNION ALL SELECT 'progress report species',  COUNT(*) FROM tree_planting_programs_progressreportspecies WHERE progress_report_id IN (SELECT progress_report_id FROM prs)
UNION ALL SELECT 'reasons',                  COUNT(*) FROM tree_planting_programs_reason WHERE application_id IN (SELECT application_id FROM apps) OR user_id IN (SELECT id FROM u)
UNION ALL SELECT 'closure requests',         COUNT(*) FROM tree_planting_programs_programclosurerequest WHERE application_id IN (SELECT application_id FROM apps)
UNION ALL SELECT 'notifications',            COUNT(*) FROM accounts_notification WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'password reset codes',     COUNT(*) FROM accounts_passwordresetcode WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'security logs',            COUNT(*) FROM security_securitylog WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'activity logs (unlinked, kept)', COUNT(*) FROM security_activitylog WHERE performed_by_id IN (SELECT id FROM u);


-- =====================================================================
-- STEP 2: DELETE
-- =====================================================================
DO $$
DECLARE
  v_keep     bigint[] := ARRAY[84, 83, 74];      -- <<< KEEP LIST
  v_user_ids bigint[];
  v_app_ids  int[];
  v_pr_ids   int[];
  v_sr_ids   int[];
BEGIN
  -- Make sure the kept ids really exist as tree growers (catches typos)
  IF (SELECT COUNT(*) FROM accounts_user
      WHERE id = ANY(v_keep) AND user_role = 'treeGrowers') <> array_length(v_keep, 1) THEN
    RAISE EXCEPTION 'Not every id in the keep list % is an existing treeGrowers user. Aborted.', v_keep;
  END IF;

  -- Collect related ids
  SELECT COALESCE(array_agg(id), '{}') INTO v_user_ids
  FROM accounts_user
  WHERE user_role = 'treeGrowers' AND id <> ALL (v_keep);

  IF array_length(v_user_ids, 1) IS NULL THEN
    RAISE NOTICE 'No tree growers to delete.';
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(application_id), '{}') INTO v_app_ids
  FROM tree_planting_programs_application
  WHERE user_id = ANY(v_user_ids);

  SELECT COALESCE(array_agg(progress_report_id), '{}') INTO v_pr_ids
  FROM tree_planting_programs_progressreport
  WHERE application_id = ANY(v_app_ids) OR submitted_by_id = ANY(v_user_ids);

  SELECT COALESCE(array_agg(seedling_request_id), '{}') INTO v_sr_ids
  FROM tree_planting_programs_seedlingrequest
  WHERE application_id = ANY(v_app_ids) OR created_by_id = ANY(v_user_ids);

  -- 1. Progress reports (and their species)
  DELETE FROM tree_planting_programs_progressreportspecies WHERE progress_report_id = ANY(v_pr_ids);
  DELETE FROM tree_planting_programs_progressreport        WHERE progress_report_id = ANY(v_pr_ids);

  -- 2. Seedling requests (and their species)
  DELETE FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id = ANY(v_sr_ids);
  DELETE FROM tree_planting_programs_seedlingrequest        WHERE seedling_request_id = ANY(v_sr_ids);

  -- 3. Reasons and closure requests
  DELETE FROM tree_planting_programs_reason
  WHERE application_id = ANY(v_app_ids) OR user_id = ANY(v_user_ids);
  DELETE FROM tree_planting_programs_programclosurerequest
  WHERE application_id = ANY(v_app_ids);

  -- 4. Their applications (sites stay)
  DELETE FROM tree_planting_programs_application WHERE application_id = ANY(v_app_ids);

  -- 5. Account data
  DELETE FROM accounts_profile           WHERE users_id = ANY(v_user_ids);
  DELETE FROM accounts_treegrowergroup   WHERE users_id = ANY(v_user_ids);
  DELETE FROM accounts_notification      WHERE user_id  = ANY(v_user_ids);
  DELETE FROM accounts_passwordresetcode WHERE user_id  = ANY(v_user_ids);
  DELETE FROM security_securitylog       WHERE user_id  = ANY(v_user_ids);

  -- 6. Unlink records Django keeps (on_delete=SET_NULL)
  UPDATE security_activitylog                         SET performed_by_id       = NULL WHERE performed_by_id       = ANY(v_user_ids);
  UPDATE tree_planting_programs_seedlingrequest       SET assigned_inspector_id = NULL WHERE assigned_inspector_id = ANY(v_user_ids);
  UPDATE tree_planting_programs_progressreport        SET dm_reviewed_by_id     = NULL WHERE dm_reviewed_by_id     = ANY(v_user_ids);
  UPDATE tree_planting_programs_progressreport        SET gis_reviewed_by_id    = NULL WHERE gis_reviewed_by_id    = ANY(v_user_ids);
  UPDATE tree_planting_programs_programclosurerequest SET requested_by_id       = NULL WHERE requested_by_id       = ANY(v_user_ids);
  UPDATE tree_planting_programs_programclosurerequest SET decided_by_id         = NULL WHERE decided_by_id         = ANY(v_user_ids);
  UPDATE sites_sitemetadataverification               SET verified_by_id        = NULL WHERE verified_by_id        = ANY(v_user_ids);
  UPDATE sites_permitdocument                         SET uploaded_by_id        = NULL WHERE uploaded_by_id        = ANY(v_user_ids);

  -- 7. The users
  DELETE FROM accounts_user WHERE id = ANY(v_user_ids);

  RAISE NOTICE 'Deleted % tree growers (kept %): % applications, % seedling requests, % progress reports',
    array_length(v_user_ids, 1),
    v_keep,
    COALESCE(array_length(v_app_ids, 1), 0),
    COALESCE(array_length(v_sr_ids, 1), 0),
    COALESCE(array_length(v_pr_ids, 1), 0);
END $$;
