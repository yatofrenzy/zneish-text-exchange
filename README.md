# Zneish Text Exchange

Zneish Text Exchange is a realtime sharing website inspired by simple shared text boards. It supports live text editing, quick notes, links, photo uploads, file uploads, downloads, copy, dark mode, and a live connected-user count.

## What is inside

- `server.js` runs the Express web server and Socket.IO realtime server.
- `public/index.html` is the website layout.
- `public/styles.css` is the full responsive UI design.
- `public/app.js` connects the browser to WebSocket events and handles uploads.
- `public/uploads/` is where uploaded files are saved while the server is running.

## Beginner setup on Windows

1. Install Node.js from [nodejs.org](https://nodejs.org/). Choose the LTS version if you are unsure.
2. Open this project folder in VS Code or Terminal.
3. If PowerShell blocks `npm`, use `npm.cmd` instead of `npm`.
4. Install the project packages:

```bash
npm.cmd install
```

5. Start the website:

```bash
npm.cmd run dev
```

6. Open this URL in your browser:

```text
http://localhost:3000
```

7. To test realtime sharing, open the same URL in two browser tabs. Type in one tab and watch the other update.

## How to use

- Type in the large text box to sync text live.
- Paste a URL or short note in the top input, then press Share.
- Drop photos or files into the upload box.
- Use Copy to copy the shared text.
- Use Download to save the shared text as a `.txt` file.
- Use Clear to reset the board for everyone connected.

## Deploying

This app is ready for platforms that support Node.js WebSockets, such as Render, Railway, Fly.io, or a VPS.

### Render quick deploy

1. Push this project to GitHub.
2. Create a new Render Web Service.
3. Connect your GitHub repository.
4. Use these settings:

```text
Build Command: npm install
Start Command: npm start
```

5. Deploy and open the public Render URL.

## Important note about files

Uploaded files are saved to `public/uploads/` on the server. That is fine for learning and small demos. For a serious production app, store uploads in a service like Cloudinary, UploadThing, S3, or Supabase Storage so files do not disappear when the server restarts or redeploys.

## Customize the name

The current name is **Zneish Text Exchange**. You can rename it in:

- `public/index.html`
- `package.json`
- this `README.md`
