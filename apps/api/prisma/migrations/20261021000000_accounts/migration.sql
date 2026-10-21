-- ADR-0036: every employee has a login, created and managed by admins.

-- A login may exist before its owner has a password (NULL: sign-in is refused until an admin
-- issues one), may be forced to choose a new password, and may be deactivated.
ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_login_at" TIMESTAMPTZ(6);

-- Backfill: give every employee without a login one, with no password yet. An employee whose
-- email is already some other login's keeps none, rather than failing the deploy.
INSERT INTO "users" ("email", "password_hash", "role", "employee_id", "must_change_password")
SELECT e."email", NULL, 'VIEWER', e."id", true
FROM "employees" e
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."employee_id" = e."id")
ON CONFLICT ("email") DO NOTHING;

-- A login now always belongs to an employee, and goes when they do. Fails loudly if a login
-- with no employee exists, rather than deleting it.
ALTER TABLE "users" DROP CONSTRAINT "users_employee_id_fkey";
ALTER TABLE "users" ALTER COLUMN "employee_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The account audit trail, written by a trigger like employee_audit (ADR-0011). No foreign
-- keys, so it outlives the logins it describes. Password hashes are never copied into it.
CREATE TABLE "user_audit" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "user_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_audit_changed_at_idx" ON "user_audit"("changed_at" DESC);
CREATE INDEX "user_audit_user_id_idx" ON "user_audit"("user_id");

ALTER TABLE "user_audit"
  ADD CONSTRAINT "user_audit_action_check"
  CHECK ("action" IN ('CREATE', 'ROLE_CHANGE', 'DEACTIVATE', 'REACTIVATE', 'PASSWORD_RESET',
                      'PASSWORD_CHANGE', 'DELETE'));

CREATE FUNCTION "audit_user_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by", "details")
    VALUES (NEW."id", NEW."email", 'CREATE', actor, jsonb_build_object('role', NEW."role"));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by", "details")
    VALUES (OLD."id", OLD."email", 'DELETE', actor, jsonb_build_object('role', OLD."role"));
    RETURN OLD;
  END IF;

  -- One row per kind of change, so a single update can record several. Signing in only
  -- touches last_login_at and records nothing.
  IF NEW."role" IS DISTINCT FROM OLD."role" THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by", "details")
    VALUES (NEW."id", NEW."email", 'ROLE_CHANGE', actor,
            jsonb_build_object('from', OLD."role", 'to', NEW."role"));
  END IF;
  IF OLD."deactivated_at" IS NULL AND NEW."deactivated_at" IS NOT NULL THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by")
    VALUES (NEW."id", NEW."email", 'DEACTIVATE', actor);
  ELSIF OLD."deactivated_at" IS NOT NULL AND NEW."deactivated_at" IS NULL THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by")
    VALUES (NEW."id", NEW."email", 'REACTIVATE', actor);
  END IF;
  IF NEW."password_hash" IS DISTINCT FROM OLD."password_hash" THEN
    INSERT INTO "user_audit" ("user_id", "email", "action", "changed_by")
    VALUES (NEW."id", NEW."email",
            CASE WHEN NEW."must_change_password" THEN 'PASSWORD_RESET' ELSE 'PASSWORD_CHANGE' END,
            actor);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "audit_user_change"();
