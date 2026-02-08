# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18Q4ox1dj5wMj0vU0K_LFSjUoi9VJJ1mu

## Run Locally

**Prerequisites:** Node.js

### Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   # Copy the example environment file
   copy .env.example .env.local
   ```
   
   Then edit `.env.local` and add your actual credentials:
   - `DATABASE_URL` - Your Neon database connection string from https://console.neon.tech
   - `GEMINI_API_KEY` - Your Gemini API key from https://ai.google.dev/

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
4. Deploy

## Security

⚠️ **Important**: Never commit `.env.local` or any file containing actual credentials to git. Always use environment variables for sensitive data.

For more information, see [SECURITY.md](SECURITY.md).

