# Northstar Quiz Assessment System

A self-hosted quiz and assessment application built with native PHP, PDO/MySQL, vanilla JavaScript, and local CSS. It has no CDN, package manager, remote font, framework, or internet runtime requirement.

## Project files

```text
.
├── .htaccess
├── README.md
├── admin.php
├── docs/
│   ├── .nojekyll
│   ├── index.html
│   ├── assets/css/style.css
│   └── assets/js/demo.js
├── api/
│   ├── attempts.php
│   ├── auth.php
│   ├── quizzes.php
│   └── submit.php
├── assets/
│   ├── css/style.css
│   └── js/{admin,common,login,student}.js
├── config/
│   ├── .htaccess
│   ├── bootstrap.php
│   └── db.php
├── index.php
├── login.php
├── router.php
├── schema.sql
└── scripts/
    ├── .htaccess
    ├── change-password.php
    └── create-user.php
```

## Features

### Full PHP/MySQL application

- Session-based sign-in/sign-out with role guards for students and administrators, password hashing, CSRF protection, session ID rotation, and secure cookie settings.
- Admin dashboard with student/assessment/submission counts and a recent-attempt results table.
- Two-step assessment builder with add/remove questions and choices, per-question points, a single correct-choice radio, validation, and transactional publishing.
- Student assessment catalog with duration, question count, points, responsive quiz runner, answer tracking, countdown, automatic timeout submission, and result display.
- Server-side scoring against database answer keys. Correct-answer flags are excluded from student API responses.
- MySQL persistence for accounts, assessments, questions, choices, and attempts, plus CLI tools to add accounts and rotate passwords.
- Self-hosted dark UI, responsive forms, keyboard-visible focus states, status messages, tables, badges, and countdown indicators. No external runtime assets.

### Browser-only test demo

- Separate static demo at `docs/index.html`; it does not call PHP or connect to MySQL.
- Browser demo administrator plus student self-registration/sign-in. Demo passwords are PBKDF2/SHA-256 hashed with a per-account salt using the browser Web Crypto API.
- Assessment builder, stored quizzes, timed student runner, result calculation, and admin attempt overview.
- Accounts, quizzes, and results are stored in this browser’s `localStorage`; the signed-in session and in-progress answers use `sessionStorage`.
- Demo data is local to the browser/origin and is editable by the user. It is for UI/workflow testing only—not secure authentication, grading, or production use. Never enter a real password or sensitive data.

## Requirements

- PHP 7.4 or newer (PHP 8.1+ recommended) with `pdo_mysql` and `mbstring` enabled.
- MySQL 8.0+ or a compatible InnoDB MySQL/MariaDB server.
- A web server with PHP support. No Composer, npm, or external network connection is required at runtime.

## Local deployment

### 1. Create a database and restricted application account

Start MySQL and run the following as a database administrator. Replace the example password with a unique, long password.

```sql
CREATE DATABASE quiz_assessment
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER 'quiz_app'@'localhost' IDENTIFIED BY 'replace-with-a-long-random-password';
GRANT SELECT, INSERT, UPDATE
  ON quiz_assessment.* TO 'quiz_app'@'localhost';
FLUSH PRIVILEGES;
```

Import the schema as a database administrator from the repository root (for example, use `sudo mysql quiz_assessment < schema.sql` on installations with socket-authenticated root):

```sh
mysql -u root -p quiz_assessment < schema.sql
```

The schema creates the application tables and seeds the initial administrator. The seed is a bcrypt hash usable by PHP `password_verify()`.

### 2. Configure the database connection

`config/db.php` reads these environment variables (the defaults are for a local developer install):

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | MySQL server hostname or address |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `quiz_assessment` | Database name |
| `DB_USER` | `root` | MySQL account |
| `DB_PASSWORD` | empty | MySQL password |

For a local shell, set the variables for the PHP process. Example on Linux/macOS:

```sh
export DB_HOST=localhost
export DB_NAME=quiz_assessment
export DB_USER=quiz_app
export DB_PASSWORD='replace-with-a-long-random-password'
```

In PowerShell, set them for the current terminal before starting PHP:

```powershell
$env:DB_HOST = 'localhost'
$env:DB_NAME = 'quiz_assessment'
$env:DB_USER = 'quiz_app'
$env:DB_PASSWORD = 'replace-with-a-long-random-password'
```

Do not put real database secrets in this repository. Production deployments should inject them from the web server/service environment and use a database account limited to this schema.

### 3. Rotate the initial administrator password

The seeded local bootstrap account is:

- Email: `admin@example.com`
- Password: `Admin@123`

Change it before exposing the site to anyone else. From the repository root, with the same database environment configured:

```sh
php scripts/change-password.php admin@example.com
```

The script prompts for the new password and confirmation without putting the password in shell history. Use at least 12 characters. The account tool is CLI-only and the `config/` and `scripts/` directories are blocked from web access.

Create student accounts (or additional administrators) on the server with:

```sh
php scripts/create-user.php
```

Enter the name, email, role, and a 12-character minimum password at the prompts. Public self-registration is intentionally not enabled.

### 4. Start the local development server

From the repository root, with the database variables set:

```sh
php -S 0.0.0.0:8000 -t . router.php
```

