const { app, BrowserWindow, protocol, net, session, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url')
const crypto = require('crypto')
const zlib = require('zlib')
const { pipeline } = require('stream')
const yauzl = require('yauzl')

// ============================================================
//  CONFIG
// ============================================================
const ZIP_NAME      = 'lists.zip'
const DATA_FILENAME = 'list_RANKED_Scatter_Slope_SPEARMAN'
const DATA_VERSION  = '1'

// The dataset lives on Zenodo. DOI 10.5072/zenodo.597047 resolves to the record
// below; we ask the API rather than the DOI because it hands back the file's
// real download URL, byte size and MD5 instead of an HTML landing page.
//
// This currently points at Zenodo's *sandbox*, which is a test instance and
// wipes records periodically. Publishing for real means changing these five
// values — the API URL, the DOI, and the three fallbacks — and nothing else.
const ZENODO_API = 'https://sandbox.zenodo.org/api/records/597047'
const ZENODO_DOI = 'https://handle.test.datacite.org/10.5072/zenodo.597047'

// Used if the metadata request fails (API down, schema change). The content URL
// is stable, and these are the values published with the record.
const ZIP_URL_FALLBACK  = `${ZENODO_API}/files/${ZIP_NAME}/content`
const ZIP_SIZE_FALLBACK = 1753575291
const ZIP_MD5_FALLBACK  = 'd0372cb73323194019bd81fbba2ddf93'

const EXTRACTED_BYTES = 3.97e9   // uncompressed dataset, for the disk-space check
const MAX_ATTEMPTS    = 5        // network attempts before giving up; each one resumes
const STALL_MS        = 90_000   // abort a connection that stops delivering bytes
// ============================================================

// The extracted dataset is ~3.7 GB. On Windows userData resolves to the
// *roaming* profile (%APPDATA%), which gets synced to a server on login for
// machines with roaming profiles enabled — so cache to LOCALAPPDATA there.
const baseDir = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'ivecmd')
  : app.getPath('userData')

const cacheDir   = path.join(baseDir, 'data')
const dataFile   = path.join(cacheDir, DATA_FILENAME)
const markerPath = path.join(cacheDir, '.data-version')

// Downloads land beside the cache rather than inside it: cacheDir is wiped
// before every extraction, and a half-finished download has to survive that (and
// a quit) so the next launch can resume instead of starting over.
const downloadDir = path.join(baseDir, 'downloads')
const cachedZip   = path.join(downloadDir, ZIP_NAME)
const partialZip  = `${cachedZip}.part`

// A copy the user fetched by hand still counts — checked before the network.
const zipPath = path.join(app.getPath('downloads'), ZIP_NAME)

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let win
let busy = false          // guards against a second Try again while one is running
let activeRequest = null  // in-flight download, so closing the window can abort it
let usedUserZip = false   // whether this attempt used the copy in ~/Downloads

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
  win.on('closed', () => {
    win = null
    if (activeRequest) { try { activeRequest.abort() } catch {} }
  })
}

function resolveAsset(requestPath) {
  const cached = path.join(cacheDir, requestPath)
  if (fs.existsSync(cached)) return cached
  return path.join(__dirname, requestPath)
}

/* ---------------- Status page ----------------
   One page reused for every phase: loadURL is slow and flashes, so it's loaded
   once and the pieces are updated in place from here. */

function statusPage() {
  return 'data:text/html,' + encodeURIComponent(`
    <html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;
      font-family:-apple-system,'Segoe UI',sans-serif;text-align:center;padding:0 40px">
      <div id="msg" style="font-size:18px;max-width:620px;line-height:1.6"></div>
      <div id="bar" style="width:min(460px,80vw);height:6px;border-radius:3px;
        background:#21262d;margin-top:22px;overflow:hidden;display:none">
        <div id="fill" style="width:0;height:100%;background:#2f81f7;transition:width .3s"></div>
      </div>
      <div id="pct" style="font-size:42px;margin-top:14px"></div>
      <div id="sub" style="font-size:13px;color:#8b949e;margin-top:8px;min-height:18px"></div>
      <div id="actions" style="margin-top:26px"></div>
    </body></html>`)
}

function ui(js) {
  if (!win || win.isDestroyed()) return
  win.webContents.executeJavaScript(js).catch(() => {})
}

const setText = (id, text) =>
  ui(`var e=document.getElementById(${JSON.stringify(id)}); if(e) e.textContent=${JSON.stringify(text)};`)
