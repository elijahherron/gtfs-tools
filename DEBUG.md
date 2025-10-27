# Debug Guide for Section Visibility Issues

## Issues Fixed

### 1. Removed Debug CSS (styles.css)
- ✅ Removed forced `display: flex` that broke section layout
- ✅ Removed debug colors (red/yellow/blue borders)
- ✅ Removed pink background from section headers
- ✅ Added missing `.create-empty-state` CSS rule

### 2. Fixed HTML Debug Styles (index.html)
- ✅ Removed inline debug styles from create-empty-state
- ✅ Removed "INLINE STYLES TEST" content

### 3. Fixed JavaScript Null Reference Errors (gtfs-editor.js)
- ✅ Fixed `.create-section` selector (should be `#createEmptyState`)
- ✅ Added null checks to prevent "Cannot read properties of null" errors
- ✅ Fixed updateUIForCreationMode and updateUIForEditingMode

### 4. Fixed Global Editor Access (app.js)
- ✅ Made editor globally accessible via `window.editor`

## How to Test

### Step 1: Hard Refresh Browser
- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### Step 2: Open Browser Console (F12)
Run this script to verify everything is loaded:

```javascript
// Check if sections exist
console.log('Import section:', document.getElementById('import-section'));
console.log('Create section:', document.getElementById('create-section'));
console.log('Preview section:', document.getElementById('preview-section'));
console.log('Export section:', document.getElementById('export-section'));

// Check active class
console.log('Active sections:', document.querySelectorAll('.content-section.active'));

// Check if editor is initialized
console.log('Editor:', window.editor);

// Check CSS
const createSection = document.getElementById('create-section');
if (createSection) {
    const styles = window.getComputedStyle(createSection);
    console.log('Create section display:', styles.display);
    console.log('Create section opacity:', styles.opacity);
    console.log('Create section visibility:', styles.visibility);
}
```

### Step 3: Test Section Switching
Run this in console to manually switch to Create section:

```javascript
// Remove active from all sections
document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

// Add active to create section
const createSection = document.getElementById('create-section');
createSection.classList.add('active');

// Check if it's visible
const styles = window.getComputedStyle(createSection);
console.log('Display:', styles.display);
console.log('Height:', createSection.offsetHeight);
console.log('Children:', createSection.children.length);
```

### Step 4: Test Upload
Upload a GTFS file and check console for errors.

## Expected Behavior

- ✅ Only one section should have `active` class at a time
- ✅ Active section should have `display: block !important`
- ✅ Active section should be visible with content
- ✅ No "Cannot read properties of null" errors in console
- ✅ GTFS upload should work without errors

## If Still Not Working

1. **Clear browser cache completely**
   - Chrome: Settings > Privacy > Clear browsing data > Cached images and files
   - Firefox: Settings > Privacy > Clear Data > Cached Web Content

2. **Check for JavaScript errors**
   - Open Console (F12)
   - Look for red error messages
   - Share the error messages

3. **Verify files are saved**
   ```bash
   cd /Users/elijahherron/Documents/GitHub/gtfs-tools
   git diff styles.css
   git diff index.html
   git diff gtfs-editor.js
   git diff app.js
   ```

4. **Try incognito/private mode**
   - This ensures no caching issues

## Manual Section Visibility Test

Add this temporarily to the top of styles.css to force visibility:

```css
.content-section {
    border: 5px solid green !important;
    min-height: 500px !important;
    background: white !important;
}

.content-section.active {
    display: block !important;
    border: 5px solid red !important;
}
```

If sections are still invisible with this CSS, there's a deeper issue with the page structure.
