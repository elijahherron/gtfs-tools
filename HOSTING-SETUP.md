# GTFS File Hosting Setup

This guide will help you set up the GTFS file hosting feature to upload and host GTFS .zip files with permanent download links.

## Quick Start

1. **Enable GitHub Pages** (if not already enabled):
   - Go to your repository settings
   - Navigate to "Pages" section
   - Under "Source", select your main branch
   - Click "Save"
   - Your site will be available at `https://yourusername.github.io/gtfs-tools/`

2. **Access the upload page**:
   - Navigate to `https://yourusername.github.io/gtfs-tools/upload.html`
   - Or open `upload.html` directly in your browser

3. **Create a GitHub Personal Access Token**:
   - Go to https://github.com/settings/tokens/new
   - Give it a descriptive name (e.g., "GTFS File Uploader")
   - Set expiration (recommend "No expiration" for convenience)
   - Select scopes:
     - ✅ **repo** (Full control of private repositories)
   - Click "Generate token"
   - **IMPORTANT**: Copy the token immediately (you won't see it again!)

4. **Connect to GitHub**:
   - Paste your token in the input field on `upload.html`
   - Click "Connect to GitHub"
   - Your token will be saved in browser localStorage

5. **Upload files**:
   - Enter a **feed name** (e.g., "stm", "city-transit", "metro")
   - This creates your stable URL that never changes
   - Select your GTFS .zip file
   - Click "Upload Feed"
   - Your stable URL: `https://raw.githubusercontent.com/yourusername/gtfs-tools/main/gtfs-feeds/feedname.zip`

## How It Works

- You choose a **feed name** that becomes part of your stable URL
- Files are uploaded to the `gtfs-feeds/` directory in your repository as `feedname.zip`
- The URL **never changes** - even when you upload a new version, it uses the same feed name
- Perfect for transit apps and validators that need a consistent URL
- You can manage (view/delete) your uploaded feeds from the page
- Your GitHub token is stored securely in your browser's localStorage (not on any server)

## File Limits

- Maximum file size: 100MB (GitHub's file size limit)
- Supported format: .zip files only
- Files are versioned with Git (every upload creates a commit)

## Managing Feeds

### View Hosted Feeds
All your uploaded feeds appear in the "Your Hosted Feeds" section at the bottom of the page.

### Copy Download Links
Click the "Copy URL" button next to any feed to copy its stable download URL.

### Update a Feed
Simply upload a new file with the same feed name - the URL stays the same, but the content updates.

### Delete Feeds
Click "Delete" next to any feed to remove it from your repository.

## Stable URLs - How They Work

Once uploaded, feeds are accessible at stable URLs like:
```
https://raw.githubusercontent.com/YOUR_USERNAME/gtfs-tools/main/gtfs-feeds/stm.zip
https://raw.githubusercontent.com/YOUR_USERNAME/gtfs-tools/main/gtfs-feeds/city-transit.zip
```

**Key Benefits:**
- ✅ **URL never changes** - Update the file, keep the same link
- ✅ **Perfect for integrations** - Transit apps can always fetch the latest data
- ✅ **No versioning in URL** - Like how STM uses `/gtfs_stm.zip` regardless of updates
- ✅ **Direct downloads** - No GitHub UI, just the file
- ✅ **CORS-friendly** - Works from web apps
- ✅ **Git versioning** - Full history of all uploads in your repo

## Security Notes

- **Token Storage**: Your GitHub token is stored only in your browser's localStorage
- **Never share your token**: Anyone with your token can access your repositories
- **Token Scopes**: The token only needs `repo` scope for this to work
- **Revoke if compromised**: You can revoke tokens at https://github.com/settings/tokens

## Troubleshooting

### "Authentication failed"
- Make sure you copied the complete token
- Verify the token has `repo` scope
- Check if the token is still valid (not revoked or expired)

### "Upload failed"
- Ensure file is a .zip and under 100MB
- Check that you have write access to the repository
- Try refreshing the page and re-authenticating

### "Files not showing"
- First upload will create the `gtfs-files/` directory
- Refresh the page after uploading
- Check your repository to verify the file was uploaded

## Alternative: Local Usage

You can also use `upload.html` locally without GitHub Pages:
1. Open `upload.html` directly in your browser
2. Follow the authentication steps
3. Files will still upload to your GitHub repository

## Repository Structure

After uploading feeds, your repository will look like:
```
gtfs-tools/
├── gtfs-feeds/
│   ├── stm.zip              ← Stable URL: .../gtfs-feeds/stm.zip
│   ├── city-transit.zip     ← Stable URL: .../gtfs-feeds/city-transit.zip
│   └── metro.zip            ← Stable URL: .../gtfs-feeds/metro.zip
├── index.html
├── upload.html
└── ...
```

## Tips

- **Choose good feed names**: Use short, memorable names like "stm", "metro", "bus-routes"
- **Update, don't create new**: Re-upload with the same feed name to update while keeping the same URL
- **Version control**: Each upload is a Git commit, so you have full version history in the repo
- **Share stable links**: Give apps and validators the URL once, and they'll always get the latest
- **Backup**: Download the .json work file from the main editor as a backup

## Example Workflow

1. Create feed "stm" → Get URL `https://raw.githubusercontent.com/you/gtfs-tools/main/gtfs-feeds/stm.zip`
2. Share URL with transit app developers
3. Update GTFS data in the editor
4. Re-upload with feed name "stm" → Same URL, updated content
5. Apps automatically get new data at the same URL

---

Enjoy hosting your GTFS files! 🚇