const setHTML = (id, html) =>
  ui(`var e=document.getElementById(${JSON.stringify(id)}); if(e) e.innerHTML=${JSON.stringify(html)};`)

function setMsg(html) { setHTML('msg', html) }
function setSub(text) { setText('sub', text) }

// frac === null hides the bar (for phases with no measurable progress)
function setProgress(frac, label) {
  setText('pct', label == null ? '' : label)
  if (frac == null) {
    ui(`var b=document.getElementById('bar'); if(b) b.style.display='none';`)
    return
  }
  const pct = Math.max(0, Math.min(100, frac * 100))
  ui(`var b=document.getElementById('bar'), f=document.getElementById('fill');
      if(b){b.style.display='block';} if(f){f.style.width=${JSON.stringify(pct.toFixed(1) + '%')};}`)
}

// Buttons live in the page, so they talk back over the app:// scheme (there is
// no preload/IPC bridge here and the status page is a data: URL).
function setActions(html) { setHTML('actions', html) }

const BTN_STYLE = 'padding:9px 18px;font-size:14px;border-radius:6px;border:1px solid #30363d;' +
                  'background:#21262d;color:#e6edf3;cursor:pointer;margin:0 6px;text-decoration:none;' +
                  'display:inline-block;font-family:inherit'

async function showStatusPage() {
  if (!win || win.isDestroyed()) return
  await win.loadURL(statusPage())
}

/* ---------------- Helpers ---------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms))

function human(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' kB'
}

function humanTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 90) return `${Math.round(seconds)} s left`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min left`
  return `${(seconds / 3600).toFixed(1)} h left`
}

function freeBytes(dir) {
  try {
    if (typeof fs.statfsSync !== 'function') return null
    const s = fs.statfsSync(dir)
    return Number(s.bavail) * Number(s.bsize)
  } catch { return null }
}

function fileSize(p) {
  try { return fs.statSync(p).size } catch { return 0 }
}

function alreadyExtracted() {
  try {
    return fs.existsSync(dataFile) &&
           fs.readFileSync(markerPath, 'utf8').trim() === DATA_VERSION
  } catch { return false }
}

// Sum the uncompressed sizes from the zip's central directory. Cheap — it
// never reads the compressed data itself.
function uncompressedBytes(zip) {
  return new Promise((resolve) => {
    yauzl.open(zip, { lazyEntries: true }, (err, zipfile) => {
      if (err) return resolve(0)
      let total = 0
      zipfile.on('entry', (entry) => { total += entry.uncompressedSize; zipfile.readEntry() })
      zipfile.on('end', () => resolve(total))
      zipfile.on('error', () => resolve(0))
      zipfile.readEntry()
    })
  })
}

// Cross-platform replacement for `du -sk`. The dataset is only ~17 files, so
// walking it every second costs nothing.
function folderBytes(dir) {
  let total = 0
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) total += folderBytes(p)
      else total += fs.statSync(p).size
    }
  } catch {}
  return total
}

// An entry's payload starts after its local header: 30 fixed bytes plus the
// name and extra field, whose lengths only the local header knows (the central
// directory's extra field is a different length).
function entryDataOffset(fd, entry) {
  const head = Buffer.alloc(30)
  fs.readSync(fd, head, 0, 30, entry.relativeOffsetOfLocalHeader)
  if (head.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`corrupt archive: bad local header for ${entry.fileName}`)
  }
  return entry.relativeOffsetOfLocalHeader + 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
}

// Unzip without letting yauzl stream the data itself.
//
// yauzl hands out entry streams cut from one shared file descriptor (fd-slicer).
// Under Electron those streams never restart after an inflate stream pauses them
// for backpressure, so extraction wedges partway through an entry and hangs
// forever — extract-zip, which is built on the same streams, deadlocked here
// every time (~800 kB in, on the same byte). Reading each entry's compressed
// range with a plain fs read stream avoids fd-slicer completely: yauzl is still
// what parses the central directory, but the bytes move over ordinary streams.
function extractZip(zip, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    yauzl.open(zip, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(new Error(`could not read the archive: ${err.message}`))

      let fd
      try { fd = fs.openSync(zip, 'r') } catch (e) { return reject(e) }

      let settled = false
      const fail = (e) => {
        if (settled) return
        settled = true
        try { fs.closeSync(fd) } catch {}
        try { zipfile.close() } catch {}
        reject(e)
      }
      const finish = () => {
        if (settled) return
        settled = true
        try { fs.closeSync(fd) } catch {}
        resolve()
      }

      zipfile.on('error', fail)
      zipfile.on('end', finish)

      zipfile.on('entry', (entry) => {
        const name = entry.fileName
        const dest = path.resolve(destDir, name)
        // Zip slip: never let an entry name write outside the data folder.
        if (dest !== destDir && !dest.startsWith(destDir + path.sep)) {
          return fail(new Error(`refusing to extract outside the data folder: ${name}`))
        }

        if (name.endsWith('/')) {
          try { fs.mkdirSync(dest, { recursive: true }) } catch (e) { return fail(e) }
          return zipfile.readEntry()
        }

        try { fs.mkdirSync(path.dirname(dest), { recursive: true }) } catch (e) { return fail(e) }

        if (entry.compressedSize === 0) {          // empty file: no range to read
          try { fs.writeFileSync(dest, '') } catch (e) { return fail(e) }
          return zipfile.readEntry()
        }

        let start
        try { start = entryDataOffset(fd, entry) } catch (e) { return fail(e) }

        const rs = fs.createReadStream(zip, { start, end: start + entry.compressedSize - 1 })
        const ws = fs.createWriteStream(dest)
        const done = (e) => {
          if (e) return fail(new Error(`could not extract ${name}: ${e.message}`))
          // Catches a silently truncated entry — the exact failure this
          // implementation exists to avoid.
          if (ws.bytesWritten !== entry.uncompressedSize) {
            return fail(new Error(
              `${name} extracted as ${ws.bytesWritten} bytes, expected ${entry.uncompressedSize}`))
          }
          zipfile.readEntry()
        }

        if (entry.compressionMethod === 8) pipeline(rs, zlib.createInflateRaw(), ws, done)
        else if (entry.compressionMethod === 0) pipeline(rs, ws, done)
        else fail(new Error(`unsupported compression method ${entry.compressionMethod} in ${name}`))
      })

      zipfile.readEntry()
    })
  })
}

/* ---------------- Zenodo ---------------- */

