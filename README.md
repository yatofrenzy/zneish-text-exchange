# Zneish Text Exchange

Zneish Text Exchange is a realtime room-based sharing website. People create a room, copy the room invite link or room key, and everyone in that room can share live text, notes, links, files, photos, AI chat, and small browser games.

## Features

- Separate rooms with unique room keys
- Realtime shared text using Socket.IO WebSockets
- Share notes and links in each room
- Upload files and photos per room
- Copy, paste, download, refresh, and clear room text
- Global mode for deployed internet sharing
- Local Wi-Fi mode guidance for same-network sharing
- AI chat using OpenRouter through a safe server environment variable
- Built-in Snake, Tetris, Flappy, and Murder Guess games
- Dark mode and responsive UI

## Important API key safety

Never put your OpenRouter API key inside `server.js`, `app.js`, GitHub, or public chat. If you already shared a key, revoke it in OpenRouter and create a new one.

This project reads the key from:

```text
OPENROUTER_API_KEY
```

## Run locally on Windows

1. Open this project folder in PowerShell.
2. Install dependencies:

```bash
npm.cmd install
```

3. Start the app:

```bash
npm.cmd run dev
```

4. Open:

```text
http://localhost:3000
```

5. Create a room, copy the invite link, and open it in another tab to test realtime sharing.

## Enable AI chat locally

PowerShell temporary setup:

```powershell
$env:OPENROUTER_API_KEY="your_new_openrouter_key"
$env:OPENROUTER_MODEL="openai/gpt-4o-mini"
$env:PUBLIC_APP_URL="http://localhost:3000"
npm.cmd run dev
```

The key is only available in that terminal session.

## Local Wi-Fi sharing

If you run the app on your computer, people on the same Wi-Fi can join using your computer's local IP address:

```text
http://YOUR_LOCAL_IP:3000?room=ROOMKEY
```

Example:

```text
http://192.168.1.25:3000?room=AB12CD
```

This only works on the same network unless you deploy the app.

## Global internet sharing

Deploy to Render. Then people anywhere can open:

```text
https://your-render-name.onrender.com?room=ROOMKEY
```

## Deploy to Render

1. Push this project to GitHub.
2. Go to Render and create a new Web Service.
3. Connect your GitHub repository.
4. Use:

```text
Build Command: npm install
Start Command: npm start
```

5. Add environment variables in Render:

```text
OPENROUTER_API_KEY=your_new_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o-mini
PUBLIC_APP_URL=https://your-render-name.onrender.com
```

6. Deploy.

## Push updates to GitHub

After editing files:

```bash
git status
git add .
git commit -m "Add rooms games and AI chat"
git push
```

Render will redeploy automatically if auto deploy is enabled.

## Production note about uploads

Uploads are saved under `public/uploads/` on the running server. This is good for learning and demos. For a serious production app, use Cloudinary, Supabase Storage, S3, or another permanent file storage service.
