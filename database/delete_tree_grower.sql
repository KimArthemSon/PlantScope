-- =====================================================================
-- DELETE A TREE GROWER USER AND ALL THEIR RELATED RECORDS
-- (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Django's on_delete rules run in Python, NOT in the database, so this
-- script removes the child rows manually, deepest first.
--
-- HOW TO USE:
--   1. Change the user id on the lines marked  <<< SET USER ID HERE
--      (it appears in STEP 1 and STEP 2)
--   2. Run STEP 1 (preview) to see what will be removed.
--   3. Run STEP 2 (delete). It runs as a single transaction, so if any
--      statement fails, nothing is deleted.
--
-- SAFETY: STEP 2 stops if the user is not a 'treeGrowers' account.
-- Sites are NOT deleted, only the tree grower's applications on them.
-- =====================================================================


-- =====================================================================
-- STEP 1: PREVIEW (read-only)
-- =====================================================================
WITH u AS (SELECT 1::bigint AS id),              -- <<< SET USER ID HERE
apps AS (
  SELECT application_id FROM tree_planting_programs_application
  WHERE user_id = (SELECT id FROM u)
),
prs AS (
  SELECT progress_report_id FROM tree_planting_programs_progressreport
  WHERE application_id IN (SELECT application_id FROM apps)
     OR submitted_by_id = (SELECT id FROM u)
),
srs AS (
  SELECT seedling_request_id FROM tree_planting_programs_seedlingrequest
  WHERE application_id IN (SELECT application_id FROM apps)
     OR created_by_id = (SELECT id FROM u)
)
SELECT 'user (' || COALESCE((SELECT email || ' / ' || user_role FROM accounts_user WHERE id = (SELECT id FROM u)), 'NOT FOUND') || ')' AS item,
       COUNT(*) FROM accounts_user WHERE id = (SELECT id FROM u)
UNION ALL SELECT 'profile',                  COUNT(*) FROM accounts_profile WHERE users_id = (SELECT id FROM u)
UNION ALL SELECT 'tree grower group',        COUNT(*) FROM accounts_treegrowergroup WHERE users_id = (SELECT id FROM u)
UNION ALL SELECT 'applications',             COUNT(*) FROM apps
UNION ALL SELECT 'seedling requests',        COUNT(*) FROM srs
UNION ALL SELECT 'seedling request species', COUNT(*) FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id IN (SELECT seedling_request_id FROM srs)
UNION ALL SELECT 'progress reports',         COUNT(*) FROM prs
UNION ALL SELECT 'progress report species',  COUNT(*) FROM tree_planting_programs_progressreportspecies WHERE progress_report_id IN (SELECT progress_report_id FROM prs)
UNION ALL SELECT 'reasons',                  COUNT(*) FROM tree_planting_programs_reason WHERE application_id IN (SELECT application_id FROM apps) OR user_id = (SELECT id FROM u)
UNION ALL SELECT 'closure requests',         COUNT(*) FROM tree_planting_programs_programclosurerequest WHERE application_id IN (SELECT application_id FROM apps)
UNION ALL SELECT 'notifications',            COUNT(*) FROM accounts_notification WHERE user_id = (SELECT id FROM u)
UNION ALL SELECT 'password reset codes',     COUNT(*) FROM accounts_passwordresetcode WHERE user_id = (SELECT id FROM u)
UNION ALL SELECT 'security logs',            COUNT(*) FROM security_securitylog WHERE user_id = (SELECT id FROM u)
UNION ALL SELECT 'activity logs (unlinked, kept)', COUNT(*) FROM security_activitylog WHERE performed_by_id = (SELECT id FROM u);


-- =====================================================================
-- STEP 2: DELETE
-- =====================================================================
DO $$
DECLARE
  v_user_id bigint := 1;                         -- <<< SET USER ID HERE
  v_role    text;
  v_app_ids int[];
  v_pr_ids  int[];
  v_sr_ids  int[];
BEGIN
  SELECT user_role INTO v_role FROM accounts_user WHERE id = v_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User % does not exist', v_user_id;
  ELSIF v_role <> 'treeGrowers' THEN
    RAISE EXCEPTION 'User % is a "%", not a treeGrowers account. Aborted.', v_user_id, v_role;
  END IF;

  -- Collect related ids
  SELECT COALESCE(array_agg(application_id), '{}') INTO v_app_ids
  FROM tree_planting_programs_application
  WHERE user_id = v_user_id;

  SELECT COALESCE(array_agg(progress_report_id), '{}') INTO v_pr_ids
  FROM tree_planting_programs_progressreport
  WHERE application_id = ANY(v_app_ids) OR submitted_by_id = v_user_id;

  SELECT COALESCE(array_agg(seedling_request_id), '{}') INTO v_sr_ids
  FROM tree_planting_programs_seedlingrequest
  WHERE application_id = ANY(v_app_ids) OR created_by_id = v_user_id;

  -- 1. Progress reports (and their species)
  DELETE FROM tree_planting_programs_progressreportspecies WHERE progress_report_id = ANY(v_pr_ids);
  DELETE FROM tree_planting_programs_progressreport        WHERE progress_report_id = ANY(v_pr_ids);

  -- 2. Seedling requests (and their species)
  DELETE FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id = ANY(v_sr_ids);
  DELETE FROM tree_planting_programs_seedlingrequest        WHERE seedling_request_id = ANY(v_sr_ids);

  -- 3. Reasons and closure requests
  DELETE FROM tree_planting_programs_reason
  WHERE application_id = ANY(v_app_ids) OR user_id = v_user_id;
  DELETE FROM tree_planting_programs_programclosurerequest
  WHERE application_id = ANY(v_app_ids);

  -- 4. The tree grower's applications (sites stay)
  DELETE FROM tree_planting_programs_application WHERE application_id = ANY(v_app_ids);

  -- 5. Account data
  DELETE FROM accounts_profile          WHERE users_id = v_user_id;
  DELETE FROM accounts_treegrowergroup  WHERE users_id = v_user_id;
  DELETE FROM accounts_notification     WHERE user_id  = v_user_id;
  DELETE FROM accounts_passwordresetcode WHERE user_id = v_user_id;
  DELETE FROM security_securitylog      WHERE user_id  = v_user_id;

  -- 6. Unlink records Django keeps (on_delete=SET_NULL).
  --    Activity logs keep performed_by_email, so history stays readable.
  UPDATE security_activitylog                         SET performed_by_id     = NULL WHERE performed_by_id     = v_user_id;
  UPDATE tree_planting_programs_seedlingrequest       SET assigned_inspector_id = NULL WHERE assigned_inspector_id = v_user_id;
  UPDATE tree_planting_programs_progressreport        SET dm_reviewed_by_id   = NULL WHERE dm_reviewed_by_id   = v_user_id;
  UPDATE tree_planting_programs_progressreport        SET gis_reviewed_by_id  = NULL WHERE gis_reviewed_by_id  = v_user_id;
  UPDATE tree_planting_programs_programclosurerequest SET requested_by_id     = NULL WHERE requested_by_id     = v_user_id;
  UPDATE tree_planting_programs_programclosurerequest SET decided_by_id       = NULL WHERE decided_by_id       = v_user_id;
  UPDATE sites_sitemetadataverification               SET verified_by_id      = NULL WHERE verified_by_id      = v_user_id;
  UPDATE sites_permitdocument                         SET uploaded_by_id      = NULL WHERE uploaded_by_id      = v_user_id;

  -- 7. The user itself
  DELETE FROM accounts_user WHERE id = v_user_id;

  RAISE NOTICE 'Deleted tree grower %: % applications, % seedling requests, % progress reports',
    v_user_id,
    COALESCE(array_length(v_app_ids, 1), 0),
    COALESCE(array_length(v_sr_ids, 1), 0),
    COALESCE(array_length(v_pr_ids, 1), 0);
END $$;