// net.request (rather than plain https) so the download inherits Electron's
// proxy resolution and the system certificate store — campus networks need both.
function requestStream(target, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url: target, method: 'GET', redirect: 'follow' })
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)
    req.on('response', res => resolve({ req, res }))
    req.on('error', reject)
    req.end()
  })
}

async function fetchJson(target) {
  const { res } = await requestStream(target)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    res.resume()
    throw new Error(`HTTP ${res.statusCode}`)
  }
  const chunks = []
  return new Promise((resolve, reject) => {
    res.on('data', c => chunks.push(c))
    res.on('error', reject)
    res.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch (e) { reject(new Error('unreadable response from Zenodo')) }
    })
  })
}

// Ask the record which file to pull, how big it is and what it should hash to,
// so re-publishing the dataset doesn't require shipping a new build.
async function resolveRemoteZip() {
  try {
    const rec = await fetchJson(ZENODO_API)
    const files = Array.isArray(rec.files) ? rec.files : []
    const entry = files.find(f => f.key === ZIP_NAME) || files[0]
    if (entry && entry.links && entry.links.self) {
      return {
        url: entry.links.self,
        size: Number(entry.size) || 0,
        md5: String(entry.checksum || '').replace(/^md5:/, ''),
        name: entry.key || ZIP_NAME,
      }
    }
  } catch (e) {
    console.warn('Zenodo metadata lookup failed:', e.message, '— using the published file URL')
  }
  return { url: ZIP_URL_FALLBACK, size: ZIP_SIZE_FALLBACK, md5: ZIP_MD5_FALLBACK, name: ZIP_NAME }
}