On the same computer, open `http://127.0.0.1:8000/`. For access from another device on the trusted LAN, open `http://<server-LAN-address>:8000/` and permit TCP port 8000 in the host firewall as appropriate. The included router blocks the schema, project metadata, and private directories when using PHP's built-in server.

The PHP built-in server is for development and trusted local testing only; it is not a production web server. For production or a shared network, use Apache or Nginx with PHP-FPM (or another supported PHP SAPI), HTTPS, a firewall, and a dedicated MySQL account. With Apache, enable `.htaccess` overrides (`AllowOverride All`) so the included access restrictions apply. Configure the document root to this project, keep `config/` and `scripts/` inaccessible, and set database variables in the virtual host/PHP-FPM pool rather than in source files. For Nginx, add explicit deny rules for `/.git`, `/config`, `/scripts`, `/schema.sql`, and hidden files; Nginx does not read `.htaccess`.

### 5. Sign in and publish

1. Sign in with the administrator account, then immediately change its bootstrap password as described above.
2. In the administration workspace, enter a title, description, and time limit.
3. Add one or more questions. Each question needs at least two choices and exactly one correct choice. Set its points, then publish.
4. Add student accounts using `scripts/create-user.php`. Students sign in at the same page, choose an assessment, and submit before the countdown expires.
5. Review the latest submissions and aggregate counts in the administrator workspace.

## Run the browser-only demo (no PHP or database)

The demo is completely separate from the production PHP pages. It needs only Python 3 (or any static file server) and a modern browser. From the repository root:

```sh
python3 -m http.server 8001 --bind 127.0.0.1 --directory docs
```

On Windows, use `py -m http.server 8001 --bind 127.0.0.1 --directory docs`. Open `http://127.0.0.1:8001/`. `localhost` is used so browser password hashing is available without HTTPS. This static server exposes only the demo directory.

Test the flow:

1. Sign in with `admin@example.com` / `Admin@123`.
2. Create a quiz with a short time limit, at least one question, two choices, and a selected correct answer. Publish it.
3. Sign out, choose **Create a student account**, and register a demo student with an email and an 8-character minimum demo password.
4. Start the assessment, select answers, and submit—or let the countdown expire for automatic submission.
5. Review the score on the student result screen, sign out, then sign in as the demo administrator to see the saved attempt.
6. Use **Reset demo data** to clear browser demo accounts, quizzes, and results and recreate the sample admin.

The browser demo requires a secure context for Web Crypto password hashing; `http://localhost` and `http://127.0.0.1` are suitable. It does not share accounts or data with the PHP/MySQL application. Browser storage can be inspected or changed, and client-side demo scoring is not secure.

## Deploy the demo on GitHub Pages

The demo is in the repository’s `docs/` directory, which GitHub Pages can publish directly from a branch. This avoids a build workflow and keeps the PHP application, database schema, configuration, and account scripts out of the published site.

1. Push or merge this branch to `main`.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and the `/docs` folder, then save.
4. Open `https://<owner>.github.io/<repository>/` (for this repository, normally `https://kyabtao.github.io/PhP_Quiz/`). GitHub Pages may take a few minutes to publish the first time.

GitHub Pages serves the demo over HTTPS, so browser password hashing works. Accounts, assessments, and results remain in each visitor’s browser storage; they are not shared with the repository or with other visitors. Resetting the browser’s site data clears that visitor’s demo data.

## API overview

All API responses are JSON. Mutating requests require the session-bound CSRF token sent in the `X-CSRF-Token` header. Browser calls use same-origin session cookies.

- `POST api/auth.php`: JSON `{"action":"login","email":"…","password":"…"}` or `{"action":"logout"}`.
- `GET api/quizzes.php`: authenticated assessment catalog and metadata.
- `GET api/quizzes.php?id=<id>`: assessment detail. Correct-answer flags are included only for administrators and are not sent to students.
- `POST api/quizzes.php` with `{"action":"start","quiz_id":<id>}`: student-only start/resume of the server-recorded timer. This state-changing action requires CSRF validation.
- `POST api/quizzes.php` with `{"action":"create", ...}`: administrator-only transactional assessment creation, including questions and choices.
- `POST api/submit.php`: student-only answer submission. Scores are calculated on the server against the database answer key and persisted in `attempts`.
- `GET api/attempts.php`: administrator-only recent results and overview counts.

## Operational notes

- All styling and scripts are local. Once PHP and MySQL are installed, the application can run entirely on an air-gapped network.
- Sessions use strict mode, HTTP-only and SameSite=Lax cookies, rotate the session ID after login, and set `Secure` automatically for direct HTTPS requests.
- API mutations validate CSRF tokens and roles. PDO uses exceptions, associative fetches, and native prepared statements. Errors are logged server-side without returning SQL details to users.
- Assessment answer keys are omitted from student responses. The submit endpoint validates that submitted question/choice IDs belong to the requested quiz before calculating marks.
- Deploy behind HTTPS for real accounts. If terminating TLS at a reverse proxy, configure the web server/PHP SAPI so PHP correctly identifies HTTPS; do not blindly trust arbitrary forwarded headers.
- Back up the MySQL database regularly and protect access to server logs and backups.
