-- citext gives case-insensitive uniqueness on email (ADR-0012, ADR-0014).
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "salary" DECIMAL(12,2) NOT NULL,
    "position" TEXT NOT NULL,
    "manager_id" UUID,
    "avatar_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "employee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_audit" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "employee_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_manager_id_idx" ON "employees"("manager_id");

-- CreateIndex
CREATE INDEX "employees_last_name_first_name_idx" ON "employees"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "employee_audit_employee_id_idx" ON "employee_audit"("employee_id");

-- CreateIndex
CREATE INDEX "employee_audit_changed_at_idx" ON "employee_audit"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_employee_id_idx" ON "tasks"("employee_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------
-- Hand-written objects Prisma cannot express.
-- ---------------------------------------------------------------------------------------

-- ADR-0007: the cheapest layer, for the case the brief names directly.
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_not_own_manager" CHECK ("manager_id" IS NULL OR "manager_id" <> "id");

-- ADR-0008: the authoritative cycle guard. Walks the proposed manager's ancestor chain and
-- refuses the write if this employee is on it. Applies to every writer, not just the API.
-- SQLSTATE HC001 lets the API map the failure to HIERARCHY_CYCLE.
CREATE FUNCTION "prevent_reporting_cycle"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."manager_id" IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE "chain"("id", "depth") AS (
      SELECT NEW."manager_id", 1
      UNION
      SELECT e."manager_id", c."depth" + 1
      FROM "employees" e
      JOIN "chain" c ON e."id" = c."id"
      -- The depth cap keeps even corrupt data from producing an unbounded walk.
      WHERE e."manager_id" IS NOT NULL AND c."depth" < 10000
    )
    SELECT 1 FROM "chain" WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Reporting cycle: % cannot report to %', NEW."id", NEW."manager_id"
      USING ERRCODE = 'HC001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "employees_prevent_reporting_cycle"
  BEFORE INSERT OR UPDATE OF "manager_id" ON "employees"
  FOR EACH ROW EXECUTE FUNCTION "prevent_reporting_cycle"();

-- ADR-0011: the audit trail. Attribution comes from the transaction-scoped session variable
-- the API sets with set_config(..., true); any other writer is still audited, as NULL.
CREATE FUNCTION "audit_employee_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "employee_audit" ("employee_id", "action", "changed_by", "before", "after")
    VALUES (NEW."id", 'CREATE', actor, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ignore writes that change nothing but the timestamp.
    IF (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
      RETURN NEW;
    END IF;
    INSERT INTO "employee_audit" ("employee_id", "action", "changed_by", "before", "after")
    VALUES (
      NEW."id",
      CASE WHEN NEW."manager_id" IS DISTINCT FROM OLD."manager_id" THEN 'REPARENT' ELSE 'UPDATE' END,
      actor,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSE
    INSERT INTO "employee_audit" ("employee_id", "action", "changed_by", "before", "after")
    VALUES (OLD."id", 'DELETE', actor, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER "employees_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "employees"
  FOR EACH ROW EXECUTE FUNCTION "audit_employee_change"();

ALTER TABLE "employee_audit"
  ADD CONSTRAINT "employee_audit_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE', 'REPARENT'));
