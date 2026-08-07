-- 009_driver_user_role.sql - Allow trusted Taxi driver self-service users.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('public','accredited','driver','moderator','admin','superadmin'));