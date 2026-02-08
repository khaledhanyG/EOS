# Security Best Practices

This document outlines security best practices for the EOS application.

## Environment Variables

### Never Commit Credentials

**Critical**: Never commit files containing sensitive credentials to git:
- `.env.local`
- `.env.production`
- Any file with database connection strings, API keys, or passwords

These files are protected by `.gitignore`, but always verify before committing.

### Setting Up Environment Variables

#### Local Development

1. Copy the example file:
   ```bash
   copy .env.example .env.local
   ```

2. Edit `.env.local` with your actual credentials:
   - `DATABASE_URL` - Your Neon database connection string
   - `GEMINI_API_KEY` - Your Gemini API key

3. Never share `.env.local` via email, chat, or commit it to git

#### Production (Vercel)

1. Log into your Vercel dashboard
2. Navigate to your project settings
3. Go to Environment Variables section
4. Add each variable:
   - Name: `DATABASE_URL`, Value: `<your-connection-string>`
   - Name: `GEMINI_API_KEY`, Value: `<your-api-key>`
4. Redeploy your application

## Database Security

### Neon Database

Your Neon PostgreSQL database connection string contains sensitive information:
- Username
- Password
- Host location
- Database name

### Rotating Database Credentials

If your database credentials are ever exposed (committed to git, shared publicly, etc.), you must rotate them immediately:

1. **Log into Neon Console**:
   - Visit https://console.neon.tech
   - Select your project

2. **Reset Password**:
   - Navigate to the database settings
   - Reset the password for your database user
   - Copy the new connection string

3. **Update Environments**:
   - Update `d:\EOS-app\.env.local` with the new connection string
   - Update the `DATABASE_URL` environment variable in Vercel
   - Redeploy your Vercel application

### Connection String Format

The connection string format is:
```
postgresql://[username]:[password]@[host]/[database]?sslmode=require&channel_binding=require
```

Keep all components secret, especially the password.

## What to Do If Credentials Are Exposed

If you accidentally commit credentials to GitHub:

1. **Immediately rotate the credentials** (see above)
2. **Remove from git history** (optional but recommended):
   ```bash
   # Remove the file from all commits
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch <filename>" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (WARNING: rewrites history)
   git push origin --force --all
   ```
3. **Update all environments** with new credentials
4. **Review access logs** on your database for unauthorized access

## API Keys

### Gemini API Key

- Get your API key from https://ai.google.dev/
- Store in `.env.local` locally and Vercel environment variables for production
- Never log or expose the key in error messages
- Rotate if exposed

## Git Security Checklist

Before every commit, verify:
- [ ] No `.env` files are being committed
- [ ] No hardcoded credentials in code
- [ ] All secrets use environment variables
- [ ] `.gitignore` is properly configured

Use this command to check for common secrets:
```bash
git diff --cached | findstr /i "password api_key secret token database_url"
```

## Additional Resources

- [Neon Security Documentation](https://neon.tech/docs/introduction/security)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
