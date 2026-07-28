const { app, BrowserWindow, protocol, net, session } = require('electron')
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
  // External links (SIMBAD / VizieR, opened with target=_blank) become child
  // windows; without this override Electron gives them a cramped default size.
  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: { width: 1400, height: 950 },
  }))
  // Drop the reference when the window is gone so it can be GC'd and so the
  // app doesn't try to talk to a destroyed window.
  win.on('closed', () => { win = null })
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

  // Inject permissive CORS headers for the astronomy data services the page
  // queries. The ESA Gaia archive (the fallback when VizieR is down) sends no
  // Access-Control-Allow-Origin header at all, and VizieR's outage/error pages
  // drop theirs too — without this the renderer can never read those responses,
  // so every failure collapses into an opaque "Failed to fetch".
  const DATA_HOSTS = new Set(['tapvizier.cds.unistra.fr', 'tapvizier.u-strasbg.fr', 'gea.esac.esa.int'])
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let host = ''
    try { host = new URL(details.url).hostname } catch {}
    if (!DATA_HOSTS.has(host)) return callback({})
    const responseHeaders = { ...details.responseHeaders }
    for (const k of Object.keys(responseHeaders)) {
      if (k.toLowerCase() === 'access-control-allow-origin') delete responseHeaders[k]
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    callback({ responseHeaders })
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

// Fully quit when the window is closed (including the red traffic-light button
// on macOS, where the default behavior is to keep the app alive). This makes
// the red X behave like a real "quit" so no orphaned process lingers.
app.on('window-all-closed', () => {
  app.quit()
})

// Belt-and-suspenders: if the renderer window is closed directly, make sure the
// whole app tears down rather than sitting headless in the background.
app.on('before-quit', () => {
  if (win && !win.isDestroyed()) win.removeAllListeners('closed')
})