// One download attempt, resuming from whatever is already in the .part file.
// Rejects on any network trouble; the caller retries, and the next attempt picks
// up from the new offset rather than starting over.
function downloadAttempt(remote, onProgress) {
  return new Promise((resolve, reject) => {
    let start = fileSize(partialZip)
    if (remote.size && start >= remote.size) {
      // Leftover from an interrupted run that was already complete (or garbage).
      fs.rmSync(partialZip, { force: true })
      start = 0
    }

    const headers = start > 0 ? { Range: `bytes=${start}-` } : {}

    requestStream(remote.url, headers).then(({ req, res }) => {
      activeRequest = req

      const header = name => {
        const v = res.headers[name]
        return Array.isArray(v) ? v[0] : v
      }

      // 416 means our .part is at or past the end of the file — it can't be
      // right, so throw it away and let the next attempt start clean.
      if (res.statusCode === 416) {
        res.resume()
        fs.rmSync(partialZip, { force: true })
        activeRequest = null
        return reject(new Error('discarded a stale partial download'))
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume()
        activeRequest = null
        return reject(new Error(`Zenodo returned HTTP ${res.statusCode}`))
      }

      // A 200 to a Range request means the server ignored it: rewrite from zero.
      const resuming = res.statusCode === 206 && start > 0
      if (!resuming) start = 0

      let total = remote.size || 0
      const range = header('content-range')
      const m = range && range.match(/\/(\d+)\s*$/)
      if (m) total = Number(m[1])
      else if (!total) total = start + (Number(header('content-length')) || 0)

      const ws = fs.createWriteStream(partialZip, { flags: resuming ? 'a' : 'w' })
      let got = start
      const t0 = Date.now()
      let lastByteAt = Date.now()
      let settled = false
      let watchdog = null

      const finish = (err) => {
        if (settled) return
        settled = true
        clearInterval(watchdog)
        activeRequest = null
        if (err) { try { req.abort() } catch {} }
        // Settle only once the file is closed, so the .part size on disk is
        // final before the next attempt reads it to pick a resume offset.
        let done = false
        const settle = () => {
          if (done) return
          done = true
          err ? reject(err) : resolve({ total })
        }
        ws.end(settle)
        ws.once('close', settle)   // covers a stream that errored while closing
      }

      watchdog = setInterval(() => {
        if (Date.now() - lastByteAt > STALL_MS) finish(new Error('the connection stalled'))
      }, 5000)

      res.on('data', chunk => {
        lastByteAt = Date.now()
        got += chunk.length
        if (!ws.write(chunk)) {
          res.pause()
          ws.once('drain', () => res.resume())
        }
        const elapsed = (Date.now() - t0) / 1000
        const rate = elapsed > 0 ? (got - start) / elapsed : 0
        onProgress(got, total, rate)
      })
      res.on('error', finish)
      res.on('aborted', () => finish(new Error('the connection was interrupted')))
      res.on('end', () => {
        if (settled) return
        if (total && got < total) return finish(new Error('the connection closed early'))
        finish(null)
      })
      ws.on('error', e => finish(new Error(`could not write to disk: ${e.message}`)))
    }).catch(e => {
      activeRequest = null
      reject(e)
    })
  })
}

async function downloadZip(remote) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await downloadAttempt(remote, (got, total, rate) => {
        setProgress(total ? got / total : null,
          total ? Math.floor(got / total * 100) + '%' : human(got))
        const eta = total && rate ? humanTime((total - got) / rate) : ''
        setSub(`${human(got)} of ${human(total)}` +
               (rate ? ` · ${human(rate)}/s` : '') + (eta ? ` · ${eta}` : ''))
      })
      return
    } catch (e) {
      if (!win || win.isDestroyed()) throw e   // window closed — stop quietly
      lastErr = e
      if (attempt < MAX_ATTEMPTS) {
        setSub(`${e.message} — retrying (${attempt}/${MAX_ATTEMPTS - 1})…`)
        await sleep(2000 * attempt)
      }
    }
  }
  throw lastErr
}

// Hashed in a separate pass rather than while downloading, because a resumed
// download never sees the bytes written by the previous run.
function md5File(file, onProgress) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const total = fileSize(file)
    let read = 0
    const rs = fs.createReadStream(file)
    rs.on('data', chunk => {
      hash.update(chunk)
      read += chunk.length
      if (onProgress) onProgress(read, total)
    })
    rs.on('error', reject)
    rs.on('end', () => resolve(hash.digest('hex')))
  })
}

/* ---------------- First-run data setup ---------------- */

