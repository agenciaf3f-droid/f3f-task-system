CREATE TABLE "template_users" (
  "template_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "template_users_pkey" PRIMARY KEY ("template_id", "user_id"),
  CONSTRAINT "template_users_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "template_users_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "template_users_user_id_idx" ON "template_users"("user_id");
