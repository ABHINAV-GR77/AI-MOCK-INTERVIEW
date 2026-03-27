# CI/CD Setup

This project now has a GitHub Actions pipeline in `.github/workflows/ci-cd.yml`.

## What the workflow does

- Runs frontend checks on every pull request and push
- Runs backend tests on every pull request and push
- Starts the Docker stack and runs Selenium smoke tests
- Builds the backend Docker image
- Pushes the image to GitHub Container Registry on `main`
- Deploys to your server over SSH when deployment secrets are configured

## GitHub repository settings

Open:

- `GitHub -> Repository -> Settings -> Secrets and variables -> Actions`

Add these secrets:

- `DEPLOY_HOST`: server IP or hostname
- `DEPLOY_USER`: SSH username
- `DEPLOY_SSH_KEY`: private SSH key used by GitHub Actions
- `DEPLOY_PATH`: absolute path on the server where the app should live
- `DEPLOY_PORT`: optional, defaults to `22`
- `GHCR_PULL_TOKEN`: GitHub personal access token with permission to pull packages from GHCR

## Recommended token scopes

For `GHCR_PULL_TOKEN`, create a GitHub personal access token with:

- `read:packages`

If your package visibility or org policy requires it, also allow:

- `repo`

## Server preparation

Your server needs:

- Docker
- Docker Compose plugin
- A deploy directory matching `DEPLOY_PATH`
- A production `.env` file in that directory

You can use `scripts/setup-server.sh` as a starting point on an Ubuntu server.

## Production env file

Create `${DEPLOY_PATH}/.env` on the server using `.env.production.example` as a template.

Minimum values to set:

- `GROQ_API_KEY`
- `ASSEMBLYAI_API_KEY`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `SECRET_KEY`
- `MONGODB_URL`
- `REDIS_URL`

Recommended values on the server:

- `MONGODB_URL=mongodb://mongodb:27017`
- `REDIS_URL=redis://redis:6379`

## First deployment flow

1. Commit and push this branch to GitHub.
2. Add the required Actions secrets.
3. Prepare the server and create the production `.env`.
4. Push to `main`.
5. Watch the Actions run in the GitHub UI.

## Notes

- The deploy step only runs on `main`.
- The deploy step is automatically skipped if deploy secrets are missing.
- The production deployment uses `docker-compose.prod.yml`, which is uploaded to the server and renamed to `docker-compose.yml`.
