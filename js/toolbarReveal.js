/*
Pages fill the whole window, and the toolbar is hidden until the mouse reaches the top edge of the window.

The toolbar is either:
- hidden: the page fills the window
- peeking: revealed by the mouse, and floating over the page (the UI view is moved above the page)
- docked: something needs the toolbar to stay visible (new tab page, editing the address, find in page)
*/

const webviews = require('webviews.js')

const navbar = document.getElementById('navbar')
const findBar = document.getElementById('findinpage-bar')

// how far below the toolbar the mouse can go before the toolbar hides
const hideDistance = 24
// how long the toolbar stays visible after the mouse leaves the window
const leaveWindowDelay = 650
// should match the transition duration of #navbar
const hideAnimationDuration = 180

const toolbarReveal = {
  peeking: false,
  shown: false,
  overlay: false,
  mouseInWindow: false,
  lastMouseY: Infinity,
  leaveTimeout: null,
  lowerTimeout: null,
  lastSentState: null,
  isFullscreenVideo: function () {
    return !!webviews.viewFullscreenMap[webviews.selectedId]
  },
  hasVisiblePage: function () {
    return webviews.placeholderRequests.length === 0 &&
      !document.body.classList.contains('is-ntp') &&
      webviews.hasViewForTab(webviews.selectedId)
  },
  isDocked: function () {
    return document.body.classList.contains('is-ntp') ||
      document.body.classList.contains('is-edit-mode') ||
      webviews.placeholderRequests.length > 0 ||
      !findBar.hidden
  },
  isMouseOverToolbar: function () {
    return toolbarReveal.mouseInWindow && toolbarReveal.lastMouseY <= navbar.offsetHeight + hideDistance
  },
  sendState: function (state) {
    const serialized = JSON.stringify(state)
    if (serialized !== toolbarReveal.lastSentState) {
      toolbarReveal.lastSentState = serialized
      ipc.send('setToolbarState', state)
    }
  },
  update: function () {
    const fullscreenVideo = toolbarReveal.isFullscreenVideo()
    const docked = !fullscreenVideo && toolbarReveal.isDocked()
    const shown = !fullscreenVideo && (docked || toolbarReveal.peeking)
    const overlay = shown && !docked && toolbarReveal.hasVisiblePage()

    // find in page is the only time the toolbar stays open over a live page, so the page moves down to make room
    const pushesPage = docked && !findBar.hidden
    if (pushesPage !== document.body.classList.contains('toolbar-pushes-page')) {
      document.body.classList.toggle('toolbar-pushes-page', pushesPage)
      if (webviews.placeholderRequests.length === 0) {
        webviews.resize()
      }
    }

    document.body.classList.toggle('toolbar-docked', docked)

    clearTimeout(toolbarReveal.lowerTimeout)

    if (overlay) {
      // make the UI transparent and move it above the page before sliding the toolbar in
      document.body.classList.add('toolbar-overlay')
      toolbarReveal.sendState({ overlay: true, watchEdge: false, showWindowButtons: true })
      requestAnimationFrame(function () {
        document.body.classList.toggle('toolbar-shown', toolbarReveal.shown)
      })
    } else if (toolbarReveal.overlay && !shown) {
      // slide the toolbar out, then move the UI back below the page
      document.body.classList.remove('toolbar-shown')
      toolbarReveal.sendState({ overlay: true, watchEdge: !shown, showWindowButtons: false })
      toolbarReveal.lowerTimeout = setTimeout(function () {
        toolbarReveal.sendState({ overlay: false, watchEdge: !toolbarReveal.shown, showWindowButtons: toolbarReveal.shown && !fullscreenVideo })
        document.body.classList.remove('toolbar-overlay')
        document.body.classList.toggle('toolbar-shown', toolbarReveal.shown)
      }, hideAnimationDuration)
    } else {
      document.body.classList.remove('toolbar-overlay')
      document.body.classList.toggle('toolbar-shown', shown)
      toolbarReveal.sendState({ overlay: false, watchEdge: !shown, showWindowButtons: shown && !fullscreenVideo })
    }

    toolbarReveal.shown = shown
    toolbarReveal.overlay = overlay
    toolbarReveal.docked = docked
  },
  reveal: function () {
    clearTimeout(toolbarReveal.leaveTimeout)
    if (!toolbarReveal.peeking) {
      toolbarReveal.peeking = true
      toolbarReveal.update()
    }
  },
  conceal: function () {
    clearTimeout(toolbarReveal.leaveTimeout)
    if (toolbarReveal.peeking) {
      toolbarReveal.peeking = false
      toolbarReveal.update()
    }
  },
  initialize: function () {
    ipc.on('toolbarEdgeEnter', function () {
      toolbarReveal.mouseInWindow = true
      toolbarReveal.lastMouseY = 0
      toolbarReveal.reveal()
    })

    document.addEventListener('mousemove', function (e) {
      toolbarReveal.mouseInWindow = true
      toolbarReveal.lastMouseY = e.clientY
      clearTimeout(toolbarReveal.leaveTimeout)

      if (toolbarReveal.peeking && !toolbarReveal.docked && !toolbarReveal.isMouseOverToolbar()) {
        toolbarReveal.conceal()
      }
    })

    document.documentElement.addEventListener('mouseleave', function () {
      toolbarReveal.mouseInWindow = false
      if (toolbarReveal.peeking) {
        clearTimeout(toolbarReveal.leaveTimeout)
        toolbarReveal.leaveTimeout = setTimeout(toolbarReveal.conceal, leaveWindowDelay)
      }
    })

    window.addEventListener('blur', function () {
      // keep the toolbar open while one of its own menus is showing
      if (!document.hasFocus() && !toolbarReveal.isMouseOverToolbar()) {
        toolbarReveal.conceal()
      }
    })

    // when something stops keeping the toolbar docked, it should only stay open if the mouse is still over it
    const observer = new MutationObserver(function () {
      const wasDocked = toolbarReveal.docked
      const docked = toolbarReveal.isDocked()
      if (wasDocked && !docked) {
        toolbarReveal.peeking = toolbarReveal.isMouseOverToolbar()
      }
      if (docked !== wasDocked) {
        toolbarReveal.update()
      }
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    observer.observe(findBar, { attributes: true, attributeFilter: ['hidden'] })

    webviews.bindEvent('view-shown', () => setTimeout(toolbarReveal.update, 0))
    webviews.bindEvent('view-hidden', () => setTimeout(toolbarReveal.update, 0))
    webviews.bindEvent('enter-html-full-screen', toolbarReveal.update)
    webviews.bindEvent('leave-html-full-screen', toolbarReveal.update)

    toolbarReveal.update()
  }
}

module.exports = toolbarReveal
