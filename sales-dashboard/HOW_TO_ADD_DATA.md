# Quick Guide: Adding New Sales Data

The dashboard automatically loads all XLS files - no code changes needed!

## Steps to Add New Data

### 1. Add Your Files
Copy your XLS files to the correct folder:

**For Pesticide Sales (PS):**
```bash
cp your-file.XLS sales-dashboard/public/Data/2025-26/PS/
```

**For Fertilizer Sales (FS):**
```bash
cp your-file.XLS sales-dashboard/public/Data/2025-26/FS/
```

### 2. Regenerate Manifest
Run this command from the `sales-dashboard` directory:

```bash
npm run generate-manifest
```

You'll see output like:
```
✅ Data manifest generated successfully!
📁 Found 3 PS files and 3 FS files
   - PS: Dec01.XLS (2025-12-01)
   - PS: Dec02.XLS (2025-12-02)
   - PS: Dec03.XLS (2025-12-03)  ← Your new file!
   ...
```

### 3. Refresh Browser
Just refresh your browser at `http://localhost:5173/` and the new data will appear!

## File Naming Requirements

Files must follow this pattern: `MonthDD.XLS`

**Valid names:**
- `Dec01.XLS`, `Dec02.XLS`, `Dec31.XLS`
- `Jan01.XLS`, `Jan15.XLS`
- `Feb28.XLS`, `Mar15.XLS`

**Invalid names:**
- `sales-data.XLS` (no month/day)
- `12-01-2025.XLS` (wrong format)
- `december-1.XLS` (full month name)

## Example Workflow

```bash
# Navigate to dashboard directory
cd sales-dashboard

# Add new sales file
cp ~/Downloads/Dec03.XLS public/Data/2025-26/PS/

# Regenerate manifest
npm run generate-manifest

# Refresh browser - Done! ✅
```

## Checking Console Logs

Open browser DevTools (F12) and check the Console tab. You'll see:
```
📊 Loading 6 data files from manifest...
✅ Loaded: Dec01.XLS
✅ Loaded: Dec02.XLS
✅ Loaded: Dec03.XLS
🎉 Successfully loaded 6 files
```

## Troubleshooting

**Problem:** New file doesn't appear
- ✅ Check file is in correct folder (PS or FS)
- ✅ Verify filename matches pattern (MonthDD.XLS)
- ✅ Run `npm run generate-manifest` again
- ✅ Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

**Problem:** Error loading file
- Check browser console for specific error
- Verify XLS file is not corrupted
- Ensure file has required columns: HSNCODE, ITNAME, QTY, TAXBLEAMT, GST
