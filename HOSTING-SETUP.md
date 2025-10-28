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
   - Drag and drop .zip files onto the upload zone, or click to browse
   - Click "Upload" for each file
   - Once uploaded, you'll get a permanent download link
   - Links look like: `https://raw.githubusercontent.com/yourusername/gtfs-tools/main/gtfs-files/filename.zip`

## How It Works

- Files are uploaded to the `gtfs-files/` directory in your repository
- Each file gets a permanent URL via GitHub's raw content CDN
- You can manage (view/delete) your uploaded files from the page
- Your GitHub token is stored securely in your browser's localStorage (not on any server)

## File Limits

- Maximum file size: 100MB (GitHub's file size limit)
- Supported format: .zip files only
- Files are versioned with Git (every upload creates a commit)

## Managing Files

### View Hosted Files
All your uploaded files appear in the "Your Hosted Files" section at the bottom of the page.

### Copy Download Links
Click the "Copy Link" button next to any file to copy its permanent download URL.

### Delete Files
Click "Delete" next to any file to remove it from your repository.

## Using Download Links

Once uploaded, files are accessible at:
```
https://raw.githubusercontent.com/YOUR_USERNAME/gtfs-tools/main/gtfs-files/YOUR_FILE.zip
```

These links:
- ✅ Are permanent (as long as you don't delete the file)
- ✅ Download directly (no GitHub UI)
- ✅ Work from anywhere (CORS-friendly)
- ✅ Are perfect for GTFS validators, transit apps, etc.

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

After uploading files, your repository will look like:
```
gtfs-tools/
├── gtfs-files/
│   ├── transit-feed-1.zip
│   ├── transit-feed-2.zip
│   └── ...
├── index.html
├── upload.html
└── ...
```

## Tips

- **Organize files**: Consider using descriptive filenames like `city-transit-2024-01-15.zip`
- **Version control**: Each upload is a Git commit, so you have full version history
- **Share links**: The raw.githubusercontent.com links work great for sharing with validators
- **Backup**: Download the .json work file from the main editor before uploading

---

Enjoy hosting your GTFS files! 🚇
