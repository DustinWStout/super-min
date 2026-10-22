/* list of the available custom commands */

const { ipcRenderer } = require('electron')
const fs = require('fs')

const bangsPlugin = require('searchbar/bangsPlugin.js')

const webviews = require('webviews.js')
const places = require('places/places.js')
const contentBlockingToggle = require('navbar/contentBlockingToggle.js')
const bookmarkConverter = require('bookmarkConverter.js')

function initialize () {
  bangsPlugin.registerCustomBang({
    phrase: '!settings',
    snippet: l('viewSettings'),
    icon: 'carbon:settings',
    isAction: true,
    fn: function (text) {
      webviews.update(tabs.getSelected(), 'min://settings')
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!back',
    snippet: l('goBack'),
    isAction: true,
    fn: function (text) {
      webviews.callAsync(tabs.getSelected(), 'goBack')
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!forward',
    snippet: l('goForward'),
    isAction: true,
    fn: function (text) {
      webviews.callAsync(tabs.getSelected(), 'goForward')
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!screenshot',
    snippet: l('takeScreenshot'),
    icon: 'carbon:image',
    isAction: true,
    fn: function (text) {
      setTimeout(function () { // wait so that the view placeholder is hidden
        ipcRenderer.send('saveViewCapture', { id: tabs.getSelected() })
      }, 400)
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!clearhistory',
    snippet: l('clearHistory'),
    icon: 'carbon:trash-can',
    isAction: true,
    fn: function (text) {
      if (confirm(l('clearHistoryConfirmation'))) {
        places.deleteAllHistory()
        ipc.invoke('clearStorageData')
      }
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!enableblocking',
    snippet: l('enableBlocking'),
    isAction: true,
    fn: function (text) {
      contentBlockingToggle.enableBlocking(tabs.get(tabs.getSelected()).url)
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!disableblocking',
    snippet: l('disableBlocking'),
    isAction: true,
    fn: function (text) {
      contentBlockingToggle.disableBlocking(tabs.get(tabs.getSelected()).url)
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!importbookmarks',
    snippet: l('importBookmarks'),
    icon: 'carbon:upload',
    isAction: true,
    fn: async function () {
      const filePath = await ipc.invoke('showOpenDialog', {
        filters: [
          { name: 'HTML files', extensions: ['htm', 'html'] }
        ]
      })

      if (!filePath) {
        return
      }
      fs.readFile(filePath[0], 'utf-8', function (err, data) {
        if (err || !data) {
          console.warn(err)
          return
        }
        bookmarkConverter.import(data)
      })
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!exportbookmarks',
    snippet: l('exportBookmarks'),
    icon: 'carbon:download',
    isAction: true,
    fn: async function () {
      const data = await bookmarkConverter.exportAll()
      // save the result
      const savePath = await ipc.invoke('showSaveDialog', { defaultPath: 'bookmarks.html' })
      require('fs').writeFileSync(savePath, data)
    }
  })

  bangsPlugin.registerCustomBang({
    phrase: '!addbookmark',
    snippet: l('addBookmark'),
    icon: 'carbon:star',
    fn: function (text) {
      const url = tabs.get(tabs.getSelected()).url
      if (url) {
        places.updateItem(url, {
          isBookmarked: true,
          tags: (text ? text.split(/\s/g).map(t => t.replace('#', '').trim()) : [])
        })
      }
    }
  })
}

module.exports = { initialize }