// Returns true once the dataset is extracted and ready to serve.
async function ensureData() {
  if (alreadyExtracted()) return true

  fs.mkdirSync(downloadDir, { recursive: true })

  let zip = null
  let ownedByApp = false        // only delete the zip afterwards if we fetched it
  usedUserZip = false

  if (fs.existsSync(zipPath)) {
    // The user already has a copy in Downloads — use it and skip the network.
    zip = zipPath
    usedUserZip = true
    setMsg(`Found <strong>${ZIP_NAME}</strong> in your Downloads folder.`)
  } else if (fs.existsSync(cachedZip)) {
    // Downloaded on an earlier launch but extraction never finished.
    zip = cachedZip
    ownedByApp = true
  } else {
    const remote = await resolveRemoteZip()

    const free = freeBytes(baseDir)
    const needed = (remote.size || ZIP_SIZE_FALLBACK) + EXTRACTED_BYTES
    if (free != null && free < needed) {
      throw new Error(
        `not enough free disk space — the dataset needs about ${human(needed)} ` +
        `(download plus extracted files) and this drive has ${human(free)} available`)
    }

    setMsg(`Downloading the dataset from Zenodo — about ${human(remote.size || ZIP_SIZE_FALLBACK)}.<br>` +
           `This happens once; the app picks up where it left off if you quit.`)
    setProgress(0, '0%')
    await downloadZip(remote)

    if (remote.md5) {
      setMsg('Checking the download…')
      setProgress(0, '0%')
      const sum = await md5File(partialZip, (read, total) => {
        setProgress(total ? read / total : null, total ? Math.floor(read / total * 100) + '%' : '')
      })
      if (sum !== remote.md5) {
        fs.rmSync(partialZip, { force: true })
        throw new Error('the download was corrupted in transit (checksum mismatch) — it has been discarded')
      }
      setSub('checksum verified')
    }

    fs.renameSync(partialZip, cachedZip)
    zip = cachedZip
    ownedByApp = true
  }

  setMsg('Preparing data — extracting the dataset. This happens once on first launch.')
  setProgress(0, '0%')
  setSub('')
  await sleep(150)

  fs.rmSync(cacheDir, { recursive: true, force: true })
  fs.mkdirSync(cacheDir, { recursive: true })

  const total = await uncompressedBytes(zip)
  const job = extractZip(zip, cacheDir)

  const poll = setInterval(() => {
    if (!total) { setProgress(null, 'working…'); return }
    const done = folderBytes(cacheDir)
    setProgress(Math.min(0.99, done / total), Math.min(99, Math.round(done / total * 100)) + '%')
  }, 1000)

  try {
    await job
  } finally {
    clearInterval(poll)
  }

  setProgress(1, '100%')
  fs.writeFileSync(markerPath, DATA_VERSION)

  // Reclaim the 1.7 GB archive — it can always be pulled again from Zenodo. A
  // copy the user put in Downloads is theirs, so leave it alone.
  if (ownedByApp) fs.rmSync(zip, { force: true })

  return true
}

async function runSetup() {
  if (busy) return
  busy = true
  try {
    if (!alreadyExtracted()) {
      await showStatusPage()
      setMsg('Looking for the dataset…')
    }
    await ensureData()
    if (!win || win.isDestroyed()) return
    // Pass the packaged version through so the window title can show it. The
    // app:// handler keys off the pathname only, so the query string is ignored
    // when the file is resolved.
    win.loadURL(`app://bundle/index.html?v=${encodeURIComponent(app.getVersion())}`)
  } catch (e) {
    if (!win || win.isDestroyed()) return
    const partial = fileSize(partialZip)
    setProgress(null, null)
    // If the copy in Downloads is the thing that failed, retrying changes
    // nothing until it's out of the way — say that instead of the generic advice.
    const advice = usedUserZip
      ? `That was the copy of <strong>${ZIP_NAME}</strong> in your <strong>Downloads</strong> folder. ` +
        `Delete or replace it and the app will fetch a fresh copy from Zenodo by itself.`
      : `You can try again, or download <strong>${ZIP_NAME}</strong> from Zenodo yourself, ` +
        `put it in your <strong>Downloads</strong> folder and reopen the app.`
    setMsg(`<strong>Could not set up the dataset.</strong><br><br>${e.message}<br><br>${advice}`)
    setSub(partial ? `${human(partial)} already downloaded — Try again resumes from there.` : '')
    setActions(
      `<a href="app://retry/" style="${BTN_STYLE}">Try again</a>` +
      `<a href="app://zenodo/" style="${BTN_STYLE}">Open the Zenodo page</a>`)
  } finally {
    busy = false
  }
}

app.whenReady().then(async () => {
  protocol.handle('app', (request) => {
    const parsed = new URL(request.url)

    // Buttons on the status page. Both answer 204 so the page they were clicked
    // from stays put — Chromium treats "no content" as "nothing to navigate to".
    if (parsed.hostname === 'retry') {
      setTimeout(runSetup, 0)
      return new Response(null, { status: 204 })
    }
    if (parsed.hostname === 'zenodo') {
      shell.openExternal(ZENODO_DOI)
      return new Response(null, { status: 204 })
    }

    const reqPath = decodeURIComponent(parsed.pathname)
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
  await runSetup()
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
  if (activeRequest) { try { activeRequest.abort() } catch {} }
  if (win && !win.isDestroyed()) win.removeAllListeners('closed')
})
