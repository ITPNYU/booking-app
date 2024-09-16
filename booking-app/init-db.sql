-- init-db.sql
CREATE DATABASE IF NOT EXISTS mydatabase_shadow;
GRANT ALL PRIVILEGES ON mydatabase_shadow.* TO 'myuser'@'%';
FLUSH PRIVILEGES;
