/*
Pages fill the whole window, and the toolbar only appears when the mouse reaches the top edge.
Pages are native views that sit above the browser UI, so the UI can't see the mouse while it's over a page.
Instead, the cursor position is polled here, and the UI is told when it touches the top edge.
While the toolbar is revealed, the UI view is moved above the page so that it can float over it.
*/

const toolbarRevealEdgeSize = 6 // px from the top of the window that reveal the toolbar
const toolbarRevealPollInterval = 40
const windowButtonPosition = { x: 16, y: 15 }

function setToolbarOverlay (win, overlay) {
  const state = windows.getState(win)
  if (state.toolbarOverlay === overlay) {
    return
  }
  state.toolbarOverlay = overlay

  if (overlay) {
    // re-adding an existing child moves it to the top
    win.getContentView().addChildView(win.mainView)
  } else {
    win.getContentView().addChildView(win.mainView, 0)
  }
}

ipc.on('setToolbarState', function (e, args) {
  const windowData = windows.windowFromContents(e.sender)
  if (!windowData) {
    return
  }
  const win = windowData.win

  setToolbarOverlay(win, args.overlay)

  if (args.watchEdge && !windowData.state.watchToolbarEdge) {
    // if the cursor is already at the edge, reveal the toolbar again
    windowData.state.cursorInToolbarEdge = false
  }
  windowData.state.watchToolbarEdge = args.watchEdge

  if (process.platform === 'darwin' && !settings.get('useSeparateTitlebar')) {
    win.setWindowButtonVisibility(args.showWindowButtons)
    if (args.showWindowButtons) {
      // macOS forgets the custom position when the buttons are hidden
      win.setWindowButtonPosition(windowButtonPosition)
    }
  }
})

setInterval(function () {
  const openWindows = windows.openWindows.filter(w => !w.closed && w.state.watchToolbarEdge)
  if (openWindows.length === 0) {
    return
  }

  const cursor = electron.screen.getCursorScreenPoint()

  openWindows.forEach(function (windowData) {
    const win = windowData.win
    if (win.isDestroyed() || win.isMinimized() || !win.isVisible()) {
      return
    }

    const bounds = win.getContentBounds()
    const inEdge = cursor.x >= bounds.x &&
      cursor.x < bounds.x + bounds.width &&
      cursor.y >= bounds.y - 1 &&
      cursor.y < bounds.y + toolbarRevealEdgeSize

    if (inEdge && !windowData.state.cursorInToolbarEdge) {
      getWindowWebContents(win).send('toolbarEdgeEnter')
    }
    windowData.state.cursorInToolbarEdge = inEdge
  })
}, toolbarRevealPollInterval)

// a picture of the top of the page, which the UI blurs behind the toolbar so that it looks like glass
ipc.handle('captureToolbarBackdrop', async function (e, data) {
  const view = getView(data.id)
  if (!view) {
    return null
  }
  const bounds = view.getBounds()
  const img = await view.webContents.capturePage({ x: 0, y: 0, width: bounds.width, height: Math.min(data.height, bounds.height) })
  if (img.isEmpty()) {
    return null
  }
  // it will be blurred heavily, so a small image is enough
  return 'data:image/jpeg;base64,' + img.resize({ width: Math.round(bounds.width / 3) }).toJPEG(70).toString('base64')
})
