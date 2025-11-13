# Nexent Upgrade Guide

## 🚀 Upgrade Overview

Follow these four steps to upgrade Nexent safely:

1. Clean up existing containers and images
2. Pull the latest code and run the deployment script
3. Apply database migrations
4. Verify the deployment in your browser

---

## 🧹 Step 1: Clean up old images

Remove cached resources to avoid conflicts when redeploying:

```bash
# Stop and remove existing containers
docker compose down

# Inspect and remove Nexent images
docker images | grep nexent
docker images | grep nexent | awk '{print $3}' | xargs docker rmi -f

# (Optional) prune unused images and caches
docker system prune -af
```

> ⚠️ Notes
> - Back up critical data before deleting images.
> - To preserve database data, do not delete the mounted database volume (`/nexent/docker/volumes` or your custom path).

---

## 🔄 Step 2: Update code and redeploy

```bash
git pull
cd nexent/docker
cp .env.example .env
bash deploy.sh
```

> 💡 Tip
> - `.env.example` works for default deployments.
> - Configure speech models (STT/TTS) in `.env` when needed. A frontend configuration flow is coming soon.

---

## 🗄️ Step 3: Apply database migrations

Run the SQL scripts shipped with each release to keep your schema up to date.

### ✅ Method A: Use a SQL editor (recommended)

1. Open your SQL client and create a new PostgreSQL connection.
2. Retrieve connection settings from `/nexent/docker/.env`:
   - Host
   - Port
   - Database
   - User
   - Password
3. Test the connection. When successful, you should see tables under the `nexent` schema.
4. Open a new query window.
5. Navigate to `/nexent/docker/sql`. Each file contains one migration script with its release date in the filename.
6. Execute every script dated after your previous deployment, in chronological order.

> ⚠️ Important
> - Always back up the database first, especially in production.
> - Run scripts sequentially to avoid dependency issues.
> - `.env` keys may be named `POSTGRES_HOST`, `POSTGRES_PORT`, and so on—map them accordingly in your SQL client.

### 🧰 Method B: Use the command line (no SQL client required)

1. Switch to the Docker directory:

   ```bash
   cd nexent/docker
   ```

2. Read database connection details from `.env`, for example:

   ```bash
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=nexent
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   ```

3. Execute SQL files sequentially (host machine example):

   ```bash
   docker exec -i nexent-postgresql psql -U $POSTGRES_USER -d $POSTGRES_DB < ./sql/2025-10-30-update.sql
   docker exec -i nexent-postgresql psql -U $POSTGRES_USER -d $POSTGRES_DB < ./sql/2025-11-05-update.sql
   ```

   Replace the filenames with the migrations released after your last deployment.

> 💡 Tips
> - Load environment variables first if they are defined in `.env`:
>
>   ```bash
>   export $(grep -v '^#' .env | xargs)
>   ```
>
> - Create a backup before running migrations:
>
>   ```bash
>   docker exec -i nexent-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql
>   ```

---

## 🌐 Step 4: Verify the deployment

After deployment:

1. Open `http://localhost:3000` in your browser.
2. Review the [User Guide](https://doc.nexent.tech/en/user-guide/) to validate agent functionality.


