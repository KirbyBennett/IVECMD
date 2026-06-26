const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url')
const { execFile, spawn } = require('child_process')

// ============================================================
//  CONFIG
// ============================================================
const ZIP_NAME      = 'lists.zip'
const DATA_FILENAME = 'list_RANKED_Scatter_Slope_SPEARMAN'
const DATA_VERSION  = '1'
// ============================================================

const cacheDir   = path.join(app.getPath('userData'), 'data')
const dataFile   = path.join(cacheDir, DATA_FILENAME)
const markerPath = path.join(cacheDir, '.data-version')

// Look for the zip in the user's Downloads folder
const zipPath = path.join(app.getPath('downloads'), ZIP_NAME)

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let win

function createWindow() {
  win = new BrowserWindow({ width: 1100, height: 750 })
}

function resolveAsset(requestPath) {
  const cached = path.join(cacheDir, requestPath)
  if (fs.existsSync(cached)) return cached
  return path.join(__dirname, requestPath)
}

function loadingPage(message) {
  return 'data:text/html,' + encodeURIComponent(`
    <html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;
      font-family:-apple-system,sans-serif;text-align:center;padding:0 40px">
      <div style="font-size:18px;max-width:560px;line-height:1.6">${message}</div>
      <div id="pct" style="font-size:42px;margin-top:16px"></div>
    </body></html>`)
}

function setPct(text) {
  if (!win) return
  win.webContents.executeJavaScript(
    `var e=document.getElementById('pct'); if(e) e.textContent=${JSON.stringify(text)};`
  ).catch(() => {})
}

function alreadyExtracted() {
  try {
    return fs.existsSync(dataFile) &&
           fs.readFileSync(markerPath, 'utf8').trim() === DATA_VERSION
  } catch { return false }
}

function uncompressedBytes(zip) {
  return new Promise((resolve) => {
    execFile('/usr/bin/unzip', ['-l', zip], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(0)
      const lines = stdout.trim().split('\n')
      const m = lines[lines.length - 1].trim().match(/^(\d+)/)
      resolve(m ? parseInt(m[1], 10) : 0)
    })
  })
}

function folderBytes(dir) {
  return new Promise((resolve) => {
    execFile('/usr/bin/du', ['-sk', dir], (err, stdout) => {
      if (err) return resolve(0)
      const m = stdout.trim().match(/^(\d+)/)
      resolve(m ? parseInt(m[1], 10) * 1024 : 0)
    })
  })
}

function extractNative(zip, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    const child = spawn('/usr/bin/ditto', ['-x', '-k', zip, destDir])
    let stderr = ''
    child.stderr.on('data', d => { stderr += d })
    child.on('error', reject)
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error('ditto exited ' + code + ': ' + stderr)))
  })
}

app.whenReady().then(async () => {
  protocol.handle('app', (request) => {
    const reqPath = decodeURIComponent(new URL(request.url).pathname)
    return net.fetch(url.pathToFileURL(resolveAsset(reqPath)).toString())
  })

  createWindow()

  if (!alreadyExtracted()) {
    // Check the zip exists in Downloads before trying anything
    if (!fs.existsSync(zipPath)) {
      win.loadURL(loadingPage(
        `To get started, download <strong>${ZIP_NAME}</strong> and save it to your <strong>Downloads</strong> folder.<br><br>` +
        `Then reopen the app and it will extract the data automatically.`
      ))
      return
    }

    try {
      win.loadURL(loadingPage('Preparing data — extracting the dataset. This happens once on first launch.'))
      await new Promise(r => setTimeout(r, 250))

      fs.rmSync(cacheDir, { recursive: true, force: true })
      fs.mkdirSync(cacheDir, { recursive: true })

      const total = await uncompressedBytes(zipPath)
      const job = extractNative(zipPath, cacheDir)

      const poll = setInterval(async () => {
        if (!total) { setPct('working…'); return }
        const done = await folderBytes(cacheDir)
        setPct(Math.min(99, Math.round(done / total * 100)) + '%')
      }, 1000)

      await job
      clearInterval(poll)
      setPct('100%')
      fs.writeFileSync(markerPath, DATA_VERSION)
    } catch (e) {
      win.loadURL(loadingPage(
        'Could not extract the dataset: ' + e.message +
        '<br><br>Make sure <strong>' + ZIP_NAME + '</strong> is in your Downloads folder and reopen the app.'))
      return
    }
  }

  win.loadURL('app://bundle/index.html')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